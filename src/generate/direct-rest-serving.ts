import { computeArchiId } from "../archimate-model/archi-id.js";
import { applicationComponentIdForModule } from "./application-module-components.js";

const DIRECT_REST_SERVING_ID_SUFFIX = "direct-rest";

export function directRestServingRelationshipId(
  sourceApplicationComponentId: string,
  targetApplicationComponentId: string,
): string {
  return computeArchiId(
    "ServingRelationship",
    sourceApplicationComponentId,
    targetApplicationComponentId,
    DIRECT_REST_SERVING_ID_SUFFIX,
  );
}

export function directRestServingLogicalId(
  sourceApplicationModuleId: string,
  targetApplicationModuleId: string,
): string {
  return `serving:direct-rest:${sourceApplicationModuleId}:${targetApplicationModuleId}`;
}

export function directRestServingSourceId(sourceApplicationModuleId: string): string {
  return applicationComponentIdForModule(sourceApplicationModuleId);
}

export function directRestServingTargetId(targetApplicationModuleId: string): string {
  return applicationComponentIdForModule(targetApplicationModuleId);
}

export type DirectRestRequestsServingMatchMethod = "INTERFACE" | "DTO" | "ENDPOINT";

const MATCH_METHOD_PRIORITY: Readonly<Record<DirectRestRequestsServingMatchMethod, number>> = {
  INTERFACE: 3,
  DTO: 2,
  ENDPOINT: 1,
};

export interface DirectRestServingMatchLike {
  readonly id: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: DirectRestRequestsServingMatchMethod;
  readonly confidence: "confirmed" | "inferred" | "unknown";
  readonly confidenceScore: number;
}

export function modulePairKey(
  sourceApplicationModuleId: string,
  targetApplicationModuleId: string,
): string {
  return `${sourceApplicationModuleId}\u0000${targetApplicationModuleId}`;
}

export function compareDirectRestServingMatches(
  left: DirectRestServingMatchLike,
  right: DirectRestServingMatchLike,
): number {
  if (left.confidenceScore !== right.confidenceScore) {
    return right.confidenceScore - left.confidenceScore;
  }

  const leftPriority = MATCH_METHOD_PRIORITY[left.matchMethod];
  const rightPriority = MATCH_METHOD_PRIORITY[right.matchMethod];
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  return left.id.localeCompare(right.id);
}

export function selectBestDirectRestServingMatches(
  matches: readonly DirectRestServingMatchLike[],
): DirectRestServingMatchLike[] {
  const bestByModulePair = new Map<string, DirectRestServingMatchLike>();

  for (const match of matches) {
    const key = modulePairKey(match.sourceApplicationModuleId, match.targetApplicationModuleId);
    const currentBest = bestByModulePair.get(key);
    if (currentBest === undefined || compareDirectRestServingMatches(match, currentBest) < 0) {
      bestByModulePair.set(key, match);
    }
  }

  return [...bestByModulePair.values()].sort((left, right) => {
    const moduleCompare = modulePairKey(
      left.sourceApplicationModuleId,
      left.targetApplicationModuleId,
    ).localeCompare(
      modulePairKey(right.sourceApplicationModuleId, right.targetApplicationModuleId),
    );
    if (moduleCompare !== 0) {
      return moduleCompare;
    }

    return compareDirectRestServingMatches(left, right);
  });
}
