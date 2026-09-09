import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { discoverJvmRestClientsForModule } from "../../../../../scan/extract/rest/clients/discover-jvm-rest-clients-module.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";

export class ProgrammaticRestClientComponentsProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.clients",
    artifactId: "programmatic-rest-client-components",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers programmatic REST clients (RestTemplate, WebClient, HttpClient, OkHttp) and related contracts/DTOs from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        const moduleBuilder = discoverJvmRestClientsForModule(repository, module);
        builder.mergeFrom(moduleBuilder);
      }
    });

    return builder.build();
  }
}
