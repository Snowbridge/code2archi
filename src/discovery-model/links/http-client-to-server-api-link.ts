import type { DiscoveryLinkBase } from "./link-base.js";
import { Link } from "./link.js";

export type HttpClientToServerApiLinkMethod = "CONTRACT_TYPE" | "PAYLOAD_TYPE" | "ENDPOINT";

export type HttpClientToServerApiLinkBasis = "extract" | "inference";

export interface HttpClientToServerApiLinkCreateIntent {
  readonly id: string;
  readonly httpServerApiId: string;
  readonly httpClientApiId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: HttpClientToServerApiLinkMethod;
  readonly basis: HttpClientToServerApiLinkBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];
}

export interface HttpClientToServerApiLinkNaturalKeys {
  readonly httpServerApiId: string;
  readonly httpClientApiId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: HttpClientToServerApiLinkMethod;
  readonly basis: HttpClientToServerApiLinkBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];
}

export class HttpClientToServerApiLink extends Link {
  private static readonly LINK_TYPE = "HttpClientToServerApiLink" as const;

  readonly httpServerApiId: string;
  readonly httpClientApiId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: HttpClientToServerApiLinkMethod;
  readonly basis: HttpClientToServerApiLinkBasis;
  readonly confidence: number;
  readonly matchedValues?: readonly string[];

  constructor(naturalKeys: HttpClientToServerApiLinkNaturalKeys) {
    super(HttpClientToServerApiLink.LINK_TYPE, [
      naturalKeys.httpServerApiId,
      naturalKeys.httpClientApiId,
      naturalKeys.matchMethod,
    ]);
    this.httpServerApiId = naturalKeys.httpServerApiId;
    this.httpClientApiId = naturalKeys.httpClientApiId;
    this.sourceApplicationModuleId = naturalKeys.sourceApplicationModuleId;
    this.targetApplicationModuleId = naturalKeys.targetApplicationModuleId;
    this.matchMethod = naturalKeys.matchMethod;
    this.basis = naturalKeys.basis;
    this.confidence = naturalKeys.confidence;
    if (naturalKeys.matchedValues !== undefined) {
      this.matchedValues = naturalKeys.matchedValues;
    }
  }

  toCreateIntent(): HttpClientToServerApiLinkCreateIntent {
    return {
      id: this.id,
      httpServerApiId: this.httpServerApiId,
      httpClientApiId: this.httpClientApiId,
      sourceApplicationModuleId: this.sourceApplicationModuleId,
      targetApplicationModuleId: this.targetApplicationModuleId,
      matchMethod: this.matchMethod,
      basis: this.basis,
      confidence: this.confidence,
      ...(this.matchedValues !== undefined ? { matchedValues: this.matchedValues } : {}),
    };
  }
}

export interface HttpClientToServerApiLinkRecord
  extends DiscoveryLinkBase,
    HttpClientToServerApiLinkCreateIntent {}
