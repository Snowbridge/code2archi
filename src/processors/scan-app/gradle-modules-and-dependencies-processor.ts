import type { ProcessorId } from "../../platform/processors/processor-id.js";
import { AbstractProcessor } from "../../platform/processors/processor.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import { buildGradleCreateIntents } from "./gradle-discovery.js";

export class GradleModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "gradle-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает Gradle-модули и implementation-зависимости в репозиториях с buildSystems, содержащим gradle.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    return buildGradleCreateIntents(input);
  }
}
