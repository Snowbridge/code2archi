export const BUSINESS_CONCEPT_TYPES = [
  "BusinessActor",
  "BusinessRole",
  "BusinessCollaboration",
  "BusinessInterface",
  "BusinessProcess",
  "BusinessFunction",
  "BusinessInteraction",
  "BusinessEvent",
  "BusinessService",
  "BusinessObject",
  "Contract",
  "Representation",
  "Product",
] as const;

export const APPLICATION_CONCEPT_TYPES = [
  "ApplicationComponent",
  "ApplicationCollaboration",
  "ApplicationInterface",
  "ApplicationFunction",
  "ApplicationInteraction",
  "ApplicationProcess",
  "ApplicationEvent",
  "ApplicationService",
  "DataObject",
] as const;

export const TECHNOLOGY_CONCEPT_TYPES = [
  "Node",
  "Device",
  "SystemSoftware",
  "TechnologyCollaboration",
  "TechnologyInterface",
  "Path",
  "CommunicationNetwork",
  "TechnologyFunction",
  "TechnologyProcess",
  "TechnologyInteraction",
  "TechnologyEvent",
  "TechnologyService",
  "Artifact",
  "Equipment",
  "Facility",
  "DistributionNetwork",
  "Material",
] as const;

export const VIEW_CONCEPT_TYPES = ["ArchimateDiagramModel"] as const;

export const CONCEPT_TYPES = [
  ...BUSINESS_CONCEPT_TYPES,
  ...APPLICATION_CONCEPT_TYPES,
  ...TECHNOLOGY_CONCEPT_TYPES,
  ...VIEW_CONCEPT_TYPES,
] as const;

export type ConceptType = (typeof CONCEPT_TYPES)[number];

export type PredefinedFolderKey =
  | "business"
  | "application"
  | "technology"
  | "relations"
  | "diagrams";

export interface PredefinedFolderDef {
  readonly key: PredefinedFolderKey;
  readonly xmlName: string;
  readonly xmlType: string;
}

export const PREDEFINED_FOLDERS: readonly PredefinedFolderDef[] = [
  { key: "business", xmlName: "Business", xmlType: "business" },
  { key: "application", xmlName: "Application", xmlType: "application" },
  {
    key: "technology",
    xmlName: "Technology & Physical",
    xmlType: "technology",
  },
  { key: "relations", xmlName: "Relations", xmlType: "relations" },
  { key: "diagrams", xmlName: "Views", xmlType: "diagrams" },
];

const CONCEPT_TYPE_SET = new Set<string>(CONCEPT_TYPES);

export function isConceptType(value: string): value is ConceptType {
  return CONCEPT_TYPE_SET.has(value);
}

export function getConceptLayer(
  conceptType: ConceptType,
): PredefinedFolderKey | undefined {
  if ((BUSINESS_CONCEPT_TYPES as readonly string[]).includes(conceptType)) {
    return "business";
  }
  if ((APPLICATION_CONCEPT_TYPES as readonly string[]).includes(conceptType)) {
    return "application";
  }
  if ((TECHNOLOGY_CONCEPT_TYPES as readonly string[]).includes(conceptType)) {
    return "technology";
  }
  if ((VIEW_CONCEPT_TYPES as readonly string[]).includes(conceptType)) {
    return "diagrams";
  }
  return undefined;
}

export function archimateXsiType(conceptType: ConceptType): string {
  return `archimate:${conceptType}`;
}
