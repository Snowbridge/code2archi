import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTITY_TYPES } from "../../src/discovery-model/entities/entity-types.js";
import { processorRegistry } from "../../src/platform/processors/processor-registry.js";
import "../../src/platform/processors/builtin-processors.js";
import { ELEMENT_SLOT_EN_LABELS } from "./element-slot-labels.js";
import { SCAN_PROCESSOR_ENTITY_TYPES } from "./processor-scan-entities.js";
import type {
  ElementSlotInfo,
  ImplementationStatus,
  ProcessorInfo,
} from "./types.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLICATION_ROOT = path.resolve(SCRIPT_DIR, "../..");
const WORKSPACE_ROOT = path.resolve(APPLICATION_ROOT, "..");

const COMMAND_NAME_PATTERN = /command:\s*["']([^"'\s<]+)/;

const SPECIFIED_COMMANDS = ["scan", "generate", "reconcile", "config"] as const;

function readImplementedCommands(): string[] {
  const commandsDir = path.join(APPLICATION_ROOT, "src/cli/commands");
  return readdirSync(commandsDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => {
      const source = readFileSync(path.join(commandsDir, fileName), "utf8");
      const match = COMMAND_NAME_PATTERN.exec(source);
      if (!match) {
        throw new Error(`Could not parse CLI command name from ${fileName}`);
      }
      return match[1];
    })
    .sort();
}

function readSpecifiedCommands(documentationAvailable: boolean): string[] {
  if (!documentationAvailable) {
    return [...SPECIFIED_COMMANDS];
  }

  const cliSpecDir = path.join(WORKSPACE_ROOT, "documentation/specifications/cli");
  return SPECIFIED_COMMANDS.filter((command) =>
    existsSync(path.join(cliSpecDir, command, "index.md")),
  );
}

function readProcessors(): ProcessorInfo[] {
  return processorRegistry
    .listAll()
    .map((processor) => ({
      coordinate: `${processor.id.groupId}/${processor.id.artifactId}`,
      groupId: processor.id.groupId,
      artifactId: processor.id.artifactId,
      description: processor.description,
    }))
    .sort((left, right) => left.coordinate.localeCompare(right.coordinate));
}

function processorCoordinateToSlotForm(coordinate: string): string {
  const slashIndex = coordinate.indexOf("/");
  if (slashIndex < 0) {
    return coordinate;
  }
  return `${coordinate.slice(0, slashIndex)}:${coordinate.slice(slashIndex + 1)}`;
}

function parseElementSlots(documentationAvailable: boolean): ElementSlotInfo[] {
  if (!documentationAvailable) {
    return [];
  }

  const slotsPath = path.join(
    WORKSPACE_ROOT,
    "documentation/specifications/archimate-model/generated-element-slots.md",
  );
  const markdown = readFileSync(slotsPath, "utf8");
  const slots: ElementSlotInfo[] = [];

  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| `")) {
      continue;
    }

    const columns = line
      .split("|")
      .map((column) => column.trim())
      .filter((column) => column.length > 0);
    if (columns.length < 7 || columns[0] === "Slot") {
      continue;
    }

    const slotId = columns[0].replace(/^`|`$/g, "");
    const kind = columns[1].replace(/^`|`$/g, "");
    const profileLabel = columns[2].replace(/\*\*/g, "").trim();
    const processorCell = columns[3].replace(/\s*\(\+.*\)$/, "");
    const processorCoordinates = processorCell
      .split(",")
      .map((value) => value.trim().replace(/^`|`$/g, ""))
      .filter((value) => value.length > 0);

    for (const processorCoordinate of processorCoordinates) {
      slots.push({
        slotId,
        kind,
        processorCoordinate,
        label: slotDisplayLabel(slotId, kind, profileLabel),
      });
    }
  }

  return slots;
}

function isMostlyEnglish(text: string): boolean {
  return !/[А-Яа-яЁё]/.test(text);
}

function slotDisplayLabel(slotId: string, kind: string, profileLabel: string): string {
  const englishOverride = ELEMENT_SLOT_EN_LABELS[slotId];
  if (englishOverride) {
    return englishOverride;
  }
  if (profileLabel && isMostlyEnglish(profileLabel)) {
    return profileLabel;
  }
  return humanizeSlotLabel(slotId, kind);
}

function humanizeSlotLabel(slotId: string, kind: string): string {
  const words = slotId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const base = words.join(" ");
  if (kind.includes("Relationship")) {
    return `${base} (${kind.split("/").pop() ?? "relationship"})`;
  }
  return base;
}

function collectScanEntityTypes(processors: readonly ProcessorInfo[]): Set<string> {
  const entityTypes = new Set<string>();
  for (const processor of processors) {
    const mapped = SCAN_PROCESSOR_ENTITY_TYPES[processor.coordinate];
    if (!mapped) {
      continue;
    }
    for (const entityType of mapped) {
      entityTypes.add(entityType);
    }
  }
  return entityTypes;
}

function collectImplementedElementSlots(
  processors: readonly ProcessorInfo[],
  elementSlots: readonly ElementSlotInfo[],
): Set<string> {
  const processorCoordinates = new Set(
    processors.map((processor) => processorCoordinateToSlotForm(processor.coordinate)),
  );
  const implemented = new Set<string>();

  for (const slot of elementSlots) {
    if (processorCoordinates.has(slot.processorCoordinate)) {
      implemented.add(slot.slotId);
    }
  }

  return implemented;
}

export function collectImplementationStatus(): ImplementationStatus {
  const documentationAvailable = existsSync(
    path.join(WORKSPACE_ROOT, "documentation/specifications/README.md"),
  );
  const processors = readProcessors();
  const elementSlots = parseElementSlots(documentationAvailable);

  return {
    implementedCommands: readImplementedCommands(),
    specifiedCommands: readSpecifiedCommands(documentationAvailable),
    processors,
    scanEntityTypes: collectScanEntityTypes(processors),
    allEntityTypes: [...ENTITY_TYPES],
    elementSlots,
    implementedElementSlotIds: collectImplementedElementSlots(processors, elementSlots),
    hasViewProcessors: processors.some((processor) =>
      processor.groupId.startsWith("generate.views"),
    ),
    hasPluginHost: existsSync(path.join(APPLICATION_ROOT, "src/platform/plugins")),
    documentationAvailable,
  };
}
