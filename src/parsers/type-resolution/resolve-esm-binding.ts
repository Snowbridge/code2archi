import { ModuleBindingResolutionError } from "./errors.js";
import type { EsmImportBinding } from "./types.js";

function findBinding(
  bindings: readonly EsmImportBinding[],
  literalName: string,
): EsmImportBinding | undefined {
  return bindings.find((binding) => binding.literalName === literalName);
}

function formatModuleBindingId(literalName: string, fullImportLine: string): string {
  return `${literalName}#${fullImportLine.trim()}`;
}

export function resolveEsmBinding(
  literalName: string,
  bindings: readonly EsmImportBinding[],
): string {
  const dotIndex = literalName.indexOf(".");
  if (dotIndex !== -1) {
    const head = literalName.slice(0, dotIndex);
    const binding = findBinding(bindings, head);
    if (binding === undefined) {
      throw new ModuleBindingResolutionError(literalName, "unresolved");
    }

    return formatModuleBindingId(literalName, binding.fullImportLine);
  }

  const binding = findBinding(bindings, literalName);
  if (binding === undefined) {
    throw new ModuleBindingResolutionError(literalName, "unresolved");
  }

  return formatModuleBindingId(literalName, binding.fullImportLine);
}
