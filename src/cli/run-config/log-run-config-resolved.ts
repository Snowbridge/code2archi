import { getLogger } from "../../platform/logging/index.js";
import type { RunConfigResolution } from "./run-config-types.js";

export function logRunConfigResolved(runConfig: RunConfigResolution): void {
  getLogger("cli.bootstrap").info("run-config resolved", {
    path: runConfig.path,
    name: runConfig.name,
  });
}
