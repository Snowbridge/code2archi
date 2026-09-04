/** English display labels for element slots in README (slot id → label). */
export const ELEMENT_SLOT_EN_LABELS: Readonly<Record<string, string>> = {
  "repo-artifact": "Source repository artifacts",
  "module-artifact": "Module artifacts (Maven / Gradle / npm)",
  "syssoft-runtime": "Runtime catalog (JVM, Node, …)",
  "syssoft-build-system": "Build-tool catalog",
  "syssoft-compiled": "Compiler catalog (Kotlin, TypeScript, tsx)",
  "app-module-component": "Application components per module (including library aggregation)",
  "rest-controller": "REST controller application services",
  "rest-client": "REST client application services",
  "direct-rest-requests-serving": "Direct REST serving between application module components",
};
