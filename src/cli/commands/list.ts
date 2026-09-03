import type { CommandModule } from "yargs";
import { CliError } from "../cli-error.js";
import type { GlobalArgv } from "../processor-groups.js";
import { runListFlow } from "../../list/run-list-flow.js";
import { validateListArgs } from "../../list/validate-list-args.js";
import { getLogger, logError } from "../../platform/logging/index.js";
import { finalizeProfiling } from "../../platform/profiling/index.js";
import { packageVersion } from "../../package-version.js";

export const listCommand: CommandModule = {
  command: "list [group-pattern..]",
  aliases: ["list-processors", "processors"],
  describe: "List registered processors from the registry",
  builder: (yargs) =>
    yargs
      .positional("group-pattern", {
        describe:
          "Optional groupId filter (literal or prefix.* wildcard); multiple patterns are OR-ed",
        type: "string",
        array: true,
      })
      .option("only-groups", {
        type: "boolean",
        default: false,
        alias: ["groups", "g"],
        describe: "List matching group IDs instead of processors",
      })
      .option("to-json", {
        type: "boolean",
        default: false,
        describe: "Write JSON to code2archi-processors-list.json in cwd",
      })
      .epilogue(`code2archi (c2a) version ${packageVersion}\nFor more options get help with --show-hidden flag`),
  handler: (argv) => {
    const logger = getLogger("cli.list");
    const globalArgv = argv as unknown as GlobalArgv;
    try {
      const listArgs = validateListArgs({
        groupPatterns: (argv["group-pattern"] as string[] | undefined) ?? [],
        onlyGroups: argv["only-groups"] as boolean,
        toJson: argv["to-json"] as boolean,
      });
      logger.info("command start", {
        groupPatterns: listArgs.groupPatterns,
        onlyGroups: listArgs.onlyGroups,
        toJson: listArgs.toJson,
      });
      runListFlow(listArgs);
      logger.info("command completed");
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
        command: "list",
        verbose: globalArgv.verbose,
      });
    }
  },
};
