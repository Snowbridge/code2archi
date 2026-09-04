import type { CreateIntents } from "../../../../discovery-model/entities/create-intents.js";
import type { NodejsRestClientRecord } from "../../../../discovery-model/entities/nodejs-rest-client.js";
import type { NodejsRestControllerRecord } from "../../../../discovery-model/entities/nodejs-rest-controller.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../platform/processors/processor.js";
import { collectNodejsDirectRestServingMatches } from "./direct-rest-serving-match.js";

export class NodejsDirectRestRequestsServingProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.link.nodejs.rest",
    artifactId: "direct-rest-requests-serving",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Matches NodejsRestControllers to NodejsRestClients heuristically and emits NodejsDirectRestRequestsServingMatch links.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const controllers = [...input.listEntities("NodejsRestController")]
      .map((record) => record as unknown as NodejsRestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const clients = [...input.listEntities("NodejsRestClient")]
      .map((record) => record as unknown as NodejsRestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const matches = collectNodejsDirectRestServingMatches(controllers, clients);

    if (matches.length === 0) {
      return {};
    }

    return {
      links: {
        NodejsDirectRestRequestsServingMatch: matches.map((match) => match.toCreateIntent()),
      },
    } satisfies CreateIntents;
  }
}
