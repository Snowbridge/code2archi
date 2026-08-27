#!/usr/bin/env node

import "./platform/processors/builtin-processors.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { scanCommand } from "./cli/commands/scan.js";
import { CliError } from "./cli/cli-error.js";
import { ExitCode } from "./cli/exit-codes.js";
import { globalOptions } from "./cli/global-options.js";
import { validateGlobalArgv } from "./cli/validate-global-argv.js";
import { packageVersion } from "./package-version.js";

yargs(hideBin(process.argv))
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
  })
  .command(scanCommand)
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
