import path from "node:path";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanScopeInput,
  type ScanScopeOutput,
} from "../../../platform/processors/processor.js";
import { RepositoryBuilder } from "../../../utils/repository-builder.js";

export class UnversionedFoldersProcessor extends AbstractProcessor<
  ScanScopeInput,
  ScanScopeOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.scope",
    artifactId: "unversioned-folders",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ON_DEMAND" as const;

  readonly description =
    "Creates a Repository for each sourceDir as a ready repository root without directory traversal or VCS remote.";

  protected doProcess(input: ScanScopeInput): ScanScopeOutput {
    return input.map((sourceDir) =>
      RepositoryBuilder.buildFromRoot(input, path.resolve(sourceDir), ""),
    );
  }
}
