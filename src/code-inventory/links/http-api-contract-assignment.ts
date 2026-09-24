import type { HttpApiContractBasis } from "../entities/http-api-contract.js";
import type { DiscoveryLinkCreateIntent } from "./link-base.js";
import { Link } from "./link.js";

export interface HttpApiContractAssignmentCreateIntent extends DiscoveryLinkCreateIntent {
  readonly contractId: string;
  readonly assigneeId: string;
  readonly basis: HttpApiContractBasis;
  readonly confidence?: number;
}

export interface HttpApiContractAssignmentNaturalKeys {
  readonly contractId: string;
  readonly assigneeId: string;
  readonly basis: HttpApiContractBasis;
  readonly confidence?: number;
}

function confidenceKeyForId(confidence: number | undefined): string {
  return confidence === undefined ? "-" : String(confidence);
}

export class HttpApiContractAssignment extends Link {
  private static readonly LINK_TYPE = "HttpApiContractAssignment" as const;

  readonly contractId: string;
  readonly assigneeId: string;
  readonly basis: HttpApiContractBasis;
  readonly confidence?: number;

  constructor(naturalKeys: HttpApiContractAssignmentNaturalKeys) {
    super(HttpApiContractAssignment.LINK_TYPE, [
      naturalKeys.contractId,
      naturalKeys.assigneeId,
      naturalKeys.basis,
      confidenceKeyForId(naturalKeys.confidence),
    ]);
    this.contractId = naturalKeys.contractId;
    this.assigneeId = naturalKeys.assigneeId;
    this.basis = naturalKeys.basis;
    this.confidence = naturalKeys.confidence;
  }

  static forExtract(contractId: string, assigneeId: string): HttpApiContractAssignment {
    return new HttpApiContractAssignment({
      contractId,
      assigneeId,
      basis: "extract",
    });
  }

  static forInference(
    contractId: string,
    assigneeId: string,
    confidence: number,
  ): HttpApiContractAssignment {
    return new HttpApiContractAssignment({
      contractId,
      assigneeId,
      basis: "inference",
      confidence,
    });
  }

  toCreateIntent(): HttpApiContractAssignmentCreateIntent {
    const intent: HttpApiContractAssignmentCreateIntent = {
      id: this.id,
      contractId: this.contractId,
      assigneeId: this.assigneeId,
      basis: this.basis,
    };
    if (this.confidence !== undefined) {
      return { ...intent, confidence: this.confidence };
    }
    return intent;
  }
}

export interface HttpApiContractAssignmentRecord extends HttpApiContractAssignmentCreateIntent {
  readonly transformProcessor?: string;
  readonly transformSchema?: string;
  readonly linkedAt?: string;
}
