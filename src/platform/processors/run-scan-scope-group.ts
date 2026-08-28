import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-filters.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanScopeInput, ScanScopeOutput } from "./scan-scope-types.js";
import { getLogger } from "../logging/index.js";

export function runScanScopeGroup(
  input: ScanScopeInput,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  const logger = getLogger("scan.scope");
  logger.info("group start", { groupId: "scan-scope", sourceDirCount: input.length });

  const processors = processorRegistry.listFiltered<ScanScopeInput, ScanScopeOutput>(
    "scan-scope",
    filters,
  );

  for (const processor of processors) {
    const processorLogger = getLogger(
      `processor.${processor.id.groupId}.${processor.id.artifactId}`,
    );
    processorLogger.info("processor start");

    const output = processor.process(input);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    if (output.length === 0) {
      processorLogger.info("processor completed", { count: 0 });
      continue;
    }

    store.addCreateIntents("scan-scope", processor.id, {
      entities: {
        Repository: [...output],
      },
    });
    processorLogger.info("processor completed", { count: output.length });
  }

  logger.info("group completed", {
    groupId: "scan-scope",
    repositoryCount: store.getEntities("Repository").length,
  });
}
