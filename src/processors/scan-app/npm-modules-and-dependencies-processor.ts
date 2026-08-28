import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import { logCalls, processorLoggerName } from "../../platform/logging/index.js";
import { buildNpmCreateIntents } from "./npm-discovery.js";

export class NpmModulesAndDependenciesProcessor
  implements IProcessor<ScanAppInput, ScanAppOutput>
{
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "npm-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает npm-модули (включая workspaces) и dependencies в репозиториях с buildSystems, содержащим npm.";

  process = logCalls(
    (input: ScanAppInput): ScanAppOutput => buildNpmCreateIntents(input),
    processorLoggerName({
      groupId: "scan-app",
      artifactId: "npm-modules-and-dependencies",
    }),
    "process",
  );
}
