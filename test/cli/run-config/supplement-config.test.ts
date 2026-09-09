import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeRunConfigSections, parseRunConfigDocument } from "../../../src/cli/run-config/merge-run-config.js";
import { runConfigToArgvParts } from "../../../src/cli/run-config/run-config-to-argv.js";
import { supplementToken } from "../../../src/platform/processors/processor-supplements.js";

describe("run-config supplement", () => {
  it("normalizes structured YAML to coord@path tokens", () => {
    const { root, command } = parseRunConfigDocument(
      {
        scan: {
          supplement: [
            {
              target: "scan.transform.rest.client-serving",
              paths: [".c2a/contracts.txt"],
            },
          ],
        },
      },
      "scan",
    );
    const effective = mergeRunConfigSections(root, command);
    assert.deepEqual(effective.supplement, [
      supplementToken("scan.transform.rest.client-serving", ".c2a/contracts.txt"),
    ]);
  });

  it("emits --supplement argv tokens from effective config", () => {
    const token = supplementToken("scan.scope.git-repositories", ".c2a/hints.txt");
    const parts = runConfigToArgvParts(
      {
        supplement: [token],
      },
      "scan",
      new Set(),
    );
    assert.deepEqual(parts.optionTokens, ["--supplement", token]);
  });
});
