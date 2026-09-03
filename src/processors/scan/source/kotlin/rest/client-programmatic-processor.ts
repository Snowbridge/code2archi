import path from "node:path";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import { RestClient } from "../../../../../discovery-model/entities/rest-client.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { parseKotlinSourceFile } from "../../../../../parsers/kotlin/kotlin-compilation-unit.js";
import { extractKotlinProgrammaticRestClients } from "../../../../../parsers/kotlin/kotlin-programmatic-rest-client-adapter.js";
import {
  collectSourceFiles,
  isEligibleJavaOrKotlinModule,
  readSourcesByModule,
  resolveKotlinSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import { toProgrammaticRestClientEntity } from "../../rest-client-entity-mapper.js";

export class KotlinRestClientProgrammaticProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.source.kotlin.rest",
    artifactId: "client-programmatic",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers programmatic Kotlin REST clients (WebClient wrappers, Ktor HttpClient).";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const clients: RestClient[] = [];
    forEachRepository(input, (repository) => {
      const contexts = this.buildModuleContextsForRepository(input, repository);
      const fileContexts = collectSourceFiles(contexts, ".kt");
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

      const sourceRoots = resolveKotlinSourceRoots(repository, module);
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
          const fileBaseName = path.basename(absolutePath, ".kt");
          const unit = parseKotlinSourceFile(source, { fileBaseName });
          for (const parsed of extractKotlinProgrammaticRestClients(unit)) {
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
          this.logger.warn("failed to parse kotlin source file", {
            file: absolutePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return clients;
  }
}
