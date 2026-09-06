import type { RunConfigResolution } from "./run-config-types.js";
import { EMPTY_RUN_CONFIG_RESOLUTION } from "./run-config-types.js";

let currentRunConfigResolution: RunConfigResolution = EMPTY_RUN_CONFIG_RESOLUTION;

export function setRunConfigResolution(resolution: RunConfigResolution): void {
  currentRunConfigResolution = resolution;
}

export function getRunConfigResolution(): RunConfigResolution {
  return currentRunConfigResolution;
}

export function resetRunConfigResolutionForTests(): void {
  currentRunConfigResolution = EMPTY_RUN_CONFIG_RESOLUTION;
}
