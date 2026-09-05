import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { standardGenerateElementProperties } from "../../src/generate/archi-element-properties.js";
import { packageVersion } from "../../src/package-version.js";

describe("standardGenerateElementProperties", () => {
  it("includes c2a:slot with bare slot id", () => {
    const properties = standardGenerateElementProperties({
      logicalId: "demo-id",
      generatorCoordinate: "generate.elements.technology:code-repositories",
      slot: "repo-artifact",
    });

    assert.deepEqual(properties, [
      { key: "c2a:Id", value: "demo-id" },
      { key: "c2a:basis", value: "extract" },
      { key: "c2a:schema", value: packageVersion },
      { key: "c2a:generator", value: "generate.elements.technology:code-repositories" },
      { key: "c2a:slot", value: "repo-artifact" },
    ]);
  });

  it("honors optional confidence", () => {
    const properties = standardGenerateElementProperties({
      logicalId: "demo-id",
      generatorCoordinate: "generate.elements.technology:code-repositories",
      slot: "repo-artifact",
      basis: "inference",
    });

    assert.equal(
      properties.find((property) => property.key === "c2a:basis")?.value,
      "inference",
    );
  });
});
