import { computeArchiId } from "../archimate-model/archi-id.js";
import type { ArchiProfile } from "../archimate-model/profiles/profile.js";
import {
  BuiltWithProfile,
  CompiledWithProfile,
  GradleModuleArtifactProfile,
  MavenModuleArtifactProfile,
  NpmModuleArtifactProfile,
  RunsOnProfile,
} from "../archimate-model/profiles/profile.js";
import type { BuildSystem } from "../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../discovery-model/entities/entity-types.js";
import {
  MODULE_VERSION_FIELDS,
  type ModuleVersionField,
  UNKNOWN_VERSION,
} from "../parsers/build-tool-versions.js";
import type { GenerateConfidence } from "./archi-element-properties.js";

export interface ApplicationModuleVersionSource {
  readonly buildSystem: BuildSystem;
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
  readonly typescriptVersion: string;
  readonly tsxVersion: string;
}

export interface VersionFieldSpec {
  readonly field: ModuleVersionField;
  readonly assignmentProfile: ArchiProfile;
  readonly displayLabel: string;
  readonly usesBuildSystemKey: boolean;
}

export const VERSION_FIELD_SPECS: readonly VersionFieldSpec[] = [
  {
    field: "javaVersion",
    assignmentProfile: RunsOnProfile.create(),
    displayLabel: "Java",
    usesBuildSystemKey: false,
  },
  {
    field: "nodeVersion",
    assignmentProfile: RunsOnProfile.create(),
    displayLabel: "Node",
    usesBuildSystemKey: false,
  },
  {
    field: "kotlinJvmTarget",
    assignmentProfile: CompiledWithProfile.create(),
    displayLabel: "Kotlin JVM",
    usesBuildSystemKey: false,
  },
  {
    field: "kotlinCompilerVersion",
    assignmentProfile: CompiledWithProfile.create(),
    displayLabel: "Kotlin",
    usesBuildSystemKey: false,
  },
  {
    field: "typescriptVersion",
    assignmentProfile: CompiledWithProfile.create(),
    displayLabel: "TypeScript",
    usesBuildSystemKey: false,
  },
  {
    field: "tsxVersion",
    assignmentProfile: CompiledWithProfile.create(),
    displayLabel: "tsx",
    usesBuildSystemKey: false,
  },
  {
    field: "buildToolVersion",
    assignmentProfile: BuiltWithProfile.create(),
    displayLabel: "",
    usesBuildSystemKey: true,
  },
];

const VERSION_FIELD_SPEC_BY_FIELD = new Map(
  VERSION_FIELD_SPECS.map((spec) => [spec.field, spec] as const),
);

export interface SystemSoftwareCatalogEntry {
  readonly field: ModuleVersionField;
  readonly value: string;
  readonly buildSystem?: BuildSystem;
  readonly displayName: string;
  readonly stableKey: string;
  readonly systemSoftwareId: string;
  readonly confidence: GenerateConfidence;
}

export function isEligibleApplicationModule(record: DiscoveryEntityRecord): boolean {
  return !(record.isMultimodule === true && record.parentId === undefined);
}

export function confidenceForVersion(value: string): GenerateConfidence {
  return value === UNKNOWN_VERSION ? "unknown" : "confirmed";
}

export function moduleArtifactProfileFor(buildSystem: BuildSystem): ArchiProfile {
  switch (buildSystem) {
    case "maven":
      return MavenModuleArtifactProfile.create();
    case "gradle":
      return GradleModuleArtifactProfile.create();
    case "npm":
      return NpmModuleArtifactProfile.create();
  }
}

function buildToolDisplayLabel(buildSystem: BuildSystem): string {
  switch (buildSystem) {
    case "maven":
      return "Maven";
    case "gradle":
      return "Gradle";
    case "npm":
      return "npm";
  }
}

function normalizeBuildToolDisplayValue(buildSystem: BuildSystem, value: string): string {
  if (buildSystem !== "npm") {
    return value;
  }
  if (value.startsWith("npm@")) {
    return value.slice("npm@".length);
  }
  return value;
}

export function systemSoftwareDisplayName(
  field: ModuleVersionField,
  value: string,
  buildSystem?: BuildSystem,
): string {
  if (field === "buildToolVersion") {
    if (buildSystem === undefined) {
      throw new Error("buildSystem is required for buildToolVersion display name");
    }
    const normalizedValue = normalizeBuildToolDisplayValue(buildSystem, value);
    return `${buildToolDisplayLabel(buildSystem)} ${normalizedValue}`;
  }

  const spec = VERSION_FIELD_SPEC_BY_FIELD.get(field);
  if (spec === undefined) {
    throw new Error(`Unknown version field: ${field}`);
  }
  return `${spec.displayLabel} ${value}`;
}

export function systemSoftwareStableKey(
  field: ModuleVersionField,
  value: string,
  buildSystem?: BuildSystem,
): string {
  if (field === "buildToolVersion") {
    if (buildSystem === undefined) {
      throw new Error("buildSystem is required for buildToolVersion stable key");
    }
    return `${field}\u0000${buildSystem}\u0000${value}`;
  }
  return `${field}\u0000${value}`;
}

export function systemSoftwareIdForEntry(
  field: ModuleVersionField,
  value: string,
  buildSystem?: BuildSystem,
): string {
  if (field === "buildToolVersion") {
    if (buildSystem === undefined) {
      throw new Error("buildSystem is required for buildToolVersion id");
    }
    return computeArchiId("SystemSoftware", field, buildSystem, value);
  }
  return computeArchiId("SystemSoftware", field, value);
}

export function assignmentLogicalId(
  field: ModuleVersionField,
  systemSoftwareId: string,
  moduleId: string,
): string {
  return `assignment:${field}:${systemSoftwareId}:${moduleId}`;
}

export function assignmentRelationshipId(sourceId: string, targetId: string): string {
  return computeArchiId("AssignmentRelationship", sourceId, targetId);
}

function versionValueForField(
  module: ApplicationModuleVersionSource,
  field: ModuleVersionField,
): string {
  return module[field];
}

export function collectSystemSoftwareCatalog(
  modules: readonly ApplicationModuleVersionSource[],
): Map<string, SystemSoftwareCatalogEntry> {
  const catalog = new Map<string, SystemSoftwareCatalogEntry>();

  for (const module of modules) {
    for (const field of MODULE_VERSION_FIELDS) {
      const value = versionValueForField(module, field);
      const buildSystem = field === "buildToolVersion" ? module.buildSystem : undefined;
      const stableKey = systemSoftwareStableKey(field, value, buildSystem);
      if (catalog.has(stableKey)) {
        continue;
      }

      catalog.set(stableKey, {
        field,
        value,
        ...(buildSystem !== undefined ? { buildSystem } : {}),
        displayName: systemSoftwareDisplayName(field, value, buildSystem),
        stableKey,
        systemSoftwareId: systemSoftwareIdForEntry(field, value, buildSystem),
        confidence: confidenceForVersion(value),
      });
    }
  }

  return catalog;
}

export function versionFieldSpec(field: ModuleVersionField): VersionFieldSpec {
  const spec = VERSION_FIELD_SPEC_BY_FIELD.get(field);
  if (spec === undefined) {
    throw new Error(`Unknown version field: ${field}`);
  }
  return spec;
}
