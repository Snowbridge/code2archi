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
import { ModuleTypeIndex } from "../../../../../parsers/java/rest-client/module-type-index.js";
import { extractRestClientsFromCompilationUnit } from "../../../../../parsers/java/rest-client/rest-client-extractor.js";
import { parseScanKotlinFile } from "../../../../../platform/scan-io/index.js";
import { adaptKotlinCompilationUnitToJava } from "../../../../../parsers/kotlin/kotlin-rest-source-adapter.js";
import {
  collectSourceFiles,
  groupSourceFilesByModule,
  isEligibleJavaOrKotlinModule,
  resolveKotlinSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../../../../parsers/rest-client-module-scan.js";
import { toDeclarativeRestClientEntity } from "../../rest-client-entity-mapper.js";

export class KotlinRestClientDeclarativeProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.source.kotlin.rest",
    artifactId: "client-declarative",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers declarative Kotlin REST clients (Feign, HttpExchange, MP REST Client, Micronaut, Retrofit).";

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
    const byModule = groupSourceFilesByModule(fileContexts);
    const clients: RestClient[] = [];

    for (const { context, paths } of byModule.values()) {
      const index = new ModuleTypeIndex();
      const units: { absolutePath: string; unit: ReturnType<typeof adaptKotlinCompilationUnitToJava> }[] =
        [];

      for (const absolutePath of paths) {
        try {
          const fileBaseName = path.basename(absolutePath, ".kt");
          const kotlinUnit = parseScanKotlinFile(absolutePath, { fileBaseName });
          const unit = adaptKotlinCompilationUnitToJava(kotlinUnit);
          index.addCompilationUnit(unit);
          units.push({ absolutePath, unit });
        } catch (error) {
          this.logger.warn("failed to parse kotlin source file", {
            file: absolutePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      for (const { absolutePath, unit } of units) {
        for (const parsed of extractRestClientsFromCompilationUnit(unit, index)) {
          clients.push(
            toDeclarativeRestClientEntity(parsed, context.module, context.repository, absolutePath),
          );
        }
      }
    }

    return clients;
  }
}
