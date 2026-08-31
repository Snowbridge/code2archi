import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../src/archimate-model/archi-model-store.js";
import { PREDEFINED_FOLDERS } from "../../src/archimate-model/concept-types.js";
import {
  ApplicationComponent,
  ArchimateDiagramModel,
} from "../../src/archimate-model/elements/archi-element.js";
import { ArchiFolderIds } from "../../src/archimate-model/folders/archi-folder.js";
import { ServingRelationship } from "../../src/archimate-model/relationships/archi-relationship.js";

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
    const wrongConcept = ArchimateDiagramModel.withId("diagram-id")
      .name("Diagram")
      .inFolder(applicationFolderId)
      .build();

    assert.throws(
      () =>
        store.addCreateIntents("generate.elements", { groupId: "generate.elements", artifactId: "x" }, {
          elements: [wrongConcept],
        }),
      /not allowed for processor group generate\.elements/,
    );

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements", artifactId: "demo" },
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
      "generate.elements",
      { groupId: "generate.elements", artifactId: "demo" },
      { elements: [element] },
    );

    assert.throws(
      () =>
        store.addCreateIntents(
          "generate.elements",
          { groupId: "generate.elements", artifactId: "demo" },
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

  it("accepts folder create-intents in child-before-parent order", () => {
    const store = new ArchiModelStore({ modelName: "Example", modelId: "model-id" });
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const codeReposId = ArchiFolderIds.nestedId(technologyFolderId, "Code repositories");
    const fuzzId = ArchiFolderIds.nestedId(codeReposId, "fuzz");
    const barId = ArchiFolderIds.nestedId(fuzzId, "bar");

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.technology", artifactId: "repositories" },
      {
        folders: [
          { id: barId, name: "bar", parentFolderId: fuzzId },
          { id: codeReposId, name: "Code repositories", parentFolderId: technologyFolderId },
          { id: fuzzId, name: "fuzz", parentFolderId: codeReposId },
        ],
      },
    );

    assert.ok(store.snapshot().getFolder(codeReposId));
    assert.ok(store.snapshot().getFolder(fuzzId));
    assert.ok(store.snapshot().getFolder(barId));
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
      "generate.elements",
      { groupId: "generate.elements", artifactId: "demo" },
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

  it("accepts relationship create-intents in the same bundle as elements", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const applicationFolderId = store.getPredefinedFolderId("application");
    const source = ApplicationComponent.withId("source-id")
      .name("service-a")
      .inFolder(applicationFolderId)
      .build();
    const target = ApplicationComponent.withId("target-id")
      .name("service-b")
      .inFolder(applicationFolderId)
      .build();
    const relation = ServingRelationship.withId("relation-id")
      .source("target-id")
      .target("source-id")
      .property("c2a:Id", "relation-id")
      .build();

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements", artifactId: "demo" },
      {
        relations: [relation],
        elements: [source, target],
      },
    );

    assert.equal(store.listRelations().length, 1);
    assert.equal(store.listRelations()[0]?.relationType, "ServingRelationship");
    assert.equal(store.snapshot().getRelationship("relation-id")?.sourceId, "target-id");
  });

  it("defers relationship endpoint validation until validateForWrite", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const relation = ServingRelationship.withId("relation-id")
      .source("missing-source")
      .target("missing-target")
      .build();

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements", artifactId: "demo" },
      { relations: [relation] },
    );

    assert.throws(() => store.validateForWrite(), /missing source element: missing-source/);
  });

  it("rejects relationship create-intents for generate.views", () => {
    const store = new ArchiModelStore({
      modelName: "Example",
      modelId: "model-id",
    });
    const relation = ServingRelationship.withId("relation-id")
      .source("source-id")
      .target("target-id")
      .build();

    assert.throws(
      () =>
        store.addCreateIntents(
          "generate.views",
          { groupId: "generate.views", artifactId: "demo" },
          { relations: [relation] },
        ),
      /Relationship create-intents are not allowed for processor group generate\.views/,
    );
  });
});
