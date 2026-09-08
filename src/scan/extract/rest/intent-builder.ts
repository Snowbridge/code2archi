import type { CreateIntents } from "../../../code-inventory/entities/create-intents.js";
import { HttpApiContract } from "../../../code-inventory/entities/http-api-contract.js";
import { HttpApiDataType } from "../../../code-inventory/entities/http-api-data-type.js";
import { RestController } from "../../../code-inventory/entities/rest-controller.js";

export class RestDiscoveryIntentBuilder {
  private readonly dataTypes = new Map<string, ReturnType<HttpApiDataType["toCreateIntent"]>>();
  private readonly contracts = new Map<string, ReturnType<HttpApiContract["toCreateIntent"]>>();
  private readonly controllers = new Map<string, ReturnType<RestController["toCreateIntent"]>>();

  registerDataType(fqcn: string): string {
    const entity = new HttpApiDataType({ fqcn });
    this.dataTypes.set(entity.id, entity.toCreateIntent());
    return entity.id;
  }

  registerContract(fqcn: string): string {
    const entity = new HttpApiContract({ fqcn });
    this.contracts.set(entity.id, entity.toCreateIntent());
    return entity.id;
  }

  registerController(intent: ReturnType<RestController["toCreateIntent"]>): void {
    const existing = this.controllers.get(intent.id);
    if (existing === undefined) {
      this.controllers.set(intent.id, intent);
      return;
    }

    this.controllers.set(intent.id, {
      ...existing,
      endpoints: unionSorted(existing.endpoints, intent.endpoints),
      contractIds: unionSorted(existing.contractIds, intent.contractIds),
      dataTypeIds: unionSorted(existing.dataTypeIds, intent.dataTypeIds),
    });
  }

  mergeFrom(other: RestDiscoveryIntentBuilder): void {
    for (const intent of other.dataTypes.values()) {
      this.dataTypes.set(intent.id, intent);
    }
    for (const intent of other.contracts.values()) {
      this.contracts.set(intent.id, intent);
    }
    for (const intent of other.controllers.values()) {
      this.registerController(intent);
    }
  }

  build(): CreateIntents {
    const entities: CreateIntents["entities"] = {};
    if (this.dataTypes.size > 0) {
      entities.HttpApiDataType = [...this.dataTypes.values()];
    }
    if (this.contracts.size > 0) {
      entities.HttpApiContract = [...this.contracts.values()];
    }
    if (this.controllers.size > 0) {
      entities.RestController = [...this.controllers.values()];
    }
    return { entities };
  }
}

function unionSorted(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
}
