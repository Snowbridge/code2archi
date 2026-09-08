const ASSEMBLY_EXTRACT_GROUP_PREFIX = "scan.extract.assembly.";

export function isAssemblyExtractProcessor(groupId: string): boolean {
  return groupId.startsWith(ASSEMBLY_EXTRACT_GROUP_PREFIX);
}

export function isModuleSourceExtractProcessor(groupId: string): boolean {
  return !isAssemblyExtractProcessor(groupId);
}
