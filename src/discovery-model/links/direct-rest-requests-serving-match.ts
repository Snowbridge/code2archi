import type { DiscoveryLinkBase } from "./link-base.js";
import { Link } from "./link.js";

export type DirectRestRequestsServingMatchMethod = "INTERFACE" | "DTO" | "ENDPOINT";

export type DirectRestRequestsServingMatchBasis = "extract" | "inference";

export interface DirectRestRequestsServingMatchCreateIntent {
  readonly id: string;
  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: DirectRestRequestsServingMatchMethod;
  readonly basis: DirectRestRequestsServingMatchBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];
}

export interface DirectRestRequestsServingMatchNaturalKeys {
  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: DirectRestRequestsServingMatchMethod;
  readonly basis: DirectRestRequestsServingMatchBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];
}

export class DirectRestRequestsServingMatch extends Link {
  private static readonly LINK_TYPE = "DirectRestRequestsServingMatch" as const;

  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: DirectRestRequestsServingMatchMethod;
  readonly basis: DirectRestRequestsServingMatchBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];

  constructor(naturalKeys: DirectRestRequestsServingMatchNaturalKeys) {
    super(DirectRestRequestsServingMatch.LINK_TYPE, [
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

  toCreateIntent(): DirectRestRequestsServingMatchCreateIntent {
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

export interface DirectRestRequestsServingMatchRecord
  extends DiscoveryLinkBase,
    DirectRestRequestsServingMatchCreateIntent {}
