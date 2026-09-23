import { computeArchiId } from "../archimate-model/archi-id.js";
import { applicationComponentIdForModule } from "./application-module-components.js";

export const REST_CONTROLLER_SERVICE_ID_PREFIX = "restcontroller:";
export const REST_CLIENT_SERVICE_ID_PREFIX = "restclient:";
export const HTTP_API_CONTRACT_INTERFACE_ID_PREFIX = "httpapicontract:";

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

export function libRestClientAggregationLogicalId(
  consumerModuleId: string,
  restClientId: string,
): string {
  return `aggregation:lib-rest-client:${consumerModuleId}:${restClientId}`;
}

export function libRestClientAggregationId(
  consumerModuleId: string,
  restClientId: string,
): string {
  const consumerComponentId = applicationComponentIdForModule(consumerModuleId);
  const serviceId = restClientAppServiceId(restClientId);
  return computeArchiId("AggregationRelationship", consumerComponentId, serviceId);
}

export function restApiContractAssignmentLogicalId(
  interfaceLogicalId: string,
  restControllerId: string,
): string {
  return `assignment:rest-api-contract:${interfaceLogicalId}:${restControllerId}`;
}

export function restApiContractAssignmentId(
  interfaceId: string,
  serviceId: string,
): string {
  return computeArchiId("AssignmentRelationship", interfaceId, serviceId);
}

export function restControllerServesRestClientLogicalId(
  restControllerId: string,
  restClientId: string,
): string {
  return `serving:rest-controller-rest-client:${restControllerId}:${restClientId}`;
}

export function restControllerServesRestClientId(
  controllerServiceId: string,
  clientServiceId: string,
): string {
  return computeArchiId("ServingRelationship", controllerServiceId, clientServiceId);
}

export function restControllerServesAppComponentLogicalId(
  restControllerId: string,
  contractId: string,
  consumerModuleId: string,
): string {
  return `serving:rest-controller-app-component:${restControllerId}:${contractId}:${consumerModuleId}`;
}

export function restControllerServesAppComponentId(
  controllerServiceId: string,
  consumerComponentId: string,
  contractId: string,
): string {
  return computeArchiId(
    "ServingRelationship",
    controllerServiceId,
    consumerComponentId,
    contractId,
  );
}
