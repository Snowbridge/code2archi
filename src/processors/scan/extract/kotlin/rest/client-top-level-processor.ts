import path from "node:path";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import { HttpClientApi } from "../../../../../discovery-model/entities/http-client-api.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { parseScanKotlinFile } from "../../../../../platform/scan-io/index.js";
import { extractKotlinTopLevelRestClients } from "../../../../../parsers/kotlin/kotlin-top-level-rest-client-extractor.js";
import {
  collectSourceFiles,
  groupSourceFilesByModule,
  isEligibleJavaOrKotlinModule,
  resolveKotlinSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import { toProgrammaticRestClientEntity } from "../../rest-client-entity-mapper.js";

export class KotlinRestClientTopLevelProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.kotlin.rest",
    artifactId: "client-top-level",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers programmatic Kotlin REST clients aggregated per FileKt from top-level functions.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const clients: HttpClientApi[] = [];
    forEachRepository(input, (repository) => {
      const contexts = this.buildModuleContextsForRepository(input, repository);
      const fileContexts = collectSourceFiles(contexts, ".kt");
      clients.push(...this.scanModules(fileContexts));
    });

    return {
      entities: {
        HttpClientApi: clients.map((client) => client.toCreateIntent()),
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

  private scanModules(fileContexts: readonly SourceFileContext[]): HttpClientApi[] {
    const byModule = groupSourceFilesByModule(fileContexts);
    const clients: HttpClientApi[] = [];

    for (const { context, paths } of byModule.values()) {
      for (const absolutePath of paths) {
        try {
          const fileBaseName = path.basename(absolutePath, ".kt");
          const unit = parseScanKotlinFile(absolutePath, { fileBaseName });
          for (const parsed of extractKotlinTopLevelRestClients(unit)) {
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
