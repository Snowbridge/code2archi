import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { formatRunTimestamp } from "../../src/platform/timestamp.js";

describe("formatRunTimestamp", () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Etc/GMT-3";
  });

  afterEach(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it("formats host-local timestamp with fractional seconds and offset", () => {
    const date = new Date("2026-08-23T18:33:56.123Z");
    assert.equal(formatRunTimestamp(date), "2026-08-23T21-33-56.1230+0300");
  });

  it("pads single-digit month/day/time parts", () => {
    const date = new Date("2026-01-05T06:08:07.000Z");
    assert.equal(formatRunTimestamp(date), "2026-01-05T09-08-07.0000+0300");
  });

  it("matches profile artifact name template", () => {
    const date = new Date("2026-08-27T09:00:45.000Z");
    const profileName = `code2archi-profile-scan-${formatRunTimestamp(date)}.json`;
    assert.equal(
      profileName,
      "code2archi-profile-scan-2026-08-27T12-00-45.0000+0300.json",
    );
  });
});
