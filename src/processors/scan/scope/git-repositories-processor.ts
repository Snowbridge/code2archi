import {
  AbstractProcessor,
  type ProcessorId,
  type ScanScopeInput,
  type ScanScopeOutput,
} from "../../../platform/processors/processor.js";
import { RepositoryBuilder } from "../../../utils/repository-builder.js";
import { GitWorkingCopy } from "../../../utils/git-working-copy.js";

export class GitRepositoriesProcessor extends AbstractProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.scope",
    artifactId: "git-repositories",
  };

  readonly version = "0.2.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Git repository roots in sourceDirs and creates Repository entities with remote URL and buildSystems.";

  protected doProcess(input: ScanScopeInput): ScanScopeOutput {
    const repoRoots = GitWorkingCopy.findRepoRootsInSourceDirs(input);
    return repoRoots.map((repoRoot) => {
      const localPath = repoRoot;
      const url = GitWorkingCopy.resolveRemoteUrl(localPath);
      if (!url) {
        this.logger.warn("git remote not resolved", { path: localPath });
      }
      return RepositoryBuilder.buildFromRoot(input, repoRoot, url);
    });
  }
}
