import type { ArchiProperty } from "../archimate-model/elements/archi-element.js";
import { packageVersion } from "../package-version.js";

export type GenerateConfidence = "confirmed" | "inferred" | "unknown";

export type ElementSlotId =
  | "repo-artifact"
  | "module-artifact"
  | "syssoft-runtime"
  | "syssoft-build-system"
  | "syssoft-compiled"
  | "syssoft-assign"
  | "repo-module-composition"
  | "app-module-component"
  | "module-artifact-realizes"
  | "module-lib-aggregation"
  | "rest-controller"
  | "app-module-realizes-rest-controller"
  | "declared-rest-contract"
  | "declared-contract-assigned-to-rest-controller";

export interface StandardGenerateElementPropertiesInput {
  readonly logicalId: string;
  readonly generatorCoordinate: string;
  readonly slot: ElementSlotId;
  readonly confidence?: GenerateConfidence;
}

export function standardGenerateElementProperties(
  input: StandardGenerateElementPropertiesInput,
): readonly ArchiProperty[] {
  return [
    { key: "c2a:Id", value: input.logicalId },
    { key: "c2a:confidence", value: input.confidence ?? "confirmed" },
    { key: "c2a:schema", value: packageVersion },
    { key: "c2a:generator", value: input.generatorCoordinate },
    { key: "c2a:slot", value: input.slot },
  ];
}
