import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type {
  ScanScopeInput,
  ScanScopeOutput,
} from "../../platform/processors/scan-scope-types.js";
import { RepositoryBuilder } from "../../utils/repository-builder.js";
import { GitWorkingCopy } from "../../utils/git-working-copy.js";

export class GitReposProcessor implements IProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: ProcessorId = {
    groupId: "scan-scope",
    artifactId: "git-repos",
  };

  readonly version = "0.2.0";

  readonly executionPolicy = "ALWAYS" as const;

  process(input: ScanScopeInput): ScanScopeOutput {
    const repoRoots = GitWorkingCopy.findRepoRootsInSourceDirs(input);
    return repoRoots.map((repoRoot) => {
      const localPath = repoRoot;
      const url = GitWorkingCopy.resolveRemoteUrl(localPath);
      return RepositoryBuilder.buildFromRoot(input, repoRoot, url);
    });
  }
}
