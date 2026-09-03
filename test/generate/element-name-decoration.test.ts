import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decorateElementName } from "../../src/generate/element-name-decoration.js";
import {
  defaultGenerateProcessorOptions,
  undecoratedGenerateProcessorOptions,
} from "./generate-processor-test-options.js";

describe("decorateElementName", () => {
  it("returns base name when decorate is false", () => {
    assert.equal(
      decorateElementName("repo-artifact", "demo", {}, undecoratedGenerateProcessorOptions),
      "demo",
    );
    assert.equal(
      decorateElementName(
        "module-artifact",
        "svc",
        { buildSystem: "maven" },
        undecoratedGenerateProcessorOptions,
      ),
      "svc",
    );
    assert.equal(
      decorateElementName(
        "app-module-component",
        "lib",
        { isLibrary: true },
        undecoratedGenerateProcessorOptions,
      ),
      "lib",
    );
  });

  describe("repo-artifact", () => {
    it("appends .git suffix", () => {
      assert.equal(
        decorateElementName("repo-artifact", "demo", {}, defaultGenerateProcessorOptions),
        "demo.git",
      );
    });

    it("skips .git suffix when name already ends with .git", () => {
      assert.equal(
        decorateElementName("repo-artifact", "demo.git", {}, defaultGenerateProcessorOptions),
        "demo.git",
      );
    });
  });

  describe("module-artifact", () => {
    it("appends build system suffix", () => {
      assert.equal(
        decorateElementName(
          "module-artifact",
          "svc",
          { buildSystem: "maven" },
          defaultGenerateProcessorOptions,
        ),
        "svc (maven)",
      );
      assert.equal(
        decorateElementName(
          "module-artifact",
          "svc",
          { buildSystem: "gradle" },
          defaultGenerateProcessorOptions,
        ),
        "svc (gradle)",
      );
      assert.equal(
        decorateElementName(
          "module-artifact",
          "pkg",
          { buildSystem: "npm" },
          defaultGenerateProcessorOptions,
        ),
        "pkg (npm)",
      );
    });

    it("is idempotent for build system suffix", () => {
      assert.equal(
        decorateElementName(
          "module-artifact",
          "svc (maven)",
          { buildSystem: "maven" },
          defaultGenerateProcessorOptions,
        ),
        "svc (maven)",
      );
    });
  });

  describe("app-module-component", () => {
    it("appends (lib) for library modules", () => {
      assert.equal(
        decorateElementName(
          "app-module-component",
          "shared-lib",
          { isLibrary: true },
          defaultGenerateProcessorOptions,
        ),
        "shared-lib (lib)",
      );
    });

    it("leaves non-library names unchanged", () => {
      assert.equal(
        decorateElementName(
          "app-module-component",
          "svc",
          { isLibrary: false },
          defaultGenerateProcessorOptions,
        ),
        "svc",
      );
    });

    it("is idempotent for (lib) suffix", () => {
      assert.equal(
        decorateElementName(
          "app-module-component",
          "shared-lib (lib)",
          { isLibrary: true },
          defaultGenerateProcessorOptions,
        ),
        "shared-lib (lib)",
      );
    });
  });

  describe("declared-rest-contract", () => {
    it("appends API Contract suffix", () => {
      assert.equal(
        decorateElementName(
          "declared-rest-contract",
          "LotsCrudApi",
          {},
          defaultGenerateProcessorOptions,
        ),
        "LotsCrudApi API Contract",
      );
    });

    it("is idempotent for API Contract suffix", () => {
      assert.equal(
        decorateElementName(
          "declared-rest-contract",
          "LotsCrudApi API Contract",
          {},
          defaultGenerateProcessorOptions,
        ),
        "LotsCrudApi API Contract",
      );
    });
  });

  describe("inferred-rest-contract", () => {
    it("appends Inferred REST Contract suffix", () => {
      assert.equal(
        decorateElementName(
          "inferred-rest-contract",
          "LotsCrudController",
          {},
          defaultGenerateProcessorOptions,
        ),
        "LotsCrudController Inferred REST Contract",
      );
    });

    it("is idempotent for Inferred REST Contract suffix", () => {
      assert.equal(
        decorateElementName(
          "inferred-rest-contract",
          "LotsCrudController Inferred REST Contract",
          {},
          defaultGenerateProcessorOptions,
        ),
        "LotsCrudController Inferred REST Contract",
      );
    });
  });
});
