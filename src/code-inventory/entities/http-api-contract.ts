import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface HttpApiContractCreateIntent {
  readonly id: string;
  readonly simpleName: string;
  readonly fqcn: string;
}

export interface HttpApiContractNaturalKeys {
  readonly fqcn: string;
}

export class HttpApiContract extends Entity {
  private static readonly ENTITY_TYPE = "HttpApiContract" as const;

  readonly simpleName: string;
  readonly fqcn: string;

  constructor(naturalKeys: HttpApiContractNaturalKeys) {
    const simpleName = naturalKeys.fqcn.includes(".")
      ? naturalKeys.fqcn.slice(naturalKeys.fqcn.lastIndexOf(".") + 1)
      : naturalKeys.fqcn;
    super(HttpApiContract.ENTITY_TYPE, [naturalKeys.fqcn]);
    this.simpleName = simpleName;
    this.fqcn = naturalKeys.fqcn;
  }

  static idForFqcn(fqcn: string): string {
    return new HttpApiContract({ fqcn }).id;
  }

  toCreateIntent(): HttpApiContractCreateIntent {
    return {
      id: this.id,
      simpleName: this.simpleName,
      fqcn: this.fqcn,
    };
  }
}

export interface HttpApiContractRecord
  extends DiscoveryEntityBase,
    HttpApiContractCreateIntent {}
