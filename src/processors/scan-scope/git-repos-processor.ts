import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type {
  ScanScopeInput,
  ScanScopeOutput,
} from "../../platform/processors/scan-scope-types.js";
import { findGitRepoRootsInSourceDirs } from "./find-git-repo-roots.js";

export class GitReposProcessor implements IProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: ProcessorId = {
    groupId: "scan-scope",
    artifactId: "git-repos",
  };

  readonly version = "0.1.0";

  process(input: ScanScopeInput): ScanScopeOutput {
    return findGitRepoRootsInSourceDirs(input);
  }
}
