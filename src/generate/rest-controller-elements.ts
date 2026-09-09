import { computeArchiId } from "../archimate-model/archi-id.js";
import { applicationComponentIdForModule } from "./application-module-components.js";

export const INFERRED_REST_API_CONFIDENCE = 0.854321;

export const REST_CONTROLLER_SERVICE_ID_PREFIX = "restcontroller:";
export const REST_CLIENT_SERVICE_ID_PREFIX = "restclient:";
export const HTTP_API_CONTRACT_INTERFACE_ID_PREFIX = "httpapicontract:";
export const INFERRED_REST_API_INTERFACE_ID_PREFIX = "inferred-rest-api:";

export interface ParsedHttpEndpoint {
  readonly method: string;
  readonly path: string;
}

export function parseHttpEndpoint(endpoint: string): ParsedHttpEndpoint | undefined {
  const spaceIndex = endpoint.indexOf(" ");
  if (spaceIndex <= 0 || spaceIndex === endpoint.length - 1) {
    return undefined;
  }

  return {
    method: endpoint.slice(0, spaceIndex),
    path: endpoint.slice(spaceIndex + 1),
  };
}

export function isInfrastructureEndpoint(method: string, path: string): boolean {
  if (method !== "GET") {
    return false;
  }

  return path === "/" || path.startsWith("/management/") || path.startsWith("/actuator/");
}

export function isInfrastructureEndpointString(endpoint: string): boolean {
  const parsed = parseHttpEndpoint(endpoint);
  if (parsed === undefined) {
    return false;
  }

  return isInfrastructureEndpoint(parsed.method, parsed.path);
}

export function businessEndpointsFrom(endpoints: readonly string[]): string[] {
  return [...endpoints]
    .filter((endpoint) => !isInfrastructureEndpointString(endpoint))
    .sort((left, right) => left.localeCompare(right));
}

export function restControllerAppServiceId(restControllerId: string): string {
  return computeArchiId("ApplicationService", "restcontroller", restControllerId);
}

export function restControllerAppServiceLogicalId(restControllerId: string): string {
  return `${REST_CONTROLLER_SERVICE_ID_PREFIX}${restControllerId}`;
}

export function httpApiContractInterfaceId(contractId: string): string {
  return computeArchiId("ApplicationInterface", "httpapicontract", contractId);
}

export function httpApiContractInterfaceLogicalId(contractId: string): string {
  return `${HTTP_API_CONTRACT_INTERFACE_ID_PREFIX}${contractId}`;
}

export function inferredRestApiContractInterfaceId(restControllerId: string): string {
  return computeArchiId("ApplicationInterface", "inferred-rest-api", restControllerId);
}

export function inferredRestApiContractInterfaceLogicalId(restControllerId: string): string {
  return `${INFERRED_REST_API_INTERFACE_ID_PREFIX}${restControllerId}`;
}

export function appModuleRealizesRestControllerLogicalId(
  applicationModuleId: string,
  restControllerId: string,
): string {
  return `realization:app-module-rest-controller:${applicationModuleId}:${restControllerId}`;
}

export function appModuleRealizesRestControllerId(
  applicationModuleId: string,
  restControllerId: string,
): string {
  const appComponentId = applicationComponentIdForModule(applicationModuleId);
  const serviceId = restControllerAppServiceId(restControllerId);
  return computeArchiId("RealizationRelationship", appComponentId, serviceId);
}

export function restClientAppServiceId(restClientId: string): string {
  return computeArchiId("ApplicationService", "restclient", restClientId);
}

export function restClientAppServiceLogicalId(restClientId: string): string {
  return `${REST_CLIENT_SERVICE_ID_PREFIX}${restClientId}`;
}

export function appModuleRealizesRestClientLogicalId(
  applicationModuleId: string,
  restClientId: string,
): string {
  return `realization:app-module-rest-client:${applicationModuleId}:${restClientId}`;
}

export function appModuleRealizesRestClientId(
  applicationModuleId: string,
  restClientId: string,
): string {
  const appComponentId = applicationComponentIdForModule(applicationModuleId);
  const serviceId = restClientAppServiceId(restClientId);
  return computeArchiId("RealizationRelationship", appComponentId, serviceId);
}

export function restApiContractAssignmentLogicalId(
  interfaceLogicalId: string,
  restControllerId: string,
): string {
  return `assignment:rest-api-contract:${interfaceLogicalId}:${restControllerId}`;
}

export function restApiContractAssignmentLogicalIdForRestClient(
  interfaceLogicalId: string,
  restClientId: string,
): string {
  return `assignment:rest-api-contract:${interfaceLogicalId}:${restClientId}`;
}

export function restApiContractAssignmentId(
  interfaceId: string,
  serviceId: string,
): string {
  return computeArchiId("AssignmentRelationship", interfaceId, serviceId);
}

export function inferredRestApiContractName(simpleName: string): string {
  return `Inferred REST API (${simpleName})`;
}
