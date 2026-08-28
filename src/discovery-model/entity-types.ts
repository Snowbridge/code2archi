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

export interface DiscoveryEntityRecord {
  readonly id: string;
}

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
