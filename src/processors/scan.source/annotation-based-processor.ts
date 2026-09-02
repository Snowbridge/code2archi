import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { recordProcessedFile } from "../../platform/profiling/index.js";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import { RestController } from "../../discovery-model/entities/rest-controller.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../platform/processors/processor.js";
import { UNKNOWN_VERSION } from "../../parsers/build-tool-versions.js";
import {
  parseGradleProductionJavaSourceRoots,
  resolveMavenProductionJavaSourceRoot,
} from "../../parsers/gradle-source-roots.js";
import { parseJavaSourceFile } from "../../parsers/java/java-compilation-unit.js";
import { extractRestControllers } from "../../parsers/java/rest/rest-controller-extractor.js";
import { toRepoRelativePath } from "../../utils/repo-relative-path.js";

interface ModuleSourceContext {
  readonly module: ApplicationModuleRecord;
  readonly repository: RepositoryRecord;
  readonly sourceRoots: readonly string[];
}

interface JavaFileContext {
  readonly absolutePath: string;
  readonly module: ApplicationModuleRecord;
  readonly repository: RepositoryRecord;
}

export class AnnotationBasedProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.source.rest.controller.java",
    artifactId: "annotation-based",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Java REST controllers from annotation-based frameworks in Maven and Gradle modules.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const repositories = this.loadRepositories(input);
    const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
    const moduleContexts = this.buildModuleContexts(input, repositoryById);
    const javaFiles = this.collectJavaFiles(moduleContexts);
    const controllers: RestController[] = [];

    for (const fileContext of javaFiles) {
      controllers.push(...this.scanJavaFile(fileContext));
    }

    return {
      entities: {
        RestController: controllers.map((controller) => controller.toCreateIntent()),
      },
    };
  }

  private loadRepositories(input: ScanAppInput): RepositoryRecord[] {
    return input
      .listEntities("Repository")
      .map((entity) => entity as unknown as RepositoryRecord);
  }

  private buildModuleContexts(
    input: ScanAppInput,
    repositoryById: ReadonlyMap<string, RepositoryRecord>,
  ): ModuleSourceContext[] {
    const contexts: ModuleSourceContext[] = [];

    for (const entity of input.listEntities("ApplicationModule")) {
      const module = entity as unknown as ApplicationModuleRecord;
      if (!this.isEligibleModule(module)) {
        continue;
      }

      const repository = repositoryById.get(module.repositoryId);
      if (!repository) {
        continue;
      }

      const sourceRoots = this.resolveSourceRoots(repository, module);
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

  private resolveSourceRoots(
    repository: RepositoryRecord,
    module: ApplicationModuleRecord,
  ): string[] {
    if (module.buildSystem === "maven") {
      const sourceRoot = resolveMavenProductionJavaSourceRoot(repository.localPath, module.repoPath);
      return sourceRoot ? [sourceRoot] : [];
    }

    return parseGradleProductionJavaSourceRoots(
      repository.localPath,
      module.repoPath,
      module.buildScript,
    );
  }

  private collectJavaFiles(contexts: readonly ModuleSourceContext[]): JavaFileContext[] {
    const fileToContext = new Map<string, JavaFileContext>();

    for (const context of contexts) {
      for (const sourceRoot of context.sourceRoots) {
        for (const absolutePath of this.walkJavaFiles(sourceRoot)) {
          const existing = fileToContext.get(absolutePath);
          if (!existing) {
            fileToContext.set(absolutePath, {
              absolutePath,
              module: context.module,
              repository: context.repository,
            });
            continue;
          }

          if (context.module.repoPath.length > existing.module.repoPath.length) {
            fileToContext.set(absolutePath, {
              absolutePath,
              module: context.module,
              repository: context.repository,
            });
          }
        }
      }
    }

    return [...fileToContext.values()].sort((left, right) =>
      left.absolutePath.localeCompare(right.absolutePath),
    );
  }

  private walkJavaFiles(rootDir: string): string[] {
    const files: string[] = [];
    const stack = [rootDir];

    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir) {
        continue;
      }

      let entries;
      try {
        entries = readdirSync(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(absolutePath);
          continue;
        }

        if (entry.isFile() && entry.name.endsWith(".java")) {
          recordProcessedFile(absolutePath);
          files.push(absolutePath);
        }
      }
    }

    return files;
  }

  private scanJavaFile(fileContext: JavaFileContext): RestController[] {
    let source: string;
    try {
      source = readFileSync(fileContext.absolutePath, "utf8");
    } catch (error) {
      this.logger.warn("failed to read java source file", {
        file: fileContext.absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    let compilationUnit;
    try {
      compilationUnit = parseJavaSourceFile(source);
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
