import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../src/archimate-model/archi-model-store.js";
import { ArchiModelWriter } from "../../src/archimate-model/archi-model-writer.js";
import { ApplicationComponent } from "../../src/archimate-model/elements/archi-element.js";
import { ArchiFolderIds } from "../../src/archimate-model/folders/archi-folder.js";
import { ServingRelationship } from "../../src/archimate-model/relationships/archi-relationship.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("ArchiModelWriter", () => {
  it("writes bootstrap skeleton with predefined layer folders", () => {
    const tempDir = createTestTempDir("c2a-archi-writer-");
    const outputFile = path.join(tempDir, "example.archimate");
    const store = new ArchiModelStore({
      modelName: "example",
      modelId: "model-id-value",
    });

    new ArchiModelWriter().write({ outputFile, store });

    const xml = readFileSync(outputFile, "utf8");
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /version="5.0.0"/);
    assert.match(xml, /<folder name="Business" id="[^"]+" type="business">/);
    assert.match(xml, /<folder name="Application" id="[^"]+" type="application">/);
    assert.match(xml, /<folder name="Technology &amp; Physical" id="[^"]+" type="technology">/);
    assert.match(xml, /<folder name="Relations" id="[^"]+" type="relations">/);
    assert.match(xml, /<folder name="Views" id="[^"]+" type="diagrams">/);
    assert.doesNotMatch(xml, /<profile /);
    assert.equal(ArchiFolderIds.rootIdFor("business"), store.getPredefinedFolderId("business"));
  });

  it("writes relationships into the Relations folder", () => {
    const tempDir = createTestTempDir("c2a-archi-writer-rel-");
    const outputFile = path.join(tempDir, "example.archimate");
    const store = new ArchiModelStore({
      modelName: "example",
      modelId: "model-id-value",
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
      .source("source-id")
      .target("target-id")
      .property("c2a:Id", "relation-id")
      .build();

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements", artifactId: "demo" },
      { elements: [source, target], relations: [relation] },
    );

    new ArchiModelWriter().write({ outputFile, store });

    const xml = readFileSync(outputFile, "utf8");
    assert.match(
      xml,
      /<folder name="Relations" id="[^"]+" type="relations">[\s\S]*<element xsi:type="archimate:ServingRelationship" id="relation-id" source="source-id" target="target-id">/,
    );
    assert.match(xml, /<property key="c2a:Id" value="relation-id"\/>/);
  });
});
