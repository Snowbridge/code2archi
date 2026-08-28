export interface NpmNameParts {
  readonly groupId: string;
  readonly artifactId: string;
}

export function parseNpmName(name: string): NpmNameParts {
  if (name.startsWith("@")) {
    const slashIndex = name.indexOf("/");
    if (slashIndex === -1) {
      return { groupId: name.slice(1), artifactId: name.slice(1) };
    }

    return {
      groupId: name.slice(1, slashIndex),
      artifactId: name.slice(slashIndex + 1),
    };
  }

  return { groupId: "", artifactId: name };
}
