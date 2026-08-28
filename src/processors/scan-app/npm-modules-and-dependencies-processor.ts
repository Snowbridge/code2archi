import type { ProcessorId } from "../../platform/processors/processor-id.js";
import { AbstractProcessor } from "../../platform/processors/processor.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import { buildNpmCreateIntents } from "./npm-discovery.js";

export class NpmModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "npm-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает npm-модули (включая workspaces) и dependencies в репозиториях с buildSystems, содержащим npm.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    return buildNpmCreateIntents(input);
  }
}
