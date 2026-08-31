import type { ArchiProperty } from "../archimate-model/elements/archi-element.js";
import { packageVersion } from "../package-version.js";

export interface StandardGenerateElementPropertiesInput {
  readonly logicalId: string;
  readonly generatorCoordinate: string;
}

export function standardGenerateElementProperties(
  input: StandardGenerateElementPropertiesInput,
): readonly ArchiProperty[] {
  return [
    { key: "c2a:Id", value: input.logicalId },
    { key: "c2a:confidence", value: "confirmed" },
    { key: "c2a:schema", value: packageVersion },
    { key: "c2a:generator", value: input.generatorCoordinate },
  ];
}
