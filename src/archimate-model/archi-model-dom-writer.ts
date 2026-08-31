import { writeFileSync } from "node:fs";
import path from "node:path";
import type { ArchiElementCreateIntent } from "./elements/archi-element.js";
import type { ArchiFolder } from "./folders/archi-folder.js";
import type { ArchiModelStore } from "./archi-model-store.js";
import type { ArchiProfileCreateIntent } from "./profiles/profile.js";
import type { ArchiRelationshipCreateIntent } from "./relationships/archi-relationship.js";
import { getLogger } from "../platform/logging/index.js";

export interface ArchiModelDomDocument {
  readonly modelName: string;
  readonly modelId: string;
  readonly folders: readonly ArchiFolder[];
  readonly profiles: readonly ArchiProfileCreateIntent[];
  readonly elements: readonly ArchiElementCreateIntent[];
  readonly relations: readonly ArchiRelationshipCreateIntent[];
}

export interface ArchiModelDomWriteInput {
  readonly outputFile: string;
  readonly store: ArchiModelStore;
}

export function archiModelDomOutputPath(outputFile: string): string {
  const parsed = path.parse(outputFile);
  return path.join(parsed.dir, `${parsed.name}.dom.json`);
}

export class ArchiModelDomWriter {
  write(input: ArchiModelDomWriteInput): void {
    const logger = getLogger("generate.dom-writer");
    const absoluteOutput = path.resolve(archiModelDomOutputPath(input.outputFile));
    logger.info("writing archi-model dom", { path: absoluteOutput });

    input.store.validateForWrite();
    const document = this.buildDocument(input.store);
    writeFileSync(absoluteOutput, `${JSON.stringify(document, null, 2)}\n`, "utf8");

    logger.info("archi-model dom written", { path: absoluteOutput });
  }

  private buildDocument(store: ArchiModelStore): ArchiModelDomDocument {
    return {
      modelName: store.modelName,
      modelId: store.modelId,
      folders: store.listFolders(),
      profiles: store.listProfiles(),
      elements: store.listElements(),
      relations: store.listRelations(),
    };
  }
}
