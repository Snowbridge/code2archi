import type { CreateIntents } from "../../../../discovery-model/entities/create-intents.js";
import type { RestClientRecord } from "../../../../discovery-model/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../discovery-model/entities/rest-controller.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../platform/processors/processor.js";
import { collectDirectRestServingMatches } from "./direct-rest-serving-match.js";

export class DirectRestRequestsServingProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.link.rest",
    artifactId: "direct-rest-requests-serving",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Matches RestControllers to RestClients heuristically and emits DirectRestRequestsServingMatch links.";

  protected doProcess(input: ScanAppInput): CreateIntents {
    const controllers = [...input.listEntities("RestController")]
      .map((record) => record as unknown as RestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const clients = [...input.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const matches = collectDirectRestServingMatches(controllers, clients);

    if (matches.length === 0) {
      return {};
    }

    return {
      links: {
        DirectRestRequestsServingMatch: matches,
      },
    };
  }
}
