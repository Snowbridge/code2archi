import { NodejsRestClient } from "../../../../../discovery-model/entities/nodejs-rest-client.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { collectNodejsSourceFiles } from "../../../../../parsers/nodejs/nodejs-module-scan.js";
import { extractProgrammaticHttpClients } from "../../../../../parsers/nodejs/programmatic-http-client-extractor.js";
import { parseNodejsSourceFile } from "../../../../../parsers/nodejs/typescript-compilation-unit.js";
import {
  buildNpmModuleContexts,
  forEachNpmRepository,
  readSourceFile,
} from "./nodejs-rest-scan-utils.js";
import { toProgrammaticClientEntity } from "./nodejs-rest-entity-mapper.js";

export class NodejsRestClientProgrammaticProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.source.nodejs.rest",
    artifactId: "client-programmatic",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers programmatic Node.js HTTP clients (axios, fetch, undici, got, node:http, superagent, @nestjs/axios).";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const clients: NodejsRestClient[] = [];

    forEachNpmRepository(input, (repository) => {
      const contexts = buildNpmModuleContexts(input, repository, [
        "axios",
        "got",
        "undici",
        "superagent",
        "@nestjs/axios",
        "express",
        "fastify",
        "hono",
        "koa",
        "@nestjs/common",
        "next",
      ]);

      for (const fileContext of collectNodejsSourceFiles(contexts)) {
        try {
          const source = readSourceFile(fileContext.absolutePath);
          const unit = parseNodejsSourceFile(source, fileContext.absolutePath);
          for (const parsed of extractProgrammaticHttpClients(unit)) {
            clients.push(
              toProgrammaticClientEntity(
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
        NodejsRestClient: clients.map((client) => client.toCreateIntent()),
      },
    };
  }
}
