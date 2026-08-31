import type { ArchiProperty } from "../archimate-model/elements/archi-element.js";
import type { ArchiElementCreateIntent } from "../archimate-model/elements/archi-element.js";
import type { DiscoveryEntityRecord, EntityType } from "../discovery-model/entities/entity-types.js";
import { isDebugEnabled } from "../platform/logging/index.js";

export interface EntityDebugSource {
  readonly entityType: EntityType;
  readonly record: DiscoveryEntityRecord;
}

function serializeDebugPropertyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function entityDebugProperties(sources: readonly EntityDebugSource[]): ArchiProperty[] {
  if (!isDebugEnabled()) {
    return [];
  }

  const properties: ArchiProperty[] = [];
  for (const source of sources) {
    for (const [fieldName, fieldValue] of Object.entries(source.record)) {
      properties.push({
        key: `c2a-debug:${source.entityType}:${fieldName}`,
        value: serializeDebugPropertyValue(fieldValue),
      });
    }
  }
  return properties;
}

export function withEntityDebugProperties(
  intent: ArchiElementCreateIntent,
  sources: readonly EntityDebugSource[],
): ArchiElementCreateIntent {
  const debugProperties = entityDebugProperties(sources);
  if (debugProperties.length === 0) {
    return intent;
  }

  return {
    ...intent,
    properties: [...(intent.properties ?? []), ...debugProperties],
  };
}
