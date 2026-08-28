import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import { buildMavenCreateIntents } from "./maven-discovery.js";

export class MavenModulesAndDependenciesProcessor
  implements IProcessor<ScanAppInput, ScanAppOutput>
{
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "maven-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Обнаруживает Maven-модули и их зависимости в репозиториях с buildSystems, содержащим maven.";

  process(input: ScanAppInput): ScanAppOutput {
    return buildMavenCreateIntents(input);
  }
}
