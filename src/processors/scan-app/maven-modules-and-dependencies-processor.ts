import type { ProcessorId } from "../../platform/processors/processor-id.js";
import { AbstractProcessor } from "../../platform/processors/processor.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import { buildMavenCreateIntents } from "./maven-discovery.js";

export class MavenModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "maven-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает Maven-модули и их зависимости в репозиториях с buildSystems, содержащим maven.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    return buildMavenCreateIntents(input);
  }
}
