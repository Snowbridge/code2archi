import type { DiscoveryEntityBase } from "./entity-base.js";

export const ENTITY_TYPES = [
  "Repository",
  "BuildScript",
  "RuntimeEnvironment",
  "ApplicationModule",
  "RestController",
  "RestClient",
  "MessageConsumer",
  "MessageProducer",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface DiscoveryEntityRecord extends DiscoveryEntityBase {
  readonly [key: string]: unknown;
}

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
