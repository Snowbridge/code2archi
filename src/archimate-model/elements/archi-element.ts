import type { ConceptType } from "../concept-types.js";
import type {
  ArchiDiagramObject,
  ArchimateDiagramModelFields,
} from "../diagrams/archi-diagram-content.js";

export interface ArchiProperty {
  readonly key: string;
  readonly value: string;
}

export interface ArchiElementFields {
  readonly id: string;
  readonly name: string;
  readonly folderId: string;
  readonly documentation?: string;
  readonly properties?: readonly ArchiProperty[];
  readonly profileIds?: readonly string[];
}

export interface ArchiElementCreateIntent extends ArchiElementFields {
  readonly conceptType: ConceptType;
  readonly viewpoint?: string;
  readonly diagramObjects?: readonly ArchiDiagramObject[];
}

export abstract class ArchiElement {
  readonly id: string;
  readonly conceptType: ConceptType;
  readonly name: string;
  readonly folderId: string;
  readonly documentation?: string;
  readonly properties?: readonly ArchiProperty[];
  readonly profileIds?: readonly string[];
  readonly viewpoint?: string;
  readonly diagramObjects?: readonly ArchiDiagramObject[];

  protected constructor(conceptType: ConceptType, fields: ArchiElementFields, diagram?: ArchimateDiagramModelFields) {
    this.conceptType = conceptType;
    this.id = fields.id;
    this.name = fields.name;
    this.folderId = fields.folderId;
    if (fields.documentation !== undefined) {
      this.documentation = fields.documentation;
    }
    if (fields.properties !== undefined && fields.properties.length > 0) {
      this.properties = [...fields.properties];
    }
    if (fields.profileIds !== undefined && fields.profileIds.length > 0) {
      this.profileIds = [...fields.profileIds];
    }
    if (diagram !== undefined) {
      this.viewpoint = diagram.viewpoint;
      this.diagramObjects = [...diagram.diagramObjects];
    }
  }

  toCreateIntent(): ArchiElementCreateIntent {
    return {
      id: this.id,
      conceptType: this.conceptType,
      name: this.name,
      folderId: this.folderId,
      ...(this.documentation ? { documentation: this.documentation } : {}),
      ...(this.properties && this.properties.length > 0
        ? { properties: [...this.properties] }
        : {}),
      ...(this.profileIds && this.profileIds.length > 0
        ? { profileIds: [...this.profileIds] }
        : {}),
      ...(this.viewpoint ? { viewpoint: this.viewpoint } : {}),
      ...(this.diagramObjects && this.diagramObjects.length > 0
        ? { diagramObjects: [...this.diagramObjects] }
        : {}),
    };
  }
}

class ConceptElementBuilder<T extends ConceptType> {
  private nameValue = "";
  private folderIdValue = "";
  private documentationValue?: string;
  private propertiesValue: ArchiProperty[] = [];
  private profileIdsValue: string[] = [];

  constructor(
    private readonly conceptType: T,
    private readonly idValue: string,
  ) {}

  name(value: string): this {
    this.nameValue = value;
    return this;
  }

  inFolder(folderId: string): this {
    this.folderIdValue = folderId;
    return this;
  }

  documentation(value: string): this {
    this.documentationValue = value;
    return this;
  }

  property(key: string, value: string): this {
    this.propertiesValue.push({ key, value });
    return this;
  }

  profiles(...profileIds: string[]): this {
    this.profileIdsValue.push(...profileIds);
    return this;
  }

  build(): ConceptElement<T> {
    if (!this.idValue) {
      throw new Error(`Element ${this.conceptType} is missing id`);
    }
    if (!this.nameValue) {
      throw new Error(`Element ${this.conceptType} is missing name`);
    }
    if (!this.folderIdValue) {
      throw new Error(`Element ${this.conceptType} is missing folderId`);
    }

    return new ConceptElement(this.conceptType, {
      id: this.idValue,
      name: this.nameValue,
      folderId: this.folderIdValue,
      ...(this.documentationValue ? { documentation: this.documentationValue } : {}),
      ...(this.propertiesValue.length > 0 ? { properties: [...this.propertiesValue] } : {}),
      ...(this.profileIdsValue.length > 0 ? { profileIds: [...this.profileIdsValue] } : {}),
    });
  }
}

class ConceptElement<T extends ConceptType> extends ArchiElement {
  constructor(
    conceptType: T,
    fields: ArchiElementFields,
    diagram?: ArchimateDiagramModelFields,
  ) {
    super(conceptType, fields, diagram);
  }
}

function defineConceptClass<T extends ConceptType>(conceptType: T) {
  class TypedConceptElement extends ConceptElement<T> {
    static readonly CONCEPT_TYPE = conceptType;

    constructor(fields: ArchiElementFields) {
      super(conceptType, fields);
    }

    static withId(id: string): ConceptElementBuilder<T> {
      return new ConceptElementBuilder(conceptType, id);
    }
  }

  return TypedConceptElement;
}

