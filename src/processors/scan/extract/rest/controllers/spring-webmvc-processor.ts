import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import type { RepositoryRecord } from "../../../../../code-inventory/entities/repository.js";
import {
  discoverJvmRestControllersForModule,
} from "../../../../../scan/extract/rest/discover-jvm-rest-module.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";
import {
  extractSpringClassPathPrefix,
  extractSpringEndpoints,
  isSpringWebMvcController,
} from "../../../../../scan/extract/rest/spring-mapping.js";

export class SpringWebMvcProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.controllers",
    artifactId: "spring-webmvc",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Spring Web MVC annotation-based REST controllers, contracts, and DTOs from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = this.listJvmModules(input);

    forEachRepository(input, (repository) => {
      const repositoryModules = modules.filter((module) => module.repositoryId === repository.id);
      for (const module of repositoryModules) {
        const moduleBuilder = discoverJvmRestControllersForModule(repository, module, {
          isEligible: isSpringWebMvcController,
          extractEndpoints: (type) =>
            extractSpringEndpoints(type, extractSpringClassPathPrefix(type)),
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
