/** English display labels for element slots in README (slot id → label). */
export const ELEMENT_SLOT_EN_LABELS: Readonly<Record<string, string>> = {
  "repo-artifact": "Source repository artifacts",
  "module-artifact": "Module artifacts (Maven / Gradle / npm)",
  "syssoft-runtime": "Runtime catalog (JVM, Node, …)",
  "syssoft-build-system": "Build-tool catalog",
  "syssoft-compiled": "Compiler catalog (Kotlin, TypeScript, tsx)",
  "app-module-component": "Application components per module",
  "module-lib-aggregation": "Build-time module dependency aggregations",
  "rest-controller-app-service": "REST controller application services",
  "app-module-realizes-rest-controller": "Module-to-REST-controller realizations",
  "rest-api-contract-interface": "REST API contract interfaces",
  "rest-api-contract-assignment": "REST API contract assignments",
  "rest-controller-serves-rest-client": "REST controller to REST client servings",
  "rest-controller-serves-app-component": "REST controller to consumer component servings",
};
