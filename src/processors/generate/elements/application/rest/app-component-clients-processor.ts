import type { ProcessorId } from "../../../../../platform/processors/processor.js";
import { AbstractRestClientsProcessor } from "./abstract-rest-clients-processor.js";

export class RestAppComponentClientsProcessor extends AbstractRestClientsProcessor {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "app-component-clients",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ON_DEMAND" as const;

  readonly description =
    "Maps RestClient entities located in non-library modules (app components) to ApplicationService with Realization from the owning ApplicationComponent.";

  protected readonly includeLibraryModules = false;
}
