import type { ProcessorId } from "../processors/processor.js";

export type ScanSourcePhase = "assembly" | "rest";

export function classifyScanSourcePhase(groupId: string): ScanSourcePhase {
  if (groupId.startsWith("scan.source.assembly.")) {
    return "assembly";
  }
  return "rest";
}

export function partitionScanSourceProcessors<T extends { readonly id: ProcessorId }>(
  processors: readonly T[],
): {
  readonly assembly: readonly T[];
  readonly rest: readonly T[];
} {
  const assembly: T[] = [];
  const rest: T[] = [];

  for (const processor of processors) {
    if (classifyScanSourcePhase(processor.id.groupId) === "assembly") {
      assembly.push(processor);
    } else {
      rest.push(processor);
    }
  }

  return { assembly, rest };
}
