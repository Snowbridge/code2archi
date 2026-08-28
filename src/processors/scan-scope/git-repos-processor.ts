import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type {
  ScanScopeInput,
  ScanScopeOutput,
} from "../../platform/processors/scan-scope-types.js";
import { getLogger, logCalls, processorLoggerName } from "../../platform/logging/index.js";
import { RepositoryBuilder } from "../../utils/repository-builder.js";
import { GitWorkingCopy } from "../../utils/git-working-copy.js";

export class GitReposProcessor implements IProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: ProcessorId = {
    groupId: "scan-scope",
    artifactId: "git-repos",
  };

  readonly version = "0.2.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает корни Git-репозиториев в sourceDirs и создаёт сущности Repository с remote URL и buildSystems.";

  process = logCalls(
    function (this: GitReposProcessor, input: ScanScopeInput): ScanScopeOutput {
      const logger = getLogger(processorLoggerName(this.id));
      const repoRoots = GitWorkingCopy.findRepoRootsInSourceDirs(input);
      return repoRoots.map((repoRoot) => {
        const localPath = repoRoot;
        const url = GitWorkingCopy.resolveRemoteUrl(localPath);
        if (!url) {
          logger.warn("git remote not resolved", { path: localPath });
        }
        return RepositoryBuilder.buildFromRoot(input, repoRoot, url);
      });
    },
    processorLoggerName({ groupId: "scan-scope", artifactId: "git-repos" }),
    "process",
  );
}
