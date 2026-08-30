import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../src/archimate-model/archi-model-store.js";
import { ApplicationComponent } from "../../src/archimate-model/elements/archi-element.js";
import { ArchiFolderIds } from "../../src/archimate-model/folders/archi-folder.js";

describe("ArchiElement", () => {
  it("creates stable sha256 folder ids", () => {
    const first = ArchiFolderIds.rootIdFor("business");
    const second = ArchiFolderIds.rootIdFor("business");
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it("creates distinct ids for different folder keys and model paths", () => {
    assert.notEqual(
      ArchiFolderIds.rootIdFor("business"),
      ArchiFolderIds.rootIdFor("application"),
    );
    assert.notEqual(
      ArchiModelStore.computeModelId("/tmp/a.archimate"),
      ArchiModelStore.computeModelId("/tmp/b.archimate"),
    );
  });

  it("binds conceptType to the typed class", () => {
    const element = ApplicationComponent.withId("element-id")
      .name("service-a")
      .inFolder("folder-id")
      .build();

    assert.equal(element.conceptType, "ApplicationComponent");
    assert.deepEqual(element.toCreateIntent(), {
      id: "element-id",
      conceptType: "ApplicationComponent",
      name: "service-a",
      folderId: "folder-id",
    });
  });
});
