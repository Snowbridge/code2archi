import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { CliError } from "../cli-error.js";
import type { RunConfigCommandName, RunConfigValues } from "./run-config-types.js";
import { mergeRunConfigSections, parseRunConfigDocument } from "./merge-run-config.js";

export function loadRunConfigFile(
  configPath: string,
  command: RunConfigCommandName | undefined,
): RunConfigValues {
  let document: unknown;
  try {
    document = parseYaml(readFileSync(configPath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid run-config YAML in ${configPath}: ${detail}`);
  }

  const { root, command: commandSection } = parseRunConfigDocument(document, command);
  return mergeRunConfigSections(root, commandSection);
}
