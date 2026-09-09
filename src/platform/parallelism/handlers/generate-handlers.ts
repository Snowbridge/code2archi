import type { ArchiCreateIntents } from "../../../archimate-model/archi-create-intents.js";
import { processorRegistry } from "../../processors/processor-registry.js";
import type { GenerateProcessorInput } from "../../processors/processor.js";
import { withProcessorSupplements } from "../../processors/processor-supplements.js";
import { runProcessorWithMetrics } from "../../profiling/flow-metrics.js";
import { deserializeArchiSnapshot, deserializeDiscoverySnapshot } from "../snapshot-serialization.js";
import type { GenerateProcessorTaskInput } from "../task-inputs.js";

export function runGenerateProcessorTask(input: GenerateProcessorTaskInput): ArchiCreateIntents {
  const processor = processorRegistry.get(input.processor.groupId, input.processor.artifactId);
  if (!processor) {
    throw new Error(
      `Processor not found: ${input.processor.groupId}/${input.processor.artifactId}`,
    );
  }

  const generateInput = withProcessorSupplements(
    {
      discovery: deserializeDiscoverySnapshot(input.discovery),
      archi: deserializeArchiSnapshot(input.archi),
      options: { decorate: input.decorate },
    },
    input.supplements ?? [],
  );

  processor.logStart();
  const output = runProcessorWithMetrics(input.processor, () =>
    processor.process(generateInput),
  ) as ArchiCreateIntents;
  if (output instanceof Promise) {
    throw new Error(
      `Processor ${input.processor.groupId}/${input.processor.artifactId} returned a Promise`,
    );
  }

  const count =
    (output.folders?.length ?? 0) +
    (output.elements?.length ?? 0) +
    (output.profiles?.length ?? 0) +
    (output.relations?.length ?? 0);
  processor.logCompleted(count);
  return output;
}
