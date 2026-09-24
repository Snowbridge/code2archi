import type { DiscoveryLinkCreateIntent } from "./link-base.js";
import { Link } from "./link.js";

export type InferredHttpApiContractAssignmentBasis = "inference";

export interface InferredHttpApiContractAssignmentCreateIntent
  extends DiscoveryLinkCreateIntent {
  readonly contractId: string;
  readonly assigneeId: string;
  readonly confidence: number;
  readonly basis: InferredHttpApiContractAssignmentBasis;
}

export interface InferredHttpApiContractAssignmentNaturalKeys {
  readonly contractId: string;
  readonly assigneeId: string;
  readonly confidence: number;
}

export class InferredHttpApiContractAssignment extends Link {
  private static readonly LINK_TYPE = "InferredHttpApiContractAssignment" as const;

  readonly contractId: string;
  readonly assigneeId: string;
  readonly confidence: number;
  readonly basis: InferredHttpApiContractAssignmentBasis = "inference";

  constructor(naturalKeys: InferredHttpApiContractAssignmentNaturalKeys) {
    super(InferredHttpApiContractAssignment.LINK_TYPE, [
      naturalKeys.contractId,
      naturalKeys.assigneeId,
    ]);
    this.contractId = naturalKeys.contractId;
    this.assigneeId = naturalKeys.assigneeId;
    this.confidence = naturalKeys.confidence;
  }

  toCreateIntent(): InferredHttpApiContractAssignmentCreateIntent {
    return {
      id: this.id,
      contractId: this.contractId,
      assigneeId: this.assigneeId,
      confidence: this.confidence,
      basis: this.basis,
    };
  }
}

export interface InferredHttpApiContractAssignmentRecord
  extends InferredHttpApiContractAssignmentCreateIntent {
  readonly transformProcessor?: string;
  readonly transformSchema?: string;
  readonly linkedAt?: string;
}
