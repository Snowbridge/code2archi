import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export type HttpApiContractBasis = "extract" | "inference";

export interface HttpApiContractCreateIntent {
  readonly id: string;
  readonly simpleName: string;
  readonly fqcn: string;
  readonly basis: HttpApiContractBasis;
  readonly confidence?: number;
}

export interface HttpApiContractNaturalKeys {
  readonly fqcn: string;
  readonly basis?: HttpApiContractBasis;
  readonly confidence?: number;
}

export class HttpApiContract extends Entity {
  private static readonly ENTITY_TYPE = "HttpApiContract" as const;

  readonly simpleName: string;
  readonly fqcn: string;
  readonly basis: HttpApiContractBasis;
  readonly confidence?: number;

  constructor(naturalKeys: HttpApiContractNaturalKeys) {
    const simpleName = naturalKeys.fqcn.includes(".")
      ? naturalKeys.fqcn.slice(naturalKeys.fqcn.lastIndexOf(".") + 1)
      : naturalKeys.fqcn;
    super(HttpApiContract.ENTITY_TYPE, [naturalKeys.fqcn]);
    this.simpleName = simpleName;
    this.fqcn = naturalKeys.fqcn;
    this.basis = naturalKeys.basis ?? "extract";
    this.confidence = naturalKeys.confidence;
  }

  static inferredFqcnForController(controllerFqcn: string): string {
    return `inferred-contract:${controllerFqcn}`;
  }

  static forInferredController(controllerFqcn: string): HttpApiContract {
    return new HttpApiContract({
      fqcn: HttpApiContract.inferredFqcnForController(controllerFqcn),
      basis: "inference",
      confidence: 1,
    });
  }

  static idForFqcn(fqcn: string): string {
    return new HttpApiContract({ fqcn }).id;
  }

  toCreateIntent(): HttpApiContractCreateIntent {
    const intent: HttpApiContractCreateIntent = {
      id: this.id,
      simpleName: this.simpleName,
      fqcn: this.fqcn,
      basis: this.basis,
    };
    if (this.confidence !== undefined) {
      return { ...intent, confidence: this.confidence };
    }
    return intent;
  }
}

export interface HttpApiContractRecord
  extends DiscoveryEntityBase,
    HttpApiContractCreateIntent {}

export function normalizeHttpApiContractRecord(
  record: DiscoveryEntityBase & HttpApiContractCreateIntent,
): HttpApiContractRecord {
  const basis = record.basis ?? "extract";
  const normalized: HttpApiContractRecord = { ...record, basis };
  if (basis === "extract") {
    const { confidence: _confidence, ...withoutConfidence } = normalized;
    return withoutConfidence as HttpApiContractRecord;
  }
  return normalized;
}
