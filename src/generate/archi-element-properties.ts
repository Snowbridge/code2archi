import type { ArchiProperty } from "../archimate-model/elements/archi-element.js";
import { recordSlotGenerated } from "../platform/profiling/index.js";
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
  | "declared-contract-assigned-to-rest-controller"
  | "declared-contract-assigned-to-rest-client"
  | "rest-client"
  | "app-module-realizes-rest-client"
  | "direct-rest-requests-serving"
  | "nodejs-rest-controller"
  | "nodejs-app-module-realizes-rest-controller"
  | "nodejs-declared-rest-contract"
  | "nodejs-declared-contract-assigned-to-rest-controller"
  | "nodejs-declared-contract-assigned-to-rest-client"
  | "nodejs-rest-client"
  | "nodejs-app-module-realizes-rest-client"
  | "nodejs-direct-rest-requests-serving";

export interface StandardGenerateElementPropertiesInput {
  readonly logicalId: string;
  readonly generatorCoordinate: string;
  readonly slot: ElementSlotId;
  readonly confidence?: GenerateConfidence;
  readonly confidenceScore?: number;
}

export function standardGenerateElementProperties(
  input: StandardGenerateElementPropertiesInput,
): readonly ArchiProperty[] {
  recordSlotGenerated(input.slot);

  const properties: ArchiProperty[] = [
    { key: "c2a:Id", value: input.logicalId },
    { key: "c2a:confidence", value: input.confidence ?? "confirmed" },
    { key: "c2a:schema", value: packageVersion },
    { key: "c2a:generator", value: input.generatorCoordinate },
    { key: "c2a:slot", value: input.slot },
  ];

  if (input.confidenceScore !== undefined) {
    properties.push({
      key: "c2a:confidenceScore",
      value: String(input.confidenceScore),
    });
  }

  return properties;
}
