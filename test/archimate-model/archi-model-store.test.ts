import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../src/archimate-model/archi-model-store.js";
import { PREDEFINED_FOLDERS } from "../../src/archimate-model/concept-types.js";
import {
  ApplicationComponent,
  BusinessActor,
} from "../../src/archimate-model/elements/archi-element.js";
import { ArchiFolderIds } from "../../src/archimate-model/folders/archi-folder.js";

describe("ArchiModelStore", () => {
  it("initializes predefined layer folders", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });

    assert.equal(store.listFolders().length, PREDEFINED_FOLDERS.length);
    assert.ok(store.getPredefinedFolderId("business"));
    assert.ok(store.snapshot().findById(store.getPredefinedFolderId("business")));
  });

  it("accepts element create-intents for allowed groups", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const applicationFolderId = store.getPredefinedFolderId("application");
    const element = ApplicationComponent.withId("element-id")
      .name("service-a")
      .inFolder(applicationFolderId)
      .build();
    const wrongConcept = BusinessActor.withId("biz-id")
      .name("Actor")
      .inFolder(applicationFolderId)
      .build();

    assert.throws(
      () =>
        store.addCreateIntents("generate-app", { groupId: "generate-app", artifactId: "x" }, {
          elements: [wrongConcept],
        }),
      /not allowed for processor group generate-app/,
    );

    store.addCreateIntents(
      "generate-app",
      { groupId: "generate-app", artifactId: "demo" },
      { elements: [element] },
    );

    assert.equal(store.listElements().length, 1);
  });

  it("rejects duplicate ids", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const folderId = store.getPredefinedFolderId("application");
    const element = ApplicationComponent.withId("duplicate-id")
      .name("service-a")
      .inFolder(folderId)
      .build();

    store.addCreateIntents(
      "generate-app",
      { groupId: "generate-app", artifactId: "demo" },
      { elements: [element] },
    );

    assert.throws(
      () =>
        store.addCreateIntents(
          "generate-app",
          { groupId: "generate-app", artifactId: "demo" },
          { elements: [element] },
        ),
      /Duplicate id: duplicate-id/,
    );
  });

  it("creates nested folders and finds them by parent and name", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const parentId = store.getPredefinedFolderId("application");
    const folder = store.createFolder(parentId, "Domain");

    assert.equal(folder.parentFolderId, parentId);
    assert.equal(folder.id, ArchiFolderIds.nestedId(parentId, "Domain"));
    assert.deepEqual(
      store.snapshot().findFolders({ parentFolderId: parentId, name: "Domain" }),
      [folder],
    );
  });

  it("finds elements by concept type and name", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const folderId = store.getPredefinedFolderId("application");
    const element = ApplicationComponent.withId("element-id")
      .name("service-a")
      .inFolder(folderId)
      .build();

    store.addCreateIntents(
      "generate-app",
      { groupId: "generate-app", artifactId: "demo" },
      { elements: [element] },
    );

    assert.deepEqual(
      store.snapshot().findByConceptTypeAndName("ApplicationComponent", "service-a"),
      [element.toCreateIntent()],
    );
  });

  it("uses deterministic predefined folder ids", () => {
    assert.equal(ArchiFolderIds.rootIdFor("business"), ArchiFolderIds.rootIdFor("business"));
  });
});
