import type { CommandModule } from "yargs";
import { CliError } from "../cli-error.js";
import { resolveSourceDirs } from "../../scan/resolve-source-dirs.js";
import type { GlobalArgv } from "../processor-groups.js";
import {
  createRunScanFlowInput,
  runScanFlow,
} from "../../scan/run-scan-flow.js";
import { validateScanArgs } from "../../scan/validate-scan-args.js";
import { getLogger, logError } from "../../platform/logging/index.js";
import { finalizeProfiling } from "../../platform/profiling/index.js";
import { packageVersion } from "../../package-version.js";

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
      .epilogue(`code2archi (c2a) version ${packageVersion}\nFor more options get help with --show-hidden flag`),
  handler: (argv) => {
    const logger = getLogger("cli.scan");
    const globalArgv = argv as unknown as GlobalArgv;
    try {
      const sourceDir = argv["source-dir"] as string[];
      const sourceDirs = resolveSourceDirs(sourceDir);
      const scanArgs = validateScanArgs({
        sourceDirs,
        output: argv.output as string | undefined,
        force: argv.force as boolean,
      });
      logger.info("command start", {
        sourceDirCount: sourceDirs.length,
        outputDir: scanArgs.outputDir,
      });
      runScanFlow(
        createRunScanFlowInput(scanArgs, globalArgv),
      );
      logger.info("command completed", { outputDir: scanArgs.outputDir });
    } catch (error) {
      if (error instanceof CliError) {
        console.error(error.message);
        process.exit(error.exitCode);
        return;
      }
      logError(logger, error);
      throw error;
    } finally {
      finalizeProfiling({
        command: "scan",
        verbose: globalArgv.verbose,
      });
    }
  },
};
