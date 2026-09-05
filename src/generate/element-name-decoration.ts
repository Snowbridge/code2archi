import type { BuildSystem } from "../discovery-model/entities/application-module.js";
import type { GenerateOptions } from "../platform/processors/processor.js";

export type ElementNameSlot =
  | "repo-artifact"
  | "module-artifact"
  | "app-module-component"
  | "rest-api-contract";

export interface DecorateElementNameContext {
  readonly buildSystem?: BuildSystem;
  readonly isLibrary?: boolean;
}

const MODULE_ARTIFACT_SUFFIX_BY_BUILD_SYSTEM: Readonly<Record<BuildSystem, string>> = {
  maven: " (maven)",
  gradle: " (gradle)",
  npm: " (npm)",
};

const LIBRARY_SUFFIX = " (lib)";
const REST_API_CONTRACT_SUFFIX = " API Contract";

function appendSuffixIfAbsent(baseName: string, suffix: string): string {
  if (baseName.endsWith(suffix)) {
    return baseName;
  }
  return `${baseName}${suffix}`;
}

export function decorateElementName(
  slot: ElementNameSlot,
  baseName: string,
  context: DecorateElementNameContext,
  options: GenerateOptions,
): string {
  if (!options.decorate) {
    return baseName;
  }

  switch (slot) {
    case "repo-artifact":
      if (baseName.endsWith(".git")) {
        return baseName;
      }
      return `${baseName}.git`;
    case "module-artifact": {
      const buildSystem = context.buildSystem;
      if (buildSystem === undefined) {
        return baseName;
      }
      return appendSuffixIfAbsent(baseName, MODULE_ARTIFACT_SUFFIX_BY_BUILD_SYSTEM[buildSystem]);
    }
    case "app-module-component":
      if (!context.isLibrary) {
        return baseName;
      }
      return appendSuffixIfAbsent(baseName, LIBRARY_SUFFIX);
    case "rest-api-contract":
      return appendSuffixIfAbsent(baseName, REST_API_CONTRACT_SUFFIX);
  }
}
