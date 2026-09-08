export type FqcnResolutionReason = "ambiguous_import" | "unresolved";

export class FqcnResolutionError extends Error {
  readonly literalName: string;
  readonly reason: FqcnResolutionReason;

  constructor(literalName: string, reason: FqcnResolutionReason, message?: string) {
    super(message ?? `Failed to resolve FQCN for "${literalName}": ${reason}`);
    this.name = "FqcnResolutionError";
    this.literalName = literalName;
    this.reason = reason;
  }
}

export type ModuleBindingResolutionReason = "unresolved";

export class ModuleBindingResolutionError extends Error {
  readonly literalName: string;
  readonly reason: ModuleBindingResolutionReason;

  constructor(literalName: string, reason: ModuleBindingResolutionReason, message?: string) {
    super(message ?? `Failed to resolve module binding for "${literalName}": ${reason}`);
    this.name = "ModuleBindingResolutionError";
    this.literalName = literalName;
    this.reason = reason;
  }
}
