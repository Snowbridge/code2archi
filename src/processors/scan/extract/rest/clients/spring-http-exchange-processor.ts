import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { discoverJvmDeclarativeRestClientsForModule } from "../../../../../scan/extract/rest/clients/discover-jvm-declarative-rest-clients-module.js";
import {
  extractSpringHttpExchangeClassPathPrefix,
  extractSpringHttpExchangeEndpoints,
  isSpringHttpExchangeClient,
} from "../../../../../scan/extract/rest/http-exchange-mapping.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";

export class SpringHttpExchangeProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.clients",
    artifactId: "spring-http-exchange",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Spring 6 HTTP Interface declarative REST clients, contracts, and DTOs from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = this.listJvmModules(input);

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        const moduleBuilder = discoverJvmDeclarativeRestClientsForModule(repository, module, {
          isEligible: isSpringHttpExchangeClient,
          extractEndpoints: (type, importContext, language) => {
            const classPathPrefix = extractSpringHttpExchangeClassPathPrefix(
              type,
              importContext,
              language,
            );
            return extractSpringHttpExchangeEndpoints(
              type,
              classPathPrefix,
              importContext,
              language,
            );
          },
        });
        builder.mergeFrom(moduleBuilder);
      }
    });

    return builder.build();
  }

  private listJvmModules(input: ScanAppInput): ApplicationModuleRecord[] {
    return [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");
  }
}
