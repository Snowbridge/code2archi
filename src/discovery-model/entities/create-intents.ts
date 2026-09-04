import type { DiscoveryEntityCreateIntent } from "./entity-base.js";
import type { EntityType } from "./entity-types.js";
import type { Entity } from "./entity.js";
import type { DiscoveryLinkCreateIntent } from "../links/link-base.js";
import type { LinkType } from "../links/link-types.js";
import type { Link } from "../links/link.js";

export type CreateIntentRecord = DiscoveryEntityCreateIntent | Entity;

export type LinkCreateIntentRecord = DiscoveryLinkCreateIntent | Link;

export interface CreateIntents {
  readonly entities?: Partial<Record<EntityType, readonly CreateIntentRecord[]>>;
  readonly links?: Partial<Record<LinkType, readonly LinkCreateIntentRecord[]>>;
}
