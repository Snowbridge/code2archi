export interface TypeReference {
  readonly simpleName: string;
  readonly qualifiedName?: string;
}

export function toTypeReference(simpleName: string, qualifiedName?: string): TypeReference {
  if (qualifiedName !== undefined && qualifiedName.length > 0) {
    return { simpleName, qualifiedName };
  }

  return { simpleName };
}

export function toTypeReferenceFromQualifiedName(qualifiedName: string): TypeReference {
  const simpleName = qualifiedName.includes(".")
    ? qualifiedName.slice(qualifiedName.lastIndexOf(".") + 1)
    : qualifiedName;
  return { simpleName, qualifiedName };
}

export function toTypeReferencesFromQualifiedNames(
  qualifiedNames: readonly string[],
): readonly TypeReference[] {
  return qualifiedNames.map(toTypeReferenceFromQualifiedName);
}

export function toTypeReferencesFromSimpleNames(
  simpleNames: readonly string[],
): readonly TypeReference[] {
  return simpleNames.map((simpleName) => toTypeReference(simpleName));
}

export function typeReferenceMatchKeys(types: readonly TypeReference[]): string[] {
  return types.map((type) => type.qualifiedName ?? type.simpleName);
}
