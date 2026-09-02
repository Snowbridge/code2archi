import type { CommandModule } from "yargs";
import { CliError } from "../cli-error.js";
import {
  createRunGenerateFlowInput,
  runGenerateFlow,
} from "../../generate/run-generate-flow.js";
import { validateGenerateArgs } from "../../generate/validate-generate-args.js";
import type { GlobalArgv } from "../processor-groups.js";
import { getLogger, logError } from "../../platform/logging/index.js";
import { finalizeProfiling } from "../../platform/profiling/index.js";
import { packageVersion } from "../../package-version.js";

export const generateCommand: CommandModule = {
  command: "generate <output-file> [discovery-model]",
  describe: "Generate ArchiMate model from discovery-model",
  builder: (yargs) =>
    yargs
      .positional("output-file", {
        describe: "Output .archimate file path",
        type: "string",
        demandOption: true,
      })
      .positional("discovery-model", {
        describe: "Discovery-model directory (default: latest code2archi-scan-* in cwd)",
        type: "string",
      })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "Overwrite existing output file",
      })
      .option("no-decorate", {
        type: "boolean",
        default: false,
        describe: "Do not decorate element names for visual distinction in Archi",
      })
      .epilogue(`code2archi (c2a) version ${packageVersion}\nFor more options get help with --show-hidden flag`),
  handler: (argv) => {
    const logger = getLogger("cli.generate");
    const globalArgv = argv as unknown as GlobalArgv;
    try {
      const generateArgs = validateGenerateArgs({
        outputFile: argv["output-file"] as string,
        discoveryModelDir: argv["discovery-model"] as string | undefined,
        force: argv.force as boolean,
        noDecorate: argv["no-decorate"] as boolean,
      });
      logger.info("command start", {
        outputFile: generateArgs.outputFile,
        discoveryModelDir: generateArgs.discoveryModelDir,
      });
      runGenerateFlow(
        createRunGenerateFlowInput(generateArgs, globalArgv),
      );
      logger.info("command completed", { outputFile: generateArgs.outputFile });
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
        command: "generate",
        verbose: globalArgv.verbose,
      });
    }
  },
};
