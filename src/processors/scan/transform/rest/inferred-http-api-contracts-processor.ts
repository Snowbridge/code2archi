import type { CreateIntents } from "../../../../code-inventory/entities/create-intents.js";
import type { HttpApiDataTypeRecord } from "../../../../code-inventory/entities/http-api-data-type.js";
import { HttpApiContract } from "../../../../code-inventory/entities/http-api-contract.js";
import type { RestClientRecord } from "../../../../code-inventory/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../code-inventory/entities/rest-controller.js";
import { HttpApiContractAssignment } from "../../../../code-inventory/links/http-api-contract-assignment.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
} from "../../../../platform/processors/processor.js";
import {
  computeClientControllerRank,
  INFERRED_CLIENT_CONTROLLER_RANK_THRESHOLD,
  isEligibleForInferenceAssignee,
} from "../../../../scan/rest/inferred-http-api-contracts-logic.js";

interface InferredControllerEntry {
  readonly controller: RestControllerRecord;
  readonly contract: HttpApiContract;
}

export class InferredHttpApiContractsProcessor extends AbstractProcessor<
  ScanAppInput,
  CreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "scan.transform.rest",
    artifactId: "inferred-http-api-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Infers HttpApiContract entities and HttpApiContractAssignment links from endpoint and DTO overlap when assignee has no existing assignments.";

  protected doProcess(input: ScanAppInput): CreateIntents {
    const dataTypesById = new Map(
      input.listEntities("HttpApiDataType").map((record) => [
        record.id,
        record as unknown as HttpApiDataTypeRecord,
      ]),
    );

    const controllers = [...input.listEntities("RestController")]
      .map((record) => record as unknown as RestControllerRecord)
      .filter((controller) => isEligibleForInferenceAssignee(controller, input))
      .sort((left, right) => left.id.localeCompare(right.id));

    const clients = [...input.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .filter((client) => isEligibleForInferenceAssignee(client, input))
      .sort((left, right) => left.id.localeCompare(right.id));

    const inferredControllers: InferredControllerEntry[] = controllers.map((controller) => ({
      controller,
      contract: HttpApiContract.forInferredController(controller.fqcn),
    }));

    const contracts: ReturnType<HttpApiContract["toCreateIntent"]>[] = [];
    const assignments: ReturnType<HttpApiContractAssignment["toCreateIntent"]>[] = [];

    for (const entry of inferredControllers) {
      contracts.push(entry.contract.toCreateIntent());
      assignments.push(
        HttpApiContractAssignment.forInference(
          entry.contract.id,
          entry.controller.id,
          1,
        ).toCreateIntent(),
      );
    }

    for (const client of clients) {
      const match = this.findBestControllerMatch(client, inferredControllers, dataTypesById);
      if (match === undefined) {
        continue;
      }

      assignments.push(
        HttpApiContractAssignment.forInference(
          match.contract.id,
          client.id,
          match.rank,
        ).toCreateIntent(),
      );
    }

    const result: CreateIntents = {};
    if (contracts.length > 0) {
      result.entities = { HttpApiContract: contracts };
    }
    if (assignments.length > 0) {
      result.links = { HttpApiContractAssignment: assignments };
    }
    return result;
  }

  private findBestControllerMatch(
    client: RestClientRecord,
    inferredControllers: readonly InferredControllerEntry[],
    dataTypesById: ReadonlyMap<string, HttpApiDataTypeRecord>,
  ): { contract: HttpApiContract; rank: number } | undefined {
    let best: { entry: InferredControllerEntry; rank: number } | undefined;

    for (const entry of inferredControllers) {
      const rank = computeClientControllerRank(client, entry.controller, dataTypesById);
      if (rank < INFERRED_CLIENT_CONTROLLER_RANK_THRESHOLD) {
        continue;
      }
      if (
        best === undefined ||
        rank > best.rank ||
        (rank === best.rank && entry.controller.id.localeCompare(best.entry.controller.id) < 0)
      ) {
        best = { entry, rank };
      }
    }

    if (best === undefined) {
      return undefined;
    }

    return { contract: best.entry.contract, rank: best.rank };
  }
}
