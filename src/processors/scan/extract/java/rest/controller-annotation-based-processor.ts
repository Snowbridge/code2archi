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
import { extractRestControllers } from "../../../../../parsers/java/rest/rest-controller-extractor.js";
import {
  collectSourceFiles,
  resolveJavaSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import { parseScanJavaFile } from "../../../../../platform/scan-io/index.js";
import { toRepoRelativePath } from "../../../../../utils/repo-relative-path.js";

export class JavaRestControllerAnnotationBasedProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.java.rest",
    artifactId: "controller-annotation-based",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Java REST controllers from annotation-based frameworks in Maven and Gradle modules.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const controllers: RestController[] = [];
    forEachRepository(input, (repository) => {
      const moduleContexts = this.buildModuleContextsForRepository(input, repository);
      const javaFiles = collectSourceFiles(moduleContexts, ".java");
      for (const fileContext of javaFiles) {
        controllers.push(...this.scanJavaFile(fileContext));
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

      const sourceRoots = resolveJavaSourceRoots(repository, module);
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
      module.javaVersion !== UNKNOWN_VERSION
    );
  }

  private scanJavaFile(fileContext: SourceFileContext): RestController[] {
    let compilationUnit;
    try {
      compilationUnit = parseScanJavaFile(fileContext.absolutePath);
    } catch (error) {
      this.logger.warn("failed to parse java source file", {
        file: fileContext.absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    const parsedControllers = extractRestControllers(compilationUnit);
    const sourceFile = toRepoRelativePath(
      fileContext.repository.localPath,
      fileContext.absolutePath,
    );

    return parsedControllers.map(
      (parsed) =>
        new RestController({
          applicationModuleId: fileContext.module.id,
          name: parsed.name,
          fqcn: parsed.fqcn,
          dtoFqcn: parsed.dtoFqcn,
          endpoints: parsed.endpoints,
          tcpStackType: parsed.tcpStackType,
          programmingModel: "DECLARATIVE",
          implementedInterfaceFqcn: parsed.implementedInterfaceFqcn,
          sourceFile,
          ...(parsed.baseClassFqcn ? { baseClassFqcn: parsed.baseClassFqcn } : {}),
        }),
    );
  }
}
