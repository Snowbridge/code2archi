import type { CreateIntents } from "../../../../discovery-model/entities/create-intents.js";
import type { HttpClientApiRecord } from "../../../../discovery-model/entities/http-client-api.js";
import type { HttpServerApiRecord } from "../../../../discovery-model/entities/http-server-api.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../platform/processors/processor.js";
import { collectHttpClientToServerApiLinks } from "./http-client-server-api-link-match.js";

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
    "Matches HttpServerApi to HttpClientApi heuristically and emits HttpClientToServerApiLink links.";

  protected doProcess(input: ScanAppInput): CreateIntents {
    const servers = [...input.listEntities("HttpServerApi")]
      .map((record) => record as unknown as HttpServerApiRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const clients = [...input.listEntities("HttpClientApi")]
      .map((record) => record as unknown as HttpClientApiRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const matches = collectHttpClientToServerApiLinks(servers, clients);

    if (matches.length === 0) {
      return {};
    }

    return {
      links: {
        HttpClientToServerApiLink: matches,
      },
    };
  }
}
