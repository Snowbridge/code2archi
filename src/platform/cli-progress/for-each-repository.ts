import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import type { ScanAppInput } from "../processors/processor.js";

export function forEachRepository(
  input: ScanAppInput,
  fn: (repository: RepositoryRecord) => void,
): void {
  for (const entity of input.listEntities("Repository")) {
    fn(entity as unknown as RepositoryRecord);
    input.progress?.tick(1);
  }
}
