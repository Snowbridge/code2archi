export interface RunConfigResolution {
  readonly path: string;
  readonly name: string;
  readonly loaded: boolean;
}

export const EMPTY_RUN_CONFIG_RESOLUTION: RunConfigResolution = {
  path: "none",
  name: "none",
  loaded: false,
};

export type RunConfigCommandName = "scan" | "generate" | "list";

export type RunConfigValues = Record<string, unknown>;
