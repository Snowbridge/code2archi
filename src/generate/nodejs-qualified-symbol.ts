export function simpleNameFromQualifiedSymbol(qualifiedSymbol: string): string {
  const hashIndex = qualifiedSymbol.lastIndexOf("#");
  if (hashIndex >= 0) {
    return qualifiedSymbol.slice(hashIndex + 1);
  }

  const slashIndex = qualifiedSymbol.lastIndexOf("/");
  if (slashIndex >= 0) {
    return qualifiedSymbol.slice(slashIndex + 1);
  }

  return qualifiedSymbol;
}
