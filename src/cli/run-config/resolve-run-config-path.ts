import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CliError } from "../cli-error.js";

export const GLOBAL_RUN_CONFIG_RELATIVE = path.join(".config", "code2archi", "code2archi.yaml");
export const LOCAL_RUN_CONFIG_FILENAME = "code2archi.yaml";

export interface ResolveRunConfigPathInput {
  readonly cwd: string;
  readonly configFlagValue: string | undefined;
  readonly homedir?: string;
}

export function resolveGlobalRunConfigPath(homedir: string = os.homedir()): string {
  return path.join(homedir, GLOBAL_RUN_CONFIG_RELATIVE);
}

export function resolveLocalRunConfigPath(cwd: string): string {
  return path.join(cwd, LOCAL_RUN_CONFIG_FILENAME);
}

export function resolveRunConfigPath(input: ResolveRunConfigPathInput): string | undefined {
  if (input.configFlagValue !== undefined) {
    if (input.configFlagValue === "none") {
      return undefined;
    }

    const resolved = path.resolve(input.cwd, input.configFlagValue);
    if (!existsSync(resolved)) {
      throw new CliError(`Run-config file not found: ${resolved}`);
    }
    return resolved;
  }

  const localPath = resolveLocalRunConfigPath(input.cwd);
  if (existsSync(localPath)) {
    return localPath;
  }

  const globalPath = resolveGlobalRunConfigPath(input.homedir);
  if (existsSync(globalPath)) {
    return globalPath;
  }

  return undefined;
}
