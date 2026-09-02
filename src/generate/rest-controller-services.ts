import { computeArchiId } from "../archimate-model/archi-id.js";

export function restControllerServiceLogicalId(restControllerId: string): string {
  return `restcontroller:${restControllerId}`;
}

export function restControllerRealizationLogicalId(
  moduleId: string,
  restControllerId: string,
): string {
  return `realization:app-module:${moduleId}:restcontroller:${restControllerId}`;
}

export function restControllerRealizationRelationshipId(
  appComponentId: string,
  restControllerId: string,
): string {
  return computeArchiId("RealizationRelationship", appComponentId, restControllerId);
}
