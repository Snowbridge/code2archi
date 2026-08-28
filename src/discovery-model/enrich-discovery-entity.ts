import { packageVersion } from "../package-version.js";
import { formatIso8601WithOffset } from "../platform/timestamp.js";
import type { ProcessorId } from "../platform/processors/processor-id.js";
import type { DiscoveryEntityBase, DiscoveryEntityCreateIntent } from "./entity-base.js";
import type { DiscoveryEntityRecord } from "./entity-types.js";

export function formatScannerExtractor(processorId: ProcessorId): string {
  return `${processorId.groupId}:${processorId.artifactId}`;
}

export function enrichDiscoveryEntity(
  record: DiscoveryEntityCreateIntent,
  processorId: ProcessorId,
  extractedAt: Date = new Date(),
): DiscoveryEntityRecord {
  if (!record.id) {
    throw new Error("Entity create-intent is missing id");
  }

  const enriched: DiscoveryEntityRecord = {
    ...record,
    id: record.id,
    scannerExtractor: formatScannerExtractor(processorId),
    scannerSchema: packageVersion,
    extractedAt: formatIso8601WithOffset(extractedAt),
  };

  return enriched;
}

export type { DiscoveryEntityBase };
