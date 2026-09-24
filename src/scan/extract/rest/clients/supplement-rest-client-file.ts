/**
 * Parsing and validation of the `rest-client.json` supplement consumed by the
 * `supplemented-rest-clients` extractor.
 *
 * The sidecar is a JSON array of RestClient records (as written by code-inventory
 * `rest-clients.json`). Only `fqcn` and `applicationModuleId` are mandatory;
 * the remaining fields fall back to defaults when absent.
 */

export interface SupplementedRestClientEntry {
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly simpleName?: string;
  readonly fileName?: string;
  readonly endpoints?: readonly string[];
  readonly dataTypeIds?: readonly string[];
}

/**
 * Parses and validates a `rest-client.json` supplement body.
 *
 * Returns the list of entries, or `undefined` when the content is not a valid
 * JSON array whose every element carries a non-empty `fqcn` and
 * `applicationModuleId`.
 */
export function parseRestClientSupplement(content: string): SupplementedRestClientEntry[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const entries: SupplementedRestClientEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) {
      return undefined;
    }
    const record = item as Record<string, unknown>;
    const fqcn = record.fqcn;
    const applicationModuleId = record.applicationModuleId;
    if (typeof fqcn !== "string" || fqcn.length === 0) {
      return undefined;
    }
    if (typeof applicationModuleId !== "string" || applicationModuleId.length === 0) {
      return undefined;
    }
    entries.push({
      fqcn,
      applicationModuleId,
      simpleName: typeof record.simpleName === "string" ? record.simpleName : undefined,
      fileName: typeof record.fileName === "string" ? record.fileName : undefined,
      endpoints: arrayOfStrings(record.endpoints),
      dataTypeIds: arrayOfStrings(record.dataTypeIds),
    });
  }

  return entries;
}

/** Builds an index of supplement entries by FQCN, keeping the first entry per FQCN. */
export function indexSupplementedRestClientsByFqcn(
  entries: readonly SupplementedRestClientEntry[],
): ReadonlyMap<string, SupplementedRestClientEntry> {
  const index = new Map<string, SupplementedRestClientEntry>();
  for (const entry of entries) {
    if (!index.has(entry.fqcn)) {
      index.set(entry.fqcn, entry);
    }
  }
  return index;
}

function arrayOfStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}