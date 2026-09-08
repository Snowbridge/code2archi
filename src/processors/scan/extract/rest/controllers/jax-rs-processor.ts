import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import {
  discoverJvmRestControllersForModule,
} from "../../../../../scan/extract/rest/discover-jvm-rest-module.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";
import {
  extractJaxRsClassPathPrefix,
  extractJaxRsEndpoints,
  isJaxRsResource,
} from "../../../../../scan/extract/rest/jaxrs-mapping.js";

export class JaxRsProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.controllers",
    artifactId: "jax-rs",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers JAX-RS annotation-based REST resources, contracts, and DTOs from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        const moduleBuilder = discoverJvmRestControllersForModule(repository, module, {
          isEligible: isJaxRsResource,
          extractEndpoints: (type) =>
            extractJaxRsEndpoints(type, extractJaxRsClassPathPrefix(type)),
        });
        builder.mergeFrom(moduleBuilder);
      }
    });

    return builder.build();
  }
}
