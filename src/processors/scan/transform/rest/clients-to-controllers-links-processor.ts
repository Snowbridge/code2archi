import type { CreateIntents } from "../../../../discovery-model/entities/create-intents.js";
import type { RestClientRecord } from "../../../../discovery-model/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../discovery-model/entities/rest-controller.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../platform/processors/processor.js";
import { collectRestClientToControllerLinks } from "./rest-client-controller-link-match.js";

export class ClientsToControllersLinksProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.transform.rest",
    artifactId: "clients-to-controllers-links",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Matches RestControllers to RestClients heuristically and emits RestClientToControllerLink links.";

  protected doProcess(input: ScanAppInput): CreateIntents {
    const controllers = [...input.listEntities("RestController")]
      .map((record) => record as unknown as RestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const clients = [...input.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const matches = collectRestClientToControllerLinks(controllers, clients);

    if (matches.length === 0) {
      return {};
    }

    return {
      links: {
        RestClientToControllerLink: matches,
      },
    };
  }
}
