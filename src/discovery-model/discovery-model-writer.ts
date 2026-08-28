import { writeFileSync } from "node:fs";
import path from "node:path";
import { packageVersion } from "../package-version.js";
import { formatIso8601WithOffset } from "../platform/timestamp.js";
import { getLogger } from "../platform/logging/index.js";
import { getEntityCollectionDef } from "./entity-collection-registry.js";
import type { Manifest } from "./manifest.js";
import type { RunEntityStore } from "./run-entity-store.js";

export interface DiscoveryModelWriteInput {
  readonly outputDir: string;
  readonly store: RunEntityStore;
  readonly scannedAt: Date;
}

export class DiscoveryModelWriter {
  write(input: DiscoveryModelWriteInput): void {
    const logger = getLogger("scan.writer");
    logger.info("writing discovery-model", { path: input.outputDir });

    const collections: NonNullable<Manifest["collections"]>[number][] = [];

    for (const entityType of input.store.listNonemptyEntityTypes()) {
      const def = getEntityCollectionDef(entityType);
      if (!def.schemaId) {
        continue;
      }

      const entities = input.store.getEntities(entityType);
      writeFileSync(
        path.join(input.outputDir, def.collectionPath),
        `${JSON.stringify(entities, null, 2)}\n`,
        "utf8",
      );

      collections.push({
        path: def.collectionPath,
        contentType: "entities",
        entityType,
        schema: def.schemaId,
      });
    }

    const manifest: Manifest = {
      formatVersion: packageVersion,
      scanId: input.store.scanId,
      scannedAt: formatIso8601WithOffset(input.scannedAt),
      sourceRoot: input.store.sourceRoot,
      collections,
    };

    writeFileSync(
      path.join(input.outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    logger.info("discovery-model written", {
      path: input.outputDir,
      collectionCount: collections.length,
    });
  }
}
