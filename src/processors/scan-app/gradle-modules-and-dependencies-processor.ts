import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import { logCalls, processorLoggerName } from "../../platform/logging/index.js";
import { buildGradleCreateIntents } from "./gradle-discovery.js";

export class GradleModulesAndDependenciesProcessor
  implements IProcessor<ScanAppInput, ScanAppOutput>
{
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "gradle-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает Gradle-модули и implementation-зависимости в репозиториях с buildSystems, содержащим gradle.";

  process = logCalls(
    (input: ScanAppInput): ScanAppOutput => buildGradleCreateIntents(input),
    processorLoggerName({
      groupId: "scan-app",
      artifactId: "gradle-modules-and-dependencies",
    }),
    "process",
  );
}
