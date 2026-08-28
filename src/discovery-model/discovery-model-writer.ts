import { writeFileSync } from "node:fs";
import path from "node:path";
import { packageVersion } from "../package-version.js";
import type { Manifest } from "./manifest.js";
import type { Repository } from "./repository.js";
import { REPOSITORY_SCHEMA_ID } from "./schema-ids.js";

export interface DiscoveryModelWriteInput {
  readonly outputDir: string;
  readonly sourceDirs: readonly string[];
  readonly repositories: readonly Repository[];
  readonly scanId: string;
  readonly scannedAt: Date;
}

export class DiscoveryModelWriter {
  write(input: DiscoveryModelWriteInput): void {
    this.writeRepositories(input.outputDir, input.repositories);
    this.writeManifest(input);
  }

  private writeRepositories(
    outputDir: string,
    repositories: readonly Repository[],
  ): void {
    writeFileSync(
      path.join(outputDir, "repositories.json"),
      `${JSON.stringify(repositories, null, 2)}\n`,
      "utf8",
    );
  }

  private writeManifest(input: DiscoveryModelWriteInput): void {
    const manifest: Manifest = {
      formatVersion: packageVersion,
      scanId: input.scanId,
      scannedAt: input.scannedAt.toISOString(),
      sourceRoot: this.computeSourceRoot(input.sourceDirs),
      collections: [
        {
          path: "repositories.json",
          contentType: "entities",
          entityType: "Repository",
          schema: REPOSITORY_SCHEMA_ID,
        },
      ],
    };

    writeFileSync(
      path.join(input.outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  }

  private computeSourceRoot(sourceDirs: readonly string[]): string {
    if (sourceDirs.length === 0) {
      return "";
    }

    if (sourceDirs.length === 1) {
      return path.resolve(sourceDirs[0]!);
    }

    let prefix = path.resolve(sourceDirs[0]!);
    for (const sourceDir of sourceDirs.slice(1)) {
      const resolved = path.resolve(sourceDir);
      while (
        prefix !== resolved &&
        !resolved.startsWith(prefix + path.sep) &&
        prefix !== path.parse(prefix).root
      ) {
        prefix = path.dirname(prefix);
      }
      if (prefix === path.parse(prefix).root) {
        return prefix;
      }
    }

    return prefix;
  }
}
