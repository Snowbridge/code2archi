import { formatUserCliCommandLine } from "../format-cli-command-line.js";
import { getLogger } from "../../platform/logging/index.js";
import type { RunConfigResolution } from "./run-config-types.js";

export function logRunConfigResolved(runConfig: RunConfigResolution): void {
  getLogger("cli.bootstrap").info("run-config resolved", {
    path: runConfig.path,
    name: runConfig.name,
  });
}

export function logBootstrapStartup(
  runConfig: RunConfigResolution,
  argv: readonly string[],
): void {
  logRunConfigResolved(runConfig);
  getLogger("cli.bootstrap").info("command line", {
    commandLine: formatUserCliCommandLine(argv),
  });
}
