import type { ConceptType } from "../concept-types.js";

export interface ArchiProperty {
  readonly key: string;
  readonly value: string;
}

export interface ArchiElementCreateIntent {
  readonly id: string;
  readonly conceptType: ConceptType;
  readonly name: string;
  readonly folderId: string;
  readonly documentation?: string;
  readonly properties?: readonly ArchiProperty[];
  readonly profileIds?: readonly string[];
}

export interface ArchiElement extends ArchiElementCreateIntent {}

export class ArchiElementBuilder {
  private readonly conceptType: ConceptType;
  private idValue = "";
  private nameValue = "";
  private folderIdValue = "";
  private documentationValue?: string;
  private propertiesValue: ArchiProperty[] = [];
  private profileIdsValue: string[] = [];

  private constructor(conceptType: ConceptType) {
    this.conceptType = conceptType;
  }

  static forConcept(conceptType: ConceptType): ArchiElementBuilder {
    return new ArchiElementBuilder(conceptType);
  }

  withId(id: string): this {
    this.idValue = id;
    return this;
  }

  name(name: string): this {
    this.nameValue = name;
    return this;
  }

  inFolder(folderId: string): this {
    this.folderIdValue = folderId;
    return this;
  }

  documentation(documentation: string): this {
    this.documentationValue = documentation;
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

  build(): ArchiElement {
    if (!this.idValue) {
      throw new Error(`Element ${this.conceptType} is missing id`);
    }
    if (!this.nameValue) {
      throw new Error(`Element ${this.conceptType} is missing name`);
    }
    if (!this.folderIdValue) {
      throw new Error(`Element ${this.conceptType} is missing folderId`);
    }

    const element: ArchiElement = {
      id: this.idValue,
      conceptType: this.conceptType,
      name: this.nameValue,
      folderId: this.folderIdValue,
      ...(this.documentationValue ? { documentation: this.documentationValue } : {}),
      ...(this.propertiesValue.length > 0 ? { properties: [...this.propertiesValue] } : {}),
      ...(this.profileIdsValue.length > 0 ? { profileIds: [...this.profileIdsValue] } : {}),
    };

    return Object.freeze(element);
  }
}

function defineConceptBuilder<T extends ConceptType>(conceptType: T) {
  class ConceptBuilder {
    readonly inner: ArchiElementBuilder;

    constructor(inner: ArchiElementBuilder) {
      this.inner = inner;
    }

    static withId(id: string): ConceptBuilder {
      return new ConceptBuilder(
        ArchiElementBuilder.forConcept(conceptType).withId(id),
      );
    }

    name(value: string): this {
      this.inner.name(value);
      return this;
    }

    inFolder(folderId: string): this {
      this.inner.inFolder(folderId);
      return this;
    }

    documentation(value: string): this {
      this.inner.documentation(value);
      return this;
    }

    property(key: string, value: string): this {
      this.inner.property(key, value);
      return this;
    }

    profiles(...profileIds: string[]): this {
      this.inner.profiles(...profileIds);
      return this;
    }

    build(): ArchiElement {
      return this.inner.build();
    }
  }

  return ConceptBuilder;
}

export const BusinessActorBuilder = defineConceptBuilder("BusinessActor");
export const BusinessRoleBuilder = defineConceptBuilder("BusinessRole");
export const BusinessCollaborationBuilder = defineConceptBuilder("BusinessCollaboration");
export const BusinessInterfaceBuilder = defineConceptBuilder("BusinessInterface");
export const BusinessProcessBuilder = defineConceptBuilder("BusinessProcess");
export const BusinessFunctionBuilder = defineConceptBuilder("BusinessFunction");
export const BusinessInteractionBuilder = defineConceptBuilder("BusinessInteraction");
export const BusinessEventBuilder = defineConceptBuilder("BusinessEvent");
export const BusinessServiceBuilder = defineConceptBuilder("BusinessService");
export const BusinessObjectBuilder = defineConceptBuilder("BusinessObject");
export const ContractBuilder = defineConceptBuilder("Contract");
export const RepresentationBuilder = defineConceptBuilder("Representation");
export const ProductBuilder = defineConceptBuilder("Product");

export const ApplicationComponentBuilder = defineConceptBuilder("ApplicationComponent");
export const ApplicationCollaborationBuilder =
  defineConceptBuilder("ApplicationCollaboration");
export const ApplicationInterfaceBuilder = defineConceptBuilder("ApplicationInterface");
export const ApplicationFunctionBuilder = defineConceptBuilder("ApplicationFunction");
export const ApplicationInteractionBuilder = defineConceptBuilder("ApplicationInteraction");
export const ApplicationProcessBuilder = defineConceptBuilder("ApplicationProcess");
export const ApplicationEventBuilder = defineConceptBuilder("ApplicationEvent");
export const ApplicationServiceBuilder = defineConceptBuilder("ApplicationService");
export const DataObjectBuilder = defineConceptBuilder("DataObject");

export const NodeBuilder = defineConceptBuilder("Node");
export const DeviceBuilder = defineConceptBuilder("Device");
export const SystemSoftwareBuilder = defineConceptBuilder("SystemSoftware");
export const TechnologyCollaborationBuilder =
  defineConceptBuilder("TechnologyCollaboration");
export const TechnologyInterfaceBuilder = defineConceptBuilder("TechnologyInterface");
export const PathBuilder = defineConceptBuilder("Path");
export const CommunicationNetworkBuilder = defineConceptBuilder("CommunicationNetwork");
export const TechnologyFunctionBuilder = defineConceptBuilder("TechnologyFunction");
export const TechnologyProcessBuilder = defineConceptBuilder("TechnologyProcess");
export const TechnologyInteractionBuilder = defineConceptBuilder("TechnologyInteraction");
export const TechnologyEventBuilder = defineConceptBuilder("TechnologyEvent");
export const TechnologyServiceBuilder = defineConceptBuilder("TechnologyService");
export const ArtifactBuilder = defineConceptBuilder("Artifact");
export const EquipmentBuilder = defineConceptBuilder("Equipment");
export const FacilityBuilder = defineConceptBuilder("Facility");
export const DistributionNetworkBuilder = defineConceptBuilder("DistributionNetwork");
export const MaterialBuilder = defineConceptBuilder("Material");

export const ArchimateDiagramModelBuilder = defineConceptBuilder("ArchimateDiagramModel");
