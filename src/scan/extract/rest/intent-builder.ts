import type { CreateIntents } from "../../../code-inventory/entities/create-intents.js";
import { HttpApiContract } from "../../../code-inventory/entities/http-api-contract.js";
import { HttpApiDataType } from "../../../code-inventory/entities/http-api-data-type.js";
import { RestClient } from "../../../code-inventory/entities/rest-client.js";
import { RestController } from "../../../code-inventory/entities/rest-controller.js";

export class RestDiscoveryIntentBuilder {
  private readonly dataTypes = new Map<string, ReturnType<HttpApiDataType["toCreateIntent"]>>();
  private readonly contracts = new Map<string, ReturnType<HttpApiContract["toCreateIntent"]>>();
  private readonly controllers = new Map<string, ReturnType<RestController["toCreateIntent"]>>();
  private readonly clients = new Map<string, ReturnType<RestClient["toCreateIntent"]>>();

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
    this.mergeRestEndpointIntent(this.controllers, intent);
  }

  registerClient(intent: ReturnType<RestClient["toCreateIntent"]>): void {
    this.mergeRestEndpointIntent(this.clients, intent);
  }

  private mergeRestEndpointIntent<T extends {
    readonly id: string;
    readonly endpoints: readonly string[];
    readonly contractIds: readonly string[];
    readonly dataTypeIds: readonly string[];
  }>(store: Map<string, T>, intent: T): void {
    const existing = store.get(intent.id);
    if (existing === undefined) {
      store.set(intent.id, intent);
      return;
    }

    store.set(intent.id, {
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
    for (const intent of other.clients.values()) {
      this.registerClient(intent);
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
    if (this.clients.size > 0) {
      entities.RestClient = [...this.clients.values()];
    }
    return { entities };
  }
}

function unionSorted(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
}
