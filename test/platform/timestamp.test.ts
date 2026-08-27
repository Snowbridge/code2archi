import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRunTimestamp } from "../../src/platform/timestamp.js";

describe("formatRunTimestamp", () => {
  it("formats UTC compact timestamp", () => {
    const date = new Date("2026-08-27T12:00:45.123Z");
    assert.equal(formatRunTimestamp(date), "20260827T120045Z");
  });

  it("pads single-digit month/day/time parts", () => {
    const date = new Date("2026-01-05T09:08:07.000Z");
    assert.equal(formatRunTimestamp(date), "20260105T090807Z");
  });

  it("matches profile artifact name template", () => {
    const date = new Date("2026-08-27T12:00:45.000Z");
    const profileName = `code2archi-profile-scan-${formatRunTimestamp(date)}.json`;
    assert.equal(profileName, "code2archi-profile-scan-20260827T120045Z.json");
  });
});
