import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../src/archimate-model/folders/archi-folder.js";
import {
  dedupeAndSortFolderIntents,
  ensureChildFolder,
  ensureFolderPath,
  parseNamespaceSegments,
  sortFolderIntentsParentFirst,
} from "../../src/generate/archi-folder-path.js";
import { CODE_REPOSITORIES_FOLDER } from "../../src/processors/generate.elements.technology/repositories-processor.js";

describe("archi-folder-path", () => {
  it("returns parent folder id for empty namespace segments", () => {
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const archi = store.snapshot();
    const technologyFolderId = archi.getPredefinedFolderId("technology");
    const pendingFolders = new Map();

    const result = ensureFolderPath(archi, technologyFolderId, [], pendingFolders);

    assert.equal(result.folderId, technologyFolderId);
    assert.equal(result.folderIntents.length, 0);
  });

  it("creates nested folders for multi-segment namespace", () => {
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const archi = store.snapshot();
    const technologyFolderId = archi.getPredefinedFolderId("technology");
    const codeRepos = ensureChildFolder(
      archi,
      technologyFolderId,
      CODE_REPOSITORIES_FOLDER,
      new Map(),
    );
    const pendingFolders = new Map(
      codeRepos.folderIntent ? [[codeRepos.folderIntent.id, codeRepos.folderIntent]] : [],
    );

    const result = ensureFolderPath(archi, codeRepos.folderId, ["fuzz", "bar", "buzz"], pendingFolders);

    assert.equal(result.folderIntents.length, 3);
    assert.equal(result.folderIntents[0]?.name, "fuzz");
    assert.equal(result.folderIntents[2]?.name, "buzz");
    assert.equal(
      result.folderId,
      ArchiFolderIds.nestedId(
        ArchiFolderIds.nestedId(
          ArchiFolderIds.nestedId(codeRepos.folderId, "fuzz"),
          "bar",
        ),
        "buzz",
      ),
    );
  });

  it("reuses existing folder from archi snapshot", () => {
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const existing = store.createFolder(technologyFolderId, "existing");
    const archi = store.snapshot();
    const pendingFolders = new Map();

    const result = ensureFolderPath(archi, technologyFolderId, ["existing", "child"], pendingFolders);

    assert.equal(result.folderIntents.length, 1);
    assert.equal(result.folderIntents[0]?.name, "child");
    assert.equal(result.folderIntents[0]?.parentFolderId, existing.id);
  });

  it("parses namespace segments from posix path", () => {
    assert.deepEqual(parseNamespaceSegments(""), []);
    assert.deepEqual(parseNamespaceSegments("fuzz/bar/buzz"), ["fuzz", "bar", "buzz"]);
    assert.deepEqual(parseNamespaceSegments("/fuzz//bar/"), ["fuzz", "bar"]);
  });

  it("sorts folder intents parent before child regardless of id order", () => {
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const codeReposId = ArchiFolderIds.nestedId(technologyFolderId, CODE_REPOSITORIES_FOLDER);
    const fuzzId = ArchiFolderIds.nestedId(codeReposId, "fuzz");
    const barId = ArchiFolderIds.nestedId(fuzzId, "bar");
    const buzzId = ArchiFolderIds.nestedId(barId, "buzz");

    const unordered = [
      { id: buzzId, name: "buzz", parentFolderId: barId },
      { id: codeReposId, name: CODE_REPOSITORIES_FOLDER, parentFolderId: technologyFolderId },
      { id: barId, name: "bar", parentFolderId: fuzzId },
      { id: fuzzId, name: "fuzz", parentFolderId: codeReposId },
    ];

    const sorted = sortFolderIntentsParentFirst(unordered, new Set(store.listFolders().map((folder) => folder.id)));

    assert.deepEqual(
      sorted.map((folder) => folder.name),
      [CODE_REPOSITORIES_FOLDER, "fuzz", "bar", "buzz"],
    );
  });

  it("dedupes folder intents and preserves parent-first order", () => {
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const codeReposId = ArchiFolderIds.nestedId(technologyFolderId, CODE_REPOSITORIES_FOLDER);
    const intent = { id: codeReposId, name: CODE_REPOSITORIES_FOLDER, parentFolderId: technologyFolderId };

    const sorted = dedupeAndSortFolderIntents([intent, intent], new Set(store.listFolders().map((folder) => folder.id)));

    assert.equal(sorted.length, 1);
    assert.equal(sorted[0]?.name, CODE_REPOSITORIES_FOLDER);
  });
});
