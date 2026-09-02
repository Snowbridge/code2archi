import type { GapRow, ImplementationStatus } from "./types.js";

function commandStatus(
  status: ImplementationStatus,
  command: string,
): "implemented" | "specified" | "missing" {
  if (status.implementedCommands.includes(command)) {
    return "implemented";
  }
  if (status.specifiedCommands.includes(command)) {
    return "specified";
  }
  return "missing";
}

function missingEntityTypes(status: ImplementationStatus, entityTypes: readonly string[]): string[] {
  return entityTypes.filter((entityType) => !status.scanEntityTypes.has(entityType));
}

function interServiceEntityTypes(): readonly string[] {
  return ["RestClient", "MessageConsumer", "MessageProducer"];
}

function hasJsTsRestScan(status: ImplementationStatus): boolean {
  return status.processors.some(
    (processor) =>
      processor.groupId.includes("javascript") ||
      processor.groupId.includes("typescript") ||
      processor.artifactId.includes("javascript") ||
      processor.artifactId.includes("typescript"),
  );
}

function hasNpmAssemblyOnly(status: ImplementationStatus): boolean {
  const hasNpmAssembly = status.processors.some((processor) =>
    processor.coordinate.startsWith("scan.source.assembly.npm/"),
  );
  const hasJsTsRest = hasJsTsRestScan(status);
  return hasNpmAssembly && !hasJsTsRest;
}

function hasCamundaOrBpmnScan(status: ImplementationStatus): boolean {
  return status.processors.some(
    (processor) =>
      processor.groupId.includes("camunda") ||
      processor.groupId.includes("bpmn") ||
      processor.artifactId.includes("camunda") ||
      processor.artifactId.includes("bpmn"),
  );
}

function technologyInventorySummary(status: ImplementationStatus): string {
  const parts = ["repo/module structure", "versions from build files"];
  if (status.implementedElementSlotIds.has("syssoft-runtime")) {
    parts.push("runtime catalog");
  }
  return `Limited to ${parts.join(", ")}`;
}

export function buildGapRows(status: ImplementationStatus): GapRow[] {
  const reconcile = commandStatus(status, "reconcile");
  const config = commandStatus(status, "config");
  const missingInterService = missingEntityTypes(status, interServiceEntityTypes());
  const totalSlots = new Set(status.elementSlots.map((slot) => slot.slotId)).size;
  const implementedSlotCount = status.implementedElementSlotIds.size;

  return [
    {
      area: "Modelling pipeline",
      intent: "`scan → match → generate → reconcile` as a complete workflow",
      currentState:
        reconcile === "implemented"
          ? "Full pipeline implemented (`scan`, `generate`, `reconcile`)"
          : "`scan` and `generate` work; `reconcile` command missing",
      complete: reconcile === "implemented",
    },
    {
      area: "Reconciliation",
      intent:
        "Compare code, ArchiMate model, and declared contracts (OpenAPI, schemas); surface gaps explicitly",
      capabilityLink: "../documentation/product-intent/capability/reconciliation.md",
      currentState:
        reconcile === "implemented"
          ? "`reconcile` command available"
          : "Not implemented (capability: [reconciliation](../documentation/product-intent/capability/reconciliation.md))",
      complete: reconcile === "implemented",
    },
    {
      area: "Business layer",
      intent: "Camunda / BPMN process inventory and links",
      capabilityLink: "../documentation/product-intent/capability/business-process-inventory.md",
      currentState: hasCamundaOrBpmnScan(status)
        ? "Camunda/BPMN scan processors registered"
        : "Not implemented",
      complete: hasCamundaOrBpmnScan(status),
    },
    {
      area: "Inter-service links",
      intent:
        "HTTP clients, message producers/consumers, cross-service dependencies in the model",
      currentState:
        missingInterService.length === 0
          ? `Discovery entity types covered: ${interServiceEntityTypes().join(", ")}`
          : `Entity types (${missingInterService.join(", ")}) reserved; no scan/generate processors yet`,
      complete: missingInterService.length === 0,
    },
    {
      area: "JavaScript / TypeScript",
      intent: "Source-level discovery alongside JVM languages",
      currentState: hasJsTsRestScan(status)
        ? "JS/TS REST and application parsing processors registered"
        : hasNpmAssemblyOnly(status)
          ? "npm **module assembly** only; no JS/TS REST or application parsing"
          : "No npm or JS/TS source processors yet",
      complete: hasJsTsRestScan(status),
    },
    {
      area: "Technology inventory",
      intent:
        "Broad runtime, framework, and infra-pattern coverage (databases, messaging, deployment)",
      capabilityLink: "../documentation/product-intent/capability/tech-inventory.md",
      currentState: technologyInventorySummary(status),
      complete: false,
    },
    {
      area: "Diagrams",
      intent: "`generate.views` — layout diagrams in Archi",
      currentState: status.hasViewProcessors
        ? `${status.processors.filter((processor) => processor.groupId.startsWith("generate.views")).length} view processor(s) registered`
        : "Processor group exists; **no view processors** registered",
      complete: status.hasViewProcessors,
    },
    {
      area: "Plugins",
      intent: "Extend scan/generate without forking core",
      capabilityLink: "../documentation/product-intent/capability/plugin-extensibility.md",
      currentState: status.hasPluginHost
        ? "Plugin host API available"
        : "Processor registry is internal; **plugin host API not shipped**",
      complete: status.hasPluginHost,
    },
    {
      area: "Run configuration",
      intent: "`config` command, merged CLI + file defaults",
      currentState:
        config === "implemented"
          ? "`config` command available"
          : config === "specified"
            ? "Not implemented"
            : "Not specified",
      complete: config === "implemented",
    },
    {
      area: "Element slot coverage",
      intent: "All documented `generate.elements` slots materialised in `.archimate`",
      currentState:
        totalSlots === 0
          ? "Slot catalog unavailable (documentation path missing)"
          : `${implementedSlotCount}/${totalSlots} documented element slots implemented`,
      complete: totalSlots > 0 && implementedSlotCount === totalSlots,
    },
    {
      area: "Model refresh at scale",
      intent: "Repeatable refresh every release cycle in hours",
      capabilityLink: "../documentation/product-intent/capability/model-refresh.md",
      currentState:
        reconcile === "implemented"
          ? "Re-run supported; reconcile reporting available"
          : "Mechanically possible via re-run; automation, diff, and reconcile reporting still missing",
      complete: reconcile === "implemented",
    },
  ];
}

export function buildGapSummary(status: ImplementationStatus, rows: readonly GapRow[]): string {
  const openAreas = rows.filter((row) => !row.complete).map((row) => row.area.toLowerCase());
  const hasRestScan = status.scanEntityTypes.has("RestController");
  const highlights: string[] = [
    "repositories",
    "modules",
    "build/runtime facts",
  ];
  if (hasRestScan) {
    highlights.push("Java/Kotlin REST surface");
  }

  const strengths = `a solid **first-pass AS-IS map** of ${highlights.join(", ")}`;
  const gaps =
    openAreas.length === 0
      ? "remaining product-intent areas"
      : openAreas.slice(0, 4).join(", ");

  return `In practice today, \`c2a\` gives ${strengths} — enough to open in Archi and review structure. It does **not** yet replace ${gaps}.`;
}
