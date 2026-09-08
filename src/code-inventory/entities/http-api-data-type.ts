import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface HttpApiDataTypeCreateIntent {
  readonly id: string;
  readonly simpleName: string;
  readonly fqcn: string;
}

export interface HttpApiDataTypeNaturalKeys {
  readonly fqcn: string;
}

export class HttpApiDataType extends Entity {
  private static readonly ENTITY_TYPE = "HttpApiDataType" as const;

  readonly simpleName: string;
  readonly fqcn: string;

  constructor(naturalKeys: HttpApiDataTypeNaturalKeys) {
    const simpleName = naturalKeys.fqcn.includes(".")
      ? naturalKeys.fqcn.slice(naturalKeys.fqcn.lastIndexOf(".") + 1)
      : naturalKeys.fqcn;
    super(HttpApiDataType.ENTITY_TYPE, [naturalKeys.fqcn]);
    this.simpleName = simpleName;
    this.fqcn = naturalKeys.fqcn;
  }

  static idForFqcn(fqcn: string): string {
    return new HttpApiDataType({ fqcn }).id;
  }

  toCreateIntent(): HttpApiDataTypeCreateIntent {
    return {
      id: this.id,
      simpleName: this.simpleName,
      fqcn: this.fqcn,
    };
  }
}

export interface HttpApiDataTypeRecord
  extends DiscoveryEntityBase,
    HttpApiDataTypeCreateIntent {}
