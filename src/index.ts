#!/usr/bin/env node

import "./platform/processors/builtin-processors.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { scanCommand } from "./cli/commands/scan.js";
import { generateCommand } from "./cli/commands/generate.js";
import { listCommand } from "./cli/commands/list.js";
import { CliError } from "./cli/cli-error.js";
import { ExitCode } from "./cli/exit-codes.js";
import { globalOptions } from "./cli/global-options.js";
import { validateGlobalArgv } from "./cli/validate-global-argv.js";
import { bootstrapArgv } from "./cli/run-config/bootstrap-argv.js";
import { logRunConfigResolved } from "./cli/run-config/log-run-config-resolved.js";
import { setRunConfigResolution } from "./cli/run-config/run-config-context.js";
import { initLogging } from "./platform/logging/index.js";
import { initProfiling } from "./platform/profiling/index.js";
import type { GlobalArgv } from "./cli/processor-groups.js";
import { packageVersion } from "./package-version.js";

let bootstrappedArgv: string[];
let runConfigResolution;

try {
  const bootstrapResult = bootstrapArgv(hideBin(process.argv));
  bootstrappedArgv = bootstrapResult.argv;
  runConfigResolution = bootstrapResult.runConfig;
  setRunConfigResolution(runConfigResolution);
} catch (error) {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  throw error;
}

yargs(bootstrappedArgv)
  .scriptName("code2archi")
  .options(globalOptions)
  .middleware((argv) => {
    if (argv.help || argv.version) {
      return;
    }
    try {
      validateGlobalArgv(argv);
    } catch (error) {
      if (error instanceof CliError) {
        console.error(error.message);
        process.exit(error.exitCode);
      }
      throw error;
    }

    const globalArgv = argv as unknown as GlobalArgv;
    initLogging({
      logLevel: globalArgv.logLevel,
      verbose: globalArgv.verbose,
    });
    if (!argv.help && !argv.version) {
      logRunConfigResolved(runConfigResolution);
    }
    initProfiling({
      enabled: globalArgv.profile,
      continueOnError: globalArgv.continueOnError,
    });
  })
  .command(scanCommand)
  .command(generateCommand)
  .command(listCommand)
  .demandCommand(1, "Specify a command")
  .strict()
  .help()
  .alias("help", "h")
  .version(packageVersion)
  .alias("version", "v")
  .epilogue(`code2archi (c2a) version ${packageVersion}`)
  .fail((message, error) => {
    if (error instanceof CliError) {
      console.error(error.message);
      process.exit(error.exitCode);
      return;
    }

    if (message) {
      console.error(message);
    } else if (error) {
      console.error(error.message);
    }

    process.exit(ExitCode.ARGV);
  })
  .parse();
