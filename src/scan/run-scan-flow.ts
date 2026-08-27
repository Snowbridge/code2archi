import type { ScanArgs } from "./validate-scan-args.js";

export function runScanFlow(args: ScanArgs): void {
  const traverseNote = args.noTraverse ? " (no-traverse)" : "";
  console.log(`[scan] step 1/4: repository discovery (scan-scope)${traverseNote}`);
  console.log("[scan] step 2/4: technology layer discovery (scan-tech)");
  console.log("[scan] step 3/4: application layer discovery (scan-app)");
  console.log(`[scan] step 4/4: writing discovery-model to ${args.outputDir}`);
}
