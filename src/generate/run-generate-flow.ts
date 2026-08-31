import {
  GENERATE_ELEMENTS_GROUP_ID,
  GENERATE_VIEWS_GROUP_ID,
  type GlobalArgv,
} from "../cli/processor-groups.js";
import {
  type ProcessorFilters,
  resolveProcessorFilters,
} from "../platform/processors/processor-registry.js";
import { runGenerateProcessorGroup } from "../platform/processors/run-generate-processor-group.js";
import { ArchiModelStore } from "../archimate-model/archi-model-store.js";
import { ArchiModelWriter } from "../archimate-model/archi-model-writer.js";
import { ArchiModelDomWriter } from "../archimate-model/archi-model-dom-writer.js";
import { DiscoveryModelReader } from "../discovery-model/discovery-model-reader.js";
import { getLogger, isDebugEnabled } from "../platform/logging/index.js";
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

  logger.info("step start", { step: 1, action: "elements generation", groupId: GENERATE_ELEMENTS_GROUP_ID });
  runGenerateProcessorGroup(
    GENERATE_ELEMENTS_GROUP_ID,
    discovery,
    archiStore,
    input.processorFilters,
    { decorate: !input.noDecorate },
  );
  logger.info("step completed", { step: 1 });

  logger.info("step start", { step: 2, action: "views generation", groupId: GENERATE_VIEWS_GROUP_ID });
  runGenerateProcessorGroup(
    GENERATE_VIEWS_GROUP_ID,
    discovery,
    archiStore,
    input.processorFilters,
    { decorate: !input.noDecorate },
  );
  logger.info("step completed", { step: 2 });

  logger.info("step start", { step: 3, action: "writing archimate-model", outputFile: input.outputFile });
  new ArchiModelWriter().write({
    outputFile: input.outputFile,
    store: archiStore,
  });
  if (isDebugEnabled()) {
    new ArchiModelDomWriter().write({
      outputFile: input.outputFile,
      store: archiStore,
    });
  }
  logger.info("step completed", { step: 3, outputFile: input.outputFile });

  logger.info("flow completed", { outputFile: input.outputFile });
}
