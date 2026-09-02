import type { EntityType } from "../../src/discovery-model/entities/entity-types.js";

export interface ProcessorInfo {
  readonly coordinate: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly description: string;
}

export interface ElementSlotInfo {
  readonly slotId: string;
  readonly kind: string;
  readonly processorCoordinate: string;
  readonly label: string;
}

export interface ImplementationStatus {
  readonly implementedCommands: readonly string[];
  readonly specifiedCommands: readonly string[];
  readonly processors: readonly ProcessorInfo[];
  readonly scanEntityTypes: ReadonlySet<EntityType>;
  readonly allEntityTypes: readonly EntityType[];
  readonly elementSlots: readonly ElementSlotInfo[];
  readonly implementedElementSlotIds: ReadonlySet<string>;
  readonly hasViewProcessors: boolean;
  readonly hasPluginHost: boolean;
  readonly documentationAvailable: boolean;
}

export interface GapRow {
  readonly area: string;
  readonly intent: string;
  readonly capabilityLink?: string;
  readonly currentState: string;
  readonly complete: boolean;
}
