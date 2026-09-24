import {
  ApplicationInterface,
  type ArchiElementCreateIntent,
} from "../archimate-model/elements/archi-element.js";
import type { DiscoveryEntityRecord } from "../code-inventory/entities/entity-types.js";
import type { HttpApiContractRecord } from "../code-inventory/entities/http-api-contract.js";
import { RestApiContractInterfaceProfile } from "../archimate-model/profiles/profile.js";
import { standardGenerateElementProperties } from "./archi-element-properties.js";
import { withEntityDebugProperties } from "./generate-debug.js";
import {
  httpApiContractInterfaceId,
  httpApiContractInterfaceLogicalId,
} from "./rest-controller-elements.js";

const MISSING_CONTRACT_NAME = "API contract";

export function buildHttpApiContractInterfaceIntent(input: {
  contractId: string;
  contract: HttpApiContractRecord | undefined;
  folderId: string;
  generatorCoordinate: string;
}): ArchiElementCreateIntent {
  const interfaceId = httpApiContractInterfaceId(input.contractId);
  const interfaceLogicalId = httpApiContractInterfaceLogicalId(input.contractId);
  const interfaceName = input.contract?.simpleName ?? MISSING_CONTRACT_NAME;
  const basis = input.contract?.basis ?? "extract";
  const confidence = input.contract?.confidence;

  let interfaceBuilder = ApplicationInterface.withId(interfaceId)
    .name(interfaceName)
    .inFolder(input.folderId)
    .profiles(RestApiContractInterfaceProfile.create().id);

  for (const property of standardGenerateElementProperties({
    logicalId: interfaceLogicalId,
    generatorCoordinate: input.generatorCoordinate,
    slot: "rest-api-contract-interface",
    basis,
    confidence,
  })) {
    interfaceBuilder = interfaceBuilder.property(property.key, property.value);
  }

  const debugSources =
    input.contract === undefined
      ? []
      : [
          {
            entityType: "HttpApiContract" as const,
            record: input.contract as unknown as DiscoveryEntityRecord,
          },
        ];

  return withEntityDebugProperties(interfaceBuilder.build().toCreateIntent(), debugSources);
}

/** @deprecated Use buildHttpApiContractInterfaceIntent */
export function buildExtractHttpApiContractInterfaceIntent(
  input: Parameters<typeof buildHttpApiContractInterfaceIntent>[0],
): ArchiElementCreateIntent {
  return buildHttpApiContractInterfaceIntent(input);
}
