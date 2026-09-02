import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectImplementationStatus } from "./readme-status/collect.js";
import { renderReadmeStatusSections } from "./readme-status/render.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLICATION_ROOT = path.resolve(SCRIPT_DIR, "..");
const README_PATH = path.join(APPLICATION_ROOT, "README.md");

const MARKERS = {
  whatWorksToday: {
    begin: "<!-- readme-status:begin:what-works -->",
    end: "<!-- readme-status:end:what-works -->",
  },
  gapVsProductIntent: {
    begin: "<!-- readme-status:begin:gap -->",
    end: "<!-- readme-status:end:gap -->",
  },
} as const;

function replaceMarkedSection(
  readme: string,
  begin: string,
  end: string,
  replacement: string,
): string {
  const beginIndex = readme.indexOf(begin);
  const endIndex = readme.indexOf(end);

  if (beginIndex < 0 || endIndex < 0 || endIndex < beginIndex) {
    throw new Error(`README markers not found for section ${begin} … ${end}`);
  }

  const before = readme.slice(0, beginIndex + begin.length);
  const after = readme.slice(endIndex);
  return `${before}\n\n${replacement}\n\n${after}`;
}

function syncReadme(checkOnly: boolean): void {
  const status = collectImplementationStatus();
  const sections = renderReadmeStatusSections(status);
  const currentReadme = readFileSync(README_PATH, "utf8");

  let nextReadme = replaceMarkedSection(
    currentReadme,
    MARKERS.whatWorksToday.begin,
    MARKERS.whatWorksToday.end,
    sections.whatWorksToday,
  );
  nextReadme = replaceMarkedSection(
    nextReadme,
    MARKERS.gapVsProductIntent.begin,
    MARKERS.gapVsProductIntent.end,
    sections.gapVsProductIntent,
  );

  if (checkOnly) {
    if (nextReadme !== currentReadme) {
      console.error(
        "README status sections are out of date. Run: npm run readme:sync",
      );
      process.exit(1);
    }
    return;
  }

  if (nextReadme !== currentReadme) {
    writeFileSync(README_PATH, nextReadme, "utf8");
    console.log("Updated README status sections.");
    return;
  }

  console.log("README status sections are already up to date.");
}

const checkOnly = process.argv.includes("--check");
syncReadme(checkOnly);