export const BusinessActor = defineConceptClass("BusinessActor");
export const BusinessRole = defineConceptClass("BusinessRole");
export const BusinessCollaboration = defineConceptClass("BusinessCollaboration");
export const BusinessInterface = defineConceptClass("BusinessInterface");
export const BusinessProcess = defineConceptClass("BusinessProcess");
export const BusinessFunction = defineConceptClass("BusinessFunction");
export const BusinessInteraction = defineConceptClass("BusinessInteraction");
export const BusinessEvent = defineConceptClass("BusinessEvent");
export const BusinessService = defineConceptClass("BusinessService");
export const BusinessObject = defineConceptClass("BusinessObject");
export const Contract = defineConceptClass("Contract");
export const Representation = defineConceptClass("Representation");
export const Product = defineConceptClass("Product");

export const ApplicationComponent = defineConceptClass("ApplicationComponent");
export const ApplicationCollaboration = defineConceptClass("ApplicationCollaboration");
export const ApplicationInterface = defineConceptClass("ApplicationInterface");
export const ApplicationFunction = defineConceptClass("ApplicationFunction");
export const ApplicationInteraction = defineConceptClass("ApplicationInteraction");
export const ApplicationProcess = defineConceptClass("ApplicationProcess");
export const ApplicationEvent = defineConceptClass("ApplicationEvent");
export const ApplicationService = defineConceptClass("ApplicationService");
export const DataObject = defineConceptClass("DataObject");

export const Node = defineConceptClass("Node");
export const Device = defineConceptClass("Device");
export const SystemSoftware = defineConceptClass("SystemSoftware");
export const TechnologyCollaboration = defineConceptClass("TechnologyCollaboration");
export const TechnologyInterface = defineConceptClass("TechnologyInterface");
export const Path = defineConceptClass("Path");
export const CommunicationNetwork = defineConceptClass("CommunicationNetwork");
export const TechnologyFunction = defineConceptClass("TechnologyFunction");
export const TechnologyProcess = defineConceptClass("TechnologyProcess");
export const TechnologyInteraction = defineConceptClass("TechnologyInteraction");
export const TechnologyEvent = defineConceptClass("TechnologyEvent");
export const TechnologyService = defineConceptClass("TechnologyService");
export const Artifact = defineConceptClass("Artifact");
export const Equipment = defineConceptClass("Equipment");
export const Facility = defineConceptClass("Facility");
export const DistributionNetwork = defineConceptClass("DistributionNetwork");
export const Material = defineConceptClass("Material");

class ArchimateDiagramModelBuilder {
  private nameValue = "";
  private folderIdValue = "";
  private documentationValue?: string;
  private propertiesValue: ArchiProperty[] = [];
  private viewpointValue = "";
  private diagramObjectsValue: ArchiDiagramObject[] = [];

  constructor(private readonly idValue: string) {}

  name(value: string): this {
    this.nameValue = value;
    return this;
  }

  inFolder(folderId: string): this {
    this.folderIdValue = folderId;
    return this;
  }

  documentation(value: string): this {
    this.documentationValue = value;
    return this;
  }

  property(key: string, value: string): this {
    this.propertiesValue.push({ key, value });
    return this;
  }

  viewpoint(value: string): this {
    this.viewpointValue = value;
    return this;
  }

  diagramObject(object: ArchiDiagramObject): this {
    this.diagramObjectsValue.push(object);
    return this;
  }

  build(): ConceptElement<"ArchimateDiagramModel"> {
    if (!this.idValue) {
      throw new Error("Element ArchimateDiagramModel is missing id");
    }
    if (!this.nameValue) {
      throw new Error("Element ArchimateDiagramModel is missing name");
    }
    if (!this.folderIdValue) {
      throw new Error("Element ArchimateDiagramModel is missing folderId");
    }
    if (!this.viewpointValue) {
      throw new Error("Element ArchimateDiagramModel is missing viewpoint");
    }

    return new ConceptElement(
      "ArchimateDiagramModel",
      {
        id: this.idValue,
        name: this.nameValue,
        folderId: this.folderIdValue,
        ...(this.documentationValue ? { documentation: this.documentationValue } : {}),
        ...(this.propertiesValue.length > 0 ? { properties: [...this.propertiesValue] } : {}),
      },
      {
        viewpoint: this.viewpointValue,
        diagramObjects: [...this.diagramObjectsValue],
      },
    );
  }
}

class ArchimateDiagramModelElement extends ConceptElement<"ArchimateDiagramModel"> {
  static readonly CONCEPT_TYPE = "ArchimateDiagramModel" as const;

  static withId(id: string): ArchimateDiagramModelBuilder {
    return new ArchimateDiagramModelBuilder(id);
  }
}

export const ArchimateDiagramModel = ArchimateDiagramModelElement;
