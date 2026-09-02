import path from "node:path";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import { RestClient } from "../../discovery-model/entities/rest-client.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../platform/processors/processor.js";
import { ModuleTypeIndex } from "../../parsers/java/rest-client/module-type-index.js";
import { extractRestClientsFromCompilationUnit } from "../../parsers/java/rest-client/rest-client-extractor.js";
import { parseKotlinSourceFile } from "../../parsers/kotlin/kotlin-compilation-unit.js";
import { adaptKotlinCompilationUnitToJava } from "../../parsers/kotlin/kotlin-rest-source-adapter.js";
import {
  collectSourceFiles,
  isEligibleJavaOrKotlinModule,
  readSourcesByModule,
  resolveKotlinSourceRoots,
  type ModuleSourceContext,
  type SourceFileContext,
} from "../../parsers/rest-client-module-scan.js";
import { toDeclarativeRestClientEntity } from "./rest-client-entity-mapper.js";

export class KotlinDeclarativeRestClientProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.source.rest.client.kotlin",
    artifactId: "declarative",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers declarative Kotlin REST clients (Feign, HttpExchange, MP REST Client, Micronaut, Retrofit).";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const repositories = input
      .listEntities("Repository")
      .map((entity) => entity as unknown as RepositoryRecord);
    const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
    const contexts = this.buildModuleContexts(input, repositoryById);
    const fileContexts = collectSourceFiles(contexts, ".kt");
    const clients = this.scanModules(fileContexts);

    return {
      entities: {
        RestClient: clients.map((client) => client.toCreateIntent()),
      },
    };
  }

  private buildModuleContexts(
    input: ScanAppInput,
    repositoryById: ReadonlyMap<string, RepositoryRecord>,
  ): ModuleSourceContext[] {
    const contexts: ModuleSourceContext[] = [];

    for (const entity of input.listEntities("ApplicationModule")) {
      const module = entity as unknown as ApplicationModuleRecord;
      if (!isEligibleJavaOrKotlinModule(module)) {
        continue;
      }

      const repository = repositoryById.get(module.repositoryId);
      if (!repository) {
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
      const index = new ModuleTypeIndex();
      const units: { absolutePath: string; unit: ReturnType<typeof adaptKotlinCompilationUnitToJava> }[] =
        [];

      for (const [absolutePath, source] of sources.entries()) {
        try {
          const fileBaseName = path.basename(absolutePath, ".kt");
          const kotlinUnit = parseKotlinSourceFile(source, { fileBaseName });
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
