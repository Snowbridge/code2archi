import type { ProcessorId } from "../../../../../platform/processors/processor.js";
import { AbstractRestClientsProcessor } from "./abstract-rest-clients-processor.js";

export class RestLibModuleClientsProcessor extends AbstractRestClientsProcessor {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "lib-module-clients",
  };

  readonly version = "0.2.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestClient entities located in Library modules to ApplicationService with Realization from the owning ApplicationComponent and Aggregation into consumer ApplicationComponents.";

  protected readonly includeLibraryModules = true;
}
