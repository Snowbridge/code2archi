import { writeFileSync } from "node:fs";
import path from "node:path";
import type { ProcessorListEntry } from "./format-processors-table.js";

export const PROCESSORS_LIST_JSON_FILENAME = "code2archi-processors-list.json";

export type ProcessorsListJson =
  | { readonly processors: readonly ProcessorListEntry[] }
  | { readonly groups: readonly string[] };

export function writeProcessorsListJson(
  payload: ProcessorsListJson,
  cwd: string = process.cwd(),
): string {
  const outputPath = path.join(cwd, PROCESSORS_LIST_JSON_FILENAME);
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outputPath;
}
