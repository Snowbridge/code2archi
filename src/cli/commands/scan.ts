import type { CommandModule } from "yargs";
import { CliError } from "../cli-error.js";
import { resolveSourceDirs } from "../../scan/resolve-source-dirs.js";
import { runScanFlow } from "../../scan/run-scan-flow.js";
import { validateScanArgs } from "../../scan/validate-scan-args.js";

export const scanCommand: CommandModule = {
  command: "scan <source-dir..>",
  describe: "Scan source repositories and produce discovery-model",
  builder: (yargs) =>
    yargs
      .positional("source-dir", {
        describe:
          "Source code directories, or a single @path-to-list-file (one path per line)",
        type: "string",
        array: true,
        demandOption: true,
      })
      .option("output", {
        type: "string",
        describe: "Output directory for discovery-model",
      })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "Overwrite non-empty output directory",
      })
      .option("traverse", {
        type: "boolean",
        default: true,
        describe:
          "Search for repository roots under source-dir (disable with --no-traverse)",
      }),
  handler: (argv) => {
    try {
      const sourceDir = argv["source-dir"] as string[];
      const sourceDirs = resolveSourceDirs(sourceDir);
      const scanArgs = validateScanArgs({
        sourceDirs,
        output: argv.output as string | undefined,
        noTraverse: argv.traverse === false,
        force: argv.force as boolean,
      });
      runScanFlow(scanArgs);
    } catch (error) {
      if (error instanceof CliError) {
        console.error(error.message);
        process.exit(error.exitCode);
        return;
      }
      throw error;
    }
  },
};
