import type { EntityType } from "../../src/discovery-model/entities/entity-types.js";
import type { LinkType } from "../../src/discovery-model/links/link-types.js";

/** Scan processors and discovery entity types they create (for gap detection). */
export const SCAN_PROCESSOR_ENTITY_TYPES: Readonly<Record<string, readonly EntityType[]>> = {
  "scan.scope/git-repositories": ["Repository"],
  "scan.scope/unversioned-folders": ["Repository"],
  "scan.source.assembly.maven/modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.source.assembly.gradle/modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.source.assembly.npm/modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.source.java.rest/controller-annotation-based": ["RestController"],
  "scan.source.java.rest/controller-functional-router-based": ["RestController"],
  "scan.source.kotlin.rest/controller-annotation-based": ["RestController"],
  "scan.source.kotlin.rest/controller-ktor-and-router-based": ["RestController"],
  "scan.source.java.rest/client-declarative": ["RestClient"],
  "scan.source.java.rest/client-programmatic": ["RestClient"],
  "scan.source.kotlin.rest/client-declarative": ["RestClient"],
  "scan.source.kotlin.rest/client-programmatic": ["RestClient"],
};

/** Scan processors in scan.link that create link collections (for gap detection). */
export const SCAN_PROCESSOR_LINK_TYPES: Readonly<Record<string, readonly LinkType[]>> = {
  "scan.link.rest/direct-rest-requests-serving": ["DirectRestRequestsServingMatch"],
};
