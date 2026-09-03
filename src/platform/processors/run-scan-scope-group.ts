import { SCAN_SCOPE_GROUP_ID } from "../../cli/processor-groups.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import { runProcessorWithMetrics } from "../profiling/flow-metrics.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanScopeInput, ScanScopeOutput } from "./processor.js";
import { getLogger } from "../logging/index.js";

export function runScanScopeGroup(
  input: ScanScopeInput,
  filters: ProcessorFilters,
  store: RunEntityStore,
  progress?: StepProgressHandle,
): void {
  const logger = getLogger("scan.scope");
  logger.info("group start", { groupId: SCAN_SCOPE_GROUP_ID, sourceDirCount: input.length });

  const processors = processorRegistry.listForBuiltInStep<ScanScopeInput, ScanScopeOutput>(
    SCAN_SCOPE_GROUP_ID,
    filters,
  );

  for (const processor of processors) {
    processor.logStart();

    const output = runProcessorWithMetrics(processor.id, () => processor.process(input));
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    if (output.length === 0) {
      processor.logCompleted(0);
      progress?.tick(1);
      continue;
    }

    store.addCreateIntents(SCAN_SCOPE_GROUP_ID, processor.id, {
      entities: {
        Repository: [...output],
      },
    });
    processor.logCompleted(output.length);
    progress?.tick(1);
  }

  logger.info("group completed", {
    groupId: SCAN_SCOPE_GROUP_ID,
    repositoryCount: store.getEntities("Repository").length,
  });
}
