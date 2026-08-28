import type { DiscoveryEntityRecord } from "../../discovery-model/entity-types.js";
import type { Repository } from "../../discovery-model/repository.js";

export function asRepository(entity: DiscoveryEntityRecord): Repository {
  return entity as unknown as Repository;
}
