import path from "node:path";
import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type {
  ScanScopeInput,
  ScanScopeOutput,
} from "../../platform/processors/scan-scope-types.js";
import { RepositoryBuilder } from "../../utils/repository-builder.js";

export class UnversionedFoldersProcessor
  implements IProcessor<ScanScopeInput, ScanScopeOutput>
{
  readonly id: ProcessorId = {
    groupId: "scan-scope",
    artifactId: "unversioned-folders",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ON_DEMAND" as const;

  process(input: ScanScopeInput): ScanScopeOutput {
    return input.map((sourceDir) =>
      RepositoryBuilder.buildFromRoot(input, path.resolve(sourceDir), ""),
    );
  }
}
