import path from "node:path";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import { RestController } from "../../../../../discovery-model/entities/rest-controller.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { UNKNOWN_VERSION } from "../../../../../parsers/build-tool-versions.js";
import { extractKotlinFunctionalRouters } from "../../../../../parsers/kotlin/kotlin-functional-router-extractor.js";
import {
  collectSourceFiles,
  resolveKotlinSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import { parseScanKotlinFile } from "../../../../../platform/scan-io/index.js";
import { toRepoRelativePath } from "../../../../../utils/repo-relative-path.js";

export class KotlinRestControllerKtorAndRouterBasedProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.source.kotlin.rest",
    artifactId: "controller-ktor-and-router-based",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Kotlin REST controllers from Ktor routing and functional router APIs in Maven and Gradle modules.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const controllers: RestController[] = [];
    forEachRepository(input, (repository) => {
      const moduleContexts = this.buildModuleContextsForRepository(input, repository);
      const kotlinFiles = collectSourceFiles(moduleContexts, ".kt");
      for (const fileContext of kotlinFiles) {
        controllers.push(...this.scanKotlinFile(fileContext));
      }
    });

    return {
      entities: {
        RestController: controllers.map((controller) => controller.toCreateIntent()),
      },
    };
  }

  private buildModuleContextsForRepository(
    input: ScanAppInput,
    repository: RepositoryRecord,
  ): ModuleSourceContext[] {
    const contexts: ModuleSourceContext[] = [];

    for (const entity of input.listEntities("ApplicationModule")) {
      const module = entity as unknown as ApplicationModuleRecord;
      if (!this.isEligibleModule(module)) {
        continue;
      }

      if (module.repositoryId !== repository.id) {
        continue;
      }

      const sourceRoots = resolveKotlinSourceRoots(repository, module);
      if (sourceRoots.length === 0) {
        continue;
      }

      contexts.push({ module, repository, sourceRoots });
    }

    return contexts;
  }

  private isEligibleModule(module: ApplicationModuleRecord): boolean {
    return (
      (module.buildSystem === "maven" || module.buildSystem === "gradle") &&
      (module.javaVersion !== UNKNOWN_VERSION || module.kotlinJvmTarget !== UNKNOWN_VERSION)
    );
  }

  private scanKotlinFile(fileContext: SourceFileContext): RestController[] {
    const fileBaseName = path.basename(fileContext.absolutePath, ".kt");
    let compilationUnit;
    try {
      compilationUnit = parseScanKotlinFile(fileContext.absolutePath, { fileBaseName });
    } catch (error) {
      this.logger.warn("failed to parse kotlin source file", {
        file: fileContext.absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    const parsedRouters = extractKotlinFunctionalRouters(compilationUnit);
    const sourceFile = toRepoRelativePath(
      fileContext.repository.localPath,
      fileContext.absolutePath,
    );

    return parsedRouters.map(
      (parsed) =>
        new RestController({
          applicationModuleId: fileContext.module.id,
          name: parsed.name,
          fqcn: parsed.fqcn,
          dtoFqcn: parsed.dtoFqcn,
          endpoints: parsed.endpoints,
          tcpStackType: parsed.tcpStackType,
          programmingModel: "FUNCTIONAL",
          implementedInterfaceFqcn: parsed.implementedInterfaceFqcn,
          sourceFile,
          ...(parsed.baseClassFqcn ? { baseClassFqcn: parsed.baseClassFqcn } : {}),
        }),
    );
  }
}
