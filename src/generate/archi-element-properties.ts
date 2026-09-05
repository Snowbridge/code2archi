import type { ArchiProperty } from "../archimate-model/elements/archi-element.js";
import { recordSlotGenerated } from "../platform/profiling/index.js";
import { packageVersion } from "../package-version.js";

export type GenerateBasis = "extract" | "inference";

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
  | "rest-client"
  | "app-module-realizes-rest-client"
  | "direct-rest-requests-serving";

export interface StandardGenerateElementPropertiesInput {
  readonly logicalId: string;
  readonly generatorCoordinate: string;
  readonly slot: ElementSlotId;
  readonly basis?: GenerateBasis;
  readonly confidence?: number;
}

export function standardGenerateElementProperties(
  input: StandardGenerateElementPropertiesInput,
): readonly ArchiProperty[] {
  recordSlotGenerated(input.slot);

  const properties: ArchiProperty[] = [
    { key: "c2a:Id", value: input.logicalId },
    { key: "c2a:basis", value: input.basis ?? "extract" },
    { key: "c2a:schema", value: packageVersion },
    { key: "c2a:generator", value: input.generatorCoordinate },
    { key: "c2a:slot", value: input.slot },
  ];

  if (input.confidence !== undefined) {
    properties.push({
      key: "c2a:confidence",
      value: String(input.confidence),
    });
  }

  return properties;
}
