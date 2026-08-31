import type { BuildSystem } from "../discovery-model/entities/application-module.js";
import {
  MODULE_VERSION_FIELDS,
  UNKNOWN_VERSION,
  type ModuleVersionField,
} from "../parsers/build-tool-versions.js";
import type { ApplicationModuleVersionSource } from "./module-version-catalog.js";
import {
  systemSoftwareDisplayName,
  systemSoftwareIdForEntry,
  systemSoftwareStableKey,
} from "./module-version-catalog.js";

export interface ApplicationModuleUnknownMarkerSource extends ApplicationModuleVersionSource {
  readonly id: string;
}

export interface UnknownSystemSoftwareCatalogEntry {
  readonly field: ModuleVersionField;
  readonly buildSystem?: BuildSystem;
  readonly displayName: string;
  readonly stableKey: string;
  readonly systemSoftwareId: string;
}

export interface UnknownVersionAssignment {
  readonly moduleId: string;
  readonly field: ModuleVersionField;
  readonly catalogEntry: UnknownSystemSoftwareCatalogEntry;
}

export interface UnknownVersionMarkers {
  readonly catalog: Map<string, UnknownSystemSoftwareCatalogEntry>;
  readonly assignments: readonly UnknownVersionAssignment[];
}

const JVM_BUILD_SYSTEMS: ReadonlySet<BuildSystem> = new Set(["maven", "gradle"]);

export function isUnknownVersionFieldApplicable(
  field: ModuleVersionField,
  buildSystem: BuildSystem,
): boolean {
  switch (field) {
    case "buildToolVersion":
      return true;
    case "javaVersion":
    case "kotlinJvmTarget":
    case "kotlinCompilerVersion":
      return JVM_BUILD_SYSTEMS.has(buildSystem);
    case "nodeVersion":
    case "typescriptVersion":
    case "tsxVersion":
      return buildSystem === "npm";
  }
}

function versionValueForField(
  module: ApplicationModuleVersionSource,
  field: ModuleVersionField,
): string {
  return module[field];
}

export function collectUnknownVersionMarkers(
  modules: readonly ApplicationModuleUnknownMarkerSource[],
): UnknownVersionMarkers {
  const catalog = new Map<string, UnknownSystemSoftwareCatalogEntry>();
  const assignments: UnknownVersionAssignment[] = [];

  for (const module of modules) {
    const buildSystem = module.buildSystem;

    for (const field of MODULE_VERSION_FIELDS) {
      if (!isUnknownVersionFieldApplicable(field, buildSystem)) {
        continue;
      }

      const value = versionValueForField(module, field);
      if (value !== UNKNOWN_VERSION) {
        continue;
      }

      const buildSystemKey = field === "buildToolVersion" ? buildSystem : undefined;
      const stableKey = systemSoftwareStableKey(field, UNKNOWN_VERSION, buildSystemKey);
      let catalogEntry = catalog.get(stableKey);
      if (catalogEntry === undefined) {
        catalogEntry = {
          field,
          ...(buildSystemKey !== undefined ? { buildSystem: buildSystemKey } : {}),
          displayName: systemSoftwareDisplayName(field, UNKNOWN_VERSION, buildSystemKey),
          stableKey,
          systemSoftwareId: systemSoftwareIdForEntry(field, UNKNOWN_VERSION, buildSystemKey),
        };
        catalog.set(stableKey, catalogEntry);
      }

      assignments.push({
        moduleId: module.id,
        field,
        catalogEntry,
      });
    }
  }

  return { catalog, assignments };
}
