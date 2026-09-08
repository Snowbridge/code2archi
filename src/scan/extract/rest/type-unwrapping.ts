const GENERIC_WRAPPERS = [
  "ResponseEntity",
  "Mono",
  "Flux",
  "Flow",
  "Publisher",
  "Optional",
  "CompletableFuture",
  "Future",
  "List",
  "Set",
  "Collection",
  "Iterable",
  "Sequence",
  "Array",
  "Map",
];

export function unwrapJvmApiType(typeText: string): string[] {
  const trimmed = typeText.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const genericMatch = /^([^<]+)<(.+)>$/.exec(trimmed);
  if (!genericMatch) {
    return [trimmed];
  }

  const head = genericMatch[1]!.trim();
  const simpleHead = head.includes(".") ? head.slice(head.lastIndexOf(".") + 1) : head;
  const inner = genericMatch[2]!.trim();

  if (GENERIC_WRAPPERS.includes(simpleHead)) {
    const parts = splitGenericArguments(inner);
    return parts.flatMap((part) => unwrapJvmApiType(part));
  }

  return [trimmed];
}

function splitGenericArguments(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of value) {
    if (char === "<") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ">") {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}
