import type { DiscoveryLinkBase } from "./link-base.js";
import { Link } from "./link.js";

export type RestClientToControllerLinkMethod = "INTERFACE" | "DTO" | "ENDPOINT";

export type RestClientToControllerLinkBasis = "extract" | "inference";

export interface RestClientToControllerLinkCreateIntent {
  readonly id: string;
  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: RestClientToControllerLinkMethod;
  readonly basis: RestClientToControllerLinkBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];
}

export interface RestClientToControllerLinkNaturalKeys {
  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: RestClientToControllerLinkMethod;
  readonly basis: RestClientToControllerLinkBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];
}

export class RestClientToControllerLink extends Link {
  private static readonly LINK_TYPE = "RestClientToControllerLink" as const;

  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: RestClientToControllerLinkMethod;
  readonly basis: RestClientToControllerLinkBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];

  constructor(naturalKeys: RestClientToControllerLinkNaturalKeys) {
    super(RestClientToControllerLink.LINK_TYPE, [
      naturalKeys.restControllerId,
      naturalKeys.restClientId,
      naturalKeys.matchMethod,
    ]);
    this.restControllerId = naturalKeys.restControllerId;
    this.restClientId = naturalKeys.restClientId;
    this.sourceApplicationModuleId = naturalKeys.sourceApplicationModuleId;
    this.targetApplicationModuleId = naturalKeys.targetApplicationModuleId;
    this.matchMethod = naturalKeys.matchMethod;
    this.basis = naturalKeys.basis;
    this.confidence = naturalKeys.confidence;
    if (naturalKeys.matchedValues !== undefined) {
      this.matchedValues = naturalKeys.matchedValues;
    }
  }

  toCreateIntent(): RestClientToControllerLinkCreateIntent {
    return {
      id: this.id,
      restControllerId: this.restControllerId,
      restClientId: this.restClientId,
      sourceApplicationModuleId: this.sourceApplicationModuleId,
      targetApplicationModuleId: this.targetApplicationModuleId,
      matchMethod: this.matchMethod,
      basis: this.basis,
      confidence: this.confidence,
      ...(this.matchedValues !== undefined ? { matchedValues: this.matchedValues } : {}),
    };
  }
}

export interface RestClientToControllerLinkRecord
  extends DiscoveryLinkBase,
    RestClientToControllerLinkCreateIntent {}
