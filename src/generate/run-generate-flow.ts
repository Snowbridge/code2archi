import {
  type ProcessorFilters,
  resolveProcessorFilters,
} from "../platform/processors/processor-registry.js";
import { runGenerateProcessorGroup } from "../platform/processors/run-generate-processor-group.js";
import type { GlobalArgv } from "../cli/processor-groups.js";
import { ArchiModelStore } from "../archimate-model/archi-model-store.js";
import { ArchiModelWriter } from "../archimate-model/archi-model-writer.js";
import { DiscoveryModelReader } from "../discovery-model/discovery-model-reader.js";
import { getLogger } from "../platform/logging/index.js";
import type { GenerateArgs } from "./validate-generate-args.js";

export interface RunGenerateFlowInput extends GenerateArgs {
  readonly processorFilters: ProcessorFilters;
}

export function createRunGenerateFlowInput(
  generateArgs: GenerateArgs,
  argv: GlobalArgv,
): RunGenerateFlowInput {
  return {
    ...generateArgs,
    processorFilters: resolveProcessorFilters(argv),
  };
}

export function runGenerateFlow(input: RunGenerateFlowInput): void {
  const logger = getLogger("generate.flow");
  logger.info("flow start", {
    outputFile: input.outputFile,
    discoveryModelDir: input.discoveryModelDir,
  });

  const discovery = new DiscoveryModelReader().read(input.discoveryModelDir);
  const archiStore = new ArchiModelStore({
    modelName: input.modelName,
    modelId: input.modelId,
  });

  logger.info("step start", { step: 1, action: "business layer generation", groupId: "generate-biz" });
  runGenerateProcessorGroup("generate-biz", discovery, archiStore, input.processorFilters);
  logger.info("step completed", { step: 1 });

  logger.info("step start", {
    step: 2,
    action: "application layer generation",
    groupId: "generate-app",
  });
  runGenerateProcessorGroup("generate-app", discovery, archiStore, input.processorFilters);
  logger.info("step completed", { step: 2 });

  logger.info("step start", {
    step: 3,
    action: "technology layer generation",
    groupId: "generate-tech",
  });
  runGenerateProcessorGroup("generate-tech", discovery, archiStore, input.processorFilters);
  logger.info("step completed", { step: 3 });

  logger.info("step start", { step: 4, action: "relations generation", groupId: "generate-rel" });
  runGenerateProcessorGroup("generate-rel", discovery, archiStore, input.processorFilters);
  logger.info("step completed", { step: 4 });

  logger.info("step start", { step: 5, action: "views generation", groupId: "generate-view" });
  runGenerateProcessorGroup("generate-view", discovery, archiStore, input.processorFilters);
  logger.info("step completed", { step: 5 });

  logger.info("step start", { step: 6, action: "writing archimate-model", outputFile: input.outputFile });
  new ArchiModelWriter().write({
    outputFile: input.outputFile,
    store: archiStore,
  });
  logger.info("step completed", { step: 6, outputFile: input.outputFile });

  logger.info("flow completed", { outputFile: input.outputFile });
}
