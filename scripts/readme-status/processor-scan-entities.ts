import type { EntityType } from "../../src/discovery-model/entities/entity-types.js";
import type { LinkType } from "../../src/discovery-model/links/link-types.js";

/** Scan processors and discovery entity types they create (for gap detection). */
export const SCAN_PROCESSOR_ENTITY_TYPES: Readonly<Record<string, readonly EntityType[]>> = {
  "scan.scope/git-repositories": ["Repository"],
  "scan.scope/unversioned-folders": ["Repository"],
  "scan.extract.assembly.maven/modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.extract.assembly.gradle/modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.extract.assembly.npm/modules-and-dependencies": [
    "ApplicationModule",
    "ApplicationModuleDependency",
  ],
  "scan.extract.java.rest/controller-annotation-based": ["HttpServerApi"],
  "scan.extract.java.rest/controller-functional-router-based": ["HttpServerApi"],
  "scan.extract.kotlin.rest/controller-annotation-based": ["HttpServerApi"],
  "scan.extract.kotlin.rest/controller-ktor-and-router-based": ["HttpServerApi"],
  "scan.extract.java.rest/client-declarative": ["HttpClientApi"],
  "scan.extract.java.rest/client-programmatic": ["HttpClientApi"],
  "scan.extract.kotlin.rest/client-declarative": ["HttpClientApi"],
  "scan.extract.kotlin.rest/client-programmatic": ["HttpClientApi"],
  "scan.extract.nodejs.rest/controller-functional-router": ["HttpServerApi"],
  "scan.extract.nodejs.rest/controller-declarative": ["HttpServerApi"],
  "scan.extract.nodejs.rest/controller-nextjs-app-router": ["HttpServerApi"],
  "scan.extract.nodejs.rest/client-programmatic": ["HttpClientApi"],
};

/** Scan processors in scan.transform that create link collections (for gap detection). */
export const SCAN_PROCESSOR_LINK_TYPES: Readonly<Record<string, readonly LinkType[]>> = {
  "scan.transform.rest/clients-to-controllers-links": ["HttpClientApiToControllerLink"],
};
