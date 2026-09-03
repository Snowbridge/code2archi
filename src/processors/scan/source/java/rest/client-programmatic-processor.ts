import { RestClient } from "../../../../../discovery-model/entities/rest-client.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { parseJavaSourceFile } from "../../../../../parsers/java/java-compilation-unit.js";
import { extractProgrammaticRestClients } from "../../../../../parsers/java/rest-client/programmatic-http-client-extractor.js";
import {
  collectSourceFiles,
  isEligibleJavaOrKotlinModule,
  readSourcesByModule,
  resolveJavaSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import { toProgrammaticRestClientEntity } from "../../rest-client-entity-mapper.js";

export class JavaRestClientProgrammaticProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.source.java.rest",
    artifactId: "client-programmatic",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers programmatic Java REST clients (WebClient, RestTemplate, Spring RestClient, Apache HttpClient).";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const clients: RestClient[] = [];
    forEachRepository(input, (repository) => {
      const contexts = this.buildModuleContextsForRepository(input, repository);
      const fileContexts = collectSourceFiles(contexts, ".java");
      clients.push(...this.scanModules(fileContexts));
    });

    return {
      entities: {
        RestClient: clients.map((client) => client.toCreateIntent()),
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
      if (!isEligibleJavaOrKotlinModule(module)) {
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

  private scanModules(fileContexts: readonly SourceFileContext[]): RestClient[] {
    const byModule = readSourcesByModule(fileContexts);
    const clients: RestClient[] = [];

    for (const { context, sources } of byModule.values()) {
      for (const [absolutePath, source] of sources.entries()) {
        try {
          const unit = parseJavaSourceFile(source);
          for (const parsed of extractProgrammaticRestClients(unit)) {
            clients.push(
              toProgrammaticRestClientEntity(
                parsed,
                context.module,
                context.repository,
                absolutePath,
              ),
            );
          }
        } catch (error) {
          this.logger.warn("failed to parse java source file", {
            file: absolutePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return clients;
  }
}
