import type { EntityType } from "../../src/code-inventory/entities/entity-types.js";
import type { LinkType } from "../../src/code-inventory/links/link-types.js";

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
  "scan.extract.rest.controllers/spring-webmvc": [
    "RestController",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.controllers/jax-rs": [
    "RestController",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.controllers/micronaut": [
    "RestController",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.controllers/spring-webflux-router": ["RestController"],
  "scan.extract.rest.controllers/quarkus-vertx": ["RestController"],
  "scan.extract.rest.controllers/ktor": ["RestController"],
  "scan.extract.rest.clients/programmatic-rest-client-components": [
    "RestClient",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.clients/spring-http-exchange": [
    "RestClient",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.clients/retrofit": [
    "RestClient",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.clients/microprofile-rest-client": [
    "RestClient",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.clients/micronaut": [
    "RestClient",
    "HttpApiDataType",
    "HttpApiContract",
  ],
  "scan.extract.rest.clients/supplemented-rest-clients": ["RestClient"],
  "scan.transform.rest/inferred-http-api-contracts": ["HttpApiContract"],
};

const HTTP_API_CONTRACT_ASSIGNMENT: readonly LinkType[] = ["HttpApiContractAssignment"];

/** Scan processors that create link collections (for gap detection). */
export const SCAN_PROCESSOR_LINK_TYPES: Readonly<Record<string, readonly LinkType[]>> = {
  "scan.extract.rest.controllers/spring-webmvc": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.controllers/jax-rs": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.controllers/micronaut": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.clients/programmatic-rest-client-components": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.clients/spring-http-exchange": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.clients/retrofit": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.clients/microprofile-rest-client": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.extract.rest.clients/micronaut": HTTP_API_CONTRACT_ASSIGNMENT,
  "scan.transform.rest/inferred-http-api-contracts": HTTP_API_CONTRACT_ASSIGNMENT,
};
