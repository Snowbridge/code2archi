import type { DiscoveryEntityBase } from "./entity-base.js";

export const ENTITY_TYPES = [
  "Repository",
  "BuildScript",
  "RuntimeEnvironment",
  "ApplicationModule",
  "ApplicationModuleDependency",
  "RestController",
  "RestClient",
  "NodejsRestController",
  "NodejsRestClient",
  "MessageConsumer",
  "MessageProducer",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface DiscoveryEntityRecord extends DiscoveryEntityBase {
  readonly [key: string]: unknown;
}
