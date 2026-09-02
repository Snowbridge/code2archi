import type { EntityType } from "../../src/discovery-model/entities/entity-types.js";

/** Scan processors and discovery entity types they create (for gap detection). */
export const SCAN_PROCESSOR_ENTITY_TYPES: Readonly<Record<string, readonly EntityType[]>> = {
  "scan.scope/git-repos": ["Repository"],
  "scan.scope/unversioned-folders": ["Repository"],
  "scan.source.assembly.maven/maven-modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.source.assembly.gradle/gradle-modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.source.assembly.npm/npm-modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.source.rest.controller.java/annotation-based": ["RestController"],
  "scan.source.rest.controller.java/functional-router-based": ["RestController"],
  "scan.source.rest.controller.kotlin/annotation-based": ["RestController"],
  "scan.source.rest.controller.kotlin/ktor-and-router-based": ["RestController"],
  "scan.source.rest.client.java/declarative": ["RestClient"],
  "scan.source.rest.client.java/programmatic": ["RestClient"],
  "scan.source.rest.client.kotlin/declarative": ["RestClient"],
  "scan.source.rest.client.kotlin/programmatic": ["RestClient"],
};
