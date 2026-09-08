import { ModuleBindingResolutionError } from "./errors.js";
import type { CjsImportBinding } from "./types.js";

function formatModuleBindingId(literalName: string, fullImportLine: string): string {
  return `${literalName}#${fullImportLine.trim()}`;
}

export function resolveCjsBinding(
  literalName: string,
  bindings: readonly CjsImportBinding[],
): string {
  const binding = bindings.find((entry) => entry.literalName === literalName);
  if (binding === undefined) {
    throw new ModuleBindingResolutionError(literalName, "unresolved");
  }

  return formatModuleBindingId(literalName, binding.fullImportLine);
}
