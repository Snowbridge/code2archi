import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import { HttpServerApi } from "../../../../../code-inventory/entities/http-server-api.js";
import type { RepositoryRecord } from "../../../../../code-inventory/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { UNKNOWN_VERSION } from "../../../../../parsers/build-tool-versions.js";
import { extractKotlinRestControllers } from "../../../../../parsers/kotlin/kotlin-rest-source-adapter.js";
import {
  collectSourceFiles,
  resolveKotlinSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import { parseScanKotlinFile } from "../../../../../platform/scan-io/index.js";
import { toRepoRelativePath } from "../../../../../utils/repo-relative-path.js";
import { toHttpServerApi } from "../../http-api-entity-mapper.js";

export class KotlinRestControllerAnnotationBasedProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.kotlin.rest",
    artifactId: "controller-annotation-based",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Kotlin REST controllers from annotation-based frameworks in Maven and Gradle modules.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const controllers: HttpServerApi[] = [];
    forEachRepository(input, (repository) => {
      const moduleContexts = this.buildModuleContextsForRepository(input, repository);
      const kotlinFiles = collectSourceFiles(moduleContexts, ".kt");
      for (const fileContext of kotlinFiles) {
        controllers.push(...this.scanKotlinFile(fileContext));
      }
    });

    return {
      entities: {
        HttpServerApi: controllers.map((controller) => controller.toCreateIntent()),
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

  private scanKotlinFile(fileContext: SourceFileContext): HttpServerApi[] {
    let compilationUnit;
    try {
      compilationUnit = parseScanKotlinFile(fileContext.absolutePath);
    } catch (error) {
      this.logger.warn("failed to parse kotlin source file", {
        file: fileContext.absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    const parsedControllers = extractKotlinRestControllers(compilationUnit);
    const sourceFile = toRepoRelativePath(
      fileContext.repository.localPath,
      fileContext.absolutePath,
    );

    return parsedControllers.map((parsed) =>
      toHttpServerApi({
        applicationModuleId: fileContext.module.id,
        name: parsed.name,
        symbolKey: parsed.fqcn,
        payloadTypeNames: parsed.dtoFqcn,
        endpoints: parsed.endpoints,
        concurrencyModel: parsed.tcpStackType,
        bindingStyle: "ANNOTATION",
        contractTypeNames: parsed.implementedInterfaceFqcn,
        sourceFile,
        ...(parsed.baseClassFqcn ? { baseTypeName: parsed.baseClassFqcn } : {}),
      }),
    );
  }
}
