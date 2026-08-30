import type { ArchiProperty } from "../elements/archi-element.js";
import type { RelationType } from "../relation-types.js";

export interface ArchiRelationshipFields {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly properties?: readonly ArchiProperty[];
  readonly profileIds?: readonly string[];
}

export interface ArchiRelationshipCreateIntent extends ArchiRelationshipFields {
  readonly relationType: RelationType;
}

export abstract class ArchiRelationship {
  readonly id: string;
  readonly relationType: RelationType;
  readonly sourceId: string;
  readonly targetId: string;
  readonly properties?: readonly ArchiProperty[];
  readonly profileIds?: readonly string[];

  protected constructor(relationType: RelationType, fields: ArchiRelationshipFields) {
    this.relationType = relationType;
    this.id = fields.id;
    this.sourceId = fields.sourceId;
    this.targetId = fields.targetId;
    if (fields.properties !== undefined && fields.properties.length > 0) {
      this.properties = [...fields.properties];
    }
    if (fields.profileIds !== undefined && fields.profileIds.length > 0) {
      this.profileIds = [...fields.profileIds];
    }
  }

  toCreateIntent(): ArchiRelationshipCreateIntent {
    return {
      id: this.id,
      relationType: this.relationType,
      sourceId: this.sourceId,
      targetId: this.targetId,
      ...(this.properties && this.properties.length > 0
        ? { properties: [...this.properties] }
        : {}),
      ...(this.profileIds && this.profileIds.length > 0
        ? { profileIds: [...this.profileIds] }
        : {}),
    };
  }
}

class RelationBuilder<T extends RelationType> {
  private sourceIdValue = "";
  private targetIdValue = "";
  private propertiesValue: ArchiProperty[] = [];
  private profileIdsValue: string[] = [];

  constructor(
    private readonly relationType: T,
    private readonly idValue: string,
  ) {}

  source(elementId: string): this {
    this.sourceIdValue = elementId;
    return this;
  }

  target(elementId: string): this {
    this.targetIdValue = elementId;
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

  build(): TypedRelationship<T> {
    if (!this.idValue) {
      throw new Error(`Relationship ${this.relationType} is missing id`);
    }
    if (!this.sourceIdValue) {
      throw new Error(`Relationship ${this.relationType} is missing sourceId`);
    }
    if (!this.targetIdValue) {
      throw new Error(`Relationship ${this.relationType} is missing targetId`);
    }

    return new TypedRelationship(this.relationType, {
      id: this.idValue,
      sourceId: this.sourceIdValue,
      targetId: this.targetIdValue,
      ...(this.propertiesValue.length > 0 ? { properties: [...this.propertiesValue] } : {}),
      ...(this.profileIdsValue.length > 0 ? { profileIds: [...this.profileIdsValue] } : {}),
    });
  }
}

class TypedRelationship<T extends RelationType> extends ArchiRelationship {
  constructor(relationType: T, fields: ArchiRelationshipFields) {
    super(relationType, fields);
  }
}

function defineRelationClass<T extends RelationType>(relationType: T) {
  class NamedRelation extends TypedRelationship<T> {
    static readonly RELATION_TYPE = relationType;

    constructor(fields: ArchiRelationshipFields) {
      super(relationType, fields);
    }

    static withId(id: string): RelationBuilder<T> {
      return new RelationBuilder(relationType, id);
    }
  }

  return NamedRelation;
}

export const AccessRelationship = defineRelationClass("AccessRelationship");
export const AssociationRelationship = defineRelationClass("AssociationRelationship");
export const CompositionRelationship = defineRelationClass("CompositionRelationship");
export const FlowRelationship = defineRelationClass("FlowRelationship");
export const RealizationRelationship = defineRelationClass("RealizationRelationship");
export const ServingRelationship = defineRelationClass("ServingRelationship");
export const TriggeringRelationship = defineRelationClass("TriggeringRelationship");
