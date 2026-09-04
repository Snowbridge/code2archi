import type { DiscoveryLinkBase } from "./link-base.js";
import { Link } from "./link.js";

export type NodejsDirectRestRequestsServingMatchMethod = "INTERFACE" | "DTO" | "ENDPOINT";

export type NodejsDirectRestRequestsServingMatchConfidence = "confirmed" | "inferred";

export interface NodejsDirectRestRequestsServingMatchCreateIntent {
  readonly id: string;
  readonly nodejsRestControllerId: string;
  readonly nodejsRestClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: NodejsDirectRestRequestsServingMatchMethod;
  readonly confidence: NodejsDirectRestRequestsServingMatchConfidence;
  readonly confidenceScore: number;
  readonly matchedValues?: readonly string[];
}

export interface NodejsDirectRestRequestsServingMatchNaturalKeys {
  readonly nodejsRestControllerId: string;
  readonly nodejsRestClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: NodejsDirectRestRequestsServingMatchMethod;
  readonly confidence: NodejsDirectRestRequestsServingMatchConfidence;
  readonly confidenceScore: number;
  readonly matchedValues?: readonly string[];
}

export class NodejsDirectRestRequestsServingMatch extends Link {
  private static readonly LINK_TYPE = "NodejsDirectRestRequestsServingMatch" as const;

  readonly nodejsRestControllerId: string;
  readonly nodejsRestClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: NodejsDirectRestRequestsServingMatchMethod;
  readonly confidence: NodejsDirectRestRequestsServingMatchConfidence;
  readonly confidenceScore: number;
  readonly matchedValues?: readonly string[];

  constructor(naturalKeys: NodejsDirectRestRequestsServingMatchNaturalKeys) {
    super(NodejsDirectRestRequestsServingMatch.LINK_TYPE, [
      naturalKeys.nodejsRestControllerId,
      naturalKeys.nodejsRestClientId,
      naturalKeys.matchMethod,
    ]);
    this.nodejsRestControllerId = naturalKeys.nodejsRestControllerId;
    this.nodejsRestClientId = naturalKeys.nodejsRestClientId;
    this.sourceApplicationModuleId = naturalKeys.sourceApplicationModuleId;
    this.targetApplicationModuleId = naturalKeys.targetApplicationModuleId;
    this.matchMethod = naturalKeys.matchMethod;
    this.confidence = naturalKeys.confidence;
    this.confidenceScore = naturalKeys.confidenceScore;
    if (naturalKeys.matchedValues !== undefined) {
      this.matchedValues = naturalKeys.matchedValues;
    }
  }

  toCreateIntent(): NodejsDirectRestRequestsServingMatchCreateIntent {
    return {
      id: this.id,
      nodejsRestControllerId: this.nodejsRestControllerId,
      nodejsRestClientId: this.nodejsRestClientId,
      sourceApplicationModuleId: this.sourceApplicationModuleId,
      targetApplicationModuleId: this.targetApplicationModuleId,
      matchMethod: this.matchMethod,
      confidence: this.confidence,
      confidenceScore: this.confidenceScore,
      ...(this.matchedValues !== undefined ? { matchedValues: this.matchedValues } : {}),
    };
  }
}

export interface NodejsDirectRestRequestsServingMatchRecord
  extends DiscoveryLinkBase,
    NodejsDirectRestRequestsServingMatchCreateIntent {}
