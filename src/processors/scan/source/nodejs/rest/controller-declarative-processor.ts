import { NodejsRestController } from "../../../../../discovery-model/entities/nodejs-rest-controller.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { extractNestJsControllers } from "../../../../../parsers/nodejs/nestjs-controller-extractor.js";
import { collectNodejsSourceFiles } from "../../../../../parsers/nodejs/nodejs-module-scan.js";
import { parseScanNodejsFile } from "../../../../../platform/scan-io/index.js";
import {
  buildNpmModuleContexts,
  forEachNpmRepository,
} from "./nodejs-rest-scan-utils.js";
import { toNestJsControllerEntity } from "./nodejs-rest-entity-mapper.js";

export class NodejsRestControllerDeclarativeProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.source.nodejs.rest",
    artifactId: "controller-declarative",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description = "Discovers NestJS declarative REST controllers.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const controllers: NodejsRestController[] = [];

    forEachNpmRepository(input, (repository) => {
      const contexts = buildNpmModuleContexts(input, repository, ["@nestjs/common"]);

      for (const fileContext of collectNodejsSourceFiles(contexts)) {
        try {
          const unit = parseScanNodejsFile(fileContext.absolutePath);
          for (const parsed of extractNestJsControllers(unit)) {
            controllers.push(
              toNestJsControllerEntity(
                parsed,
                fileContext.module,
                fileContext.repository,
                fileContext.absolutePath,
              ),
            );
          }
        } catch (error) {
          this.logger.warn("failed to parse nodejs source file", {
            file: fileContext.absolutePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return {
      entities: {
        NodejsRestController: controllers.map((controller) => controller.toCreateIntent()),
      },
    };
  }
}
