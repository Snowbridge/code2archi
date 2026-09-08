import { readFileSync } from "node:fs";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import type { RepositoryRecord } from "../../../../../code-inventory/entities/repository.js";
import {
  registerSyntheticController,
  syntheticFqcn,
  syntheticSimpleName,
} from "../../../../../scan/extract/rest/discover-jvm-rest-module.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";
import { listProductionJvmSources } from "../../../../../scan/extract/rest/list-module-sources.js";
import { moduleProductionRoot } from "../../../../../scan/extract/rest/module-binding.js";
import { productionSourceRelativePath } from "../../../../../scan/extract/rest/source-scope.js";
import { formatHttpEndpoint } from "../../../../../scan/extract/rest/endpoint-format.js";

export class KtorProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.controllers",
    artifactId: "ktor",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Ktor routing { } blocks and HTTP verb registrations from JVM src/main Kotlin sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        discoverKtorRouting(repository, module, builder);
      }
    });

    return builder.build();
  }
}

function discoverKtorRouting(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
  builder: RestDiscoveryIntentBuilder,
): void {
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  for (const absolutePath of listProductionJvmSources(productionRoot)) {
    if (!absolutePath.endsWith(".kt") && !absolutePath.endsWith(".kts")) {
      continue;
    }
    const source = readFileSync(absolutePath, "utf8");
    if (!source.includes("routing")) {
      continue;
    }
    const endpoints = extractKtorEndpoints(source);
    if (endpoints.length === 0) {
      continue;
    }
    const fileName = productionSourceRelativePath(absolutePath, repository.localPath);
    const fqcn = syntheticFqcn("KtorRouting", module.id, fileName);
    registerSyntheticController(builder, {
      applicationModuleId: module.id,
      fqcn,
      simpleName: syntheticSimpleName(fqcn),
      fileName,
      endpoints,
    });
  }
}

function extractKtorEndpoints(source: string): string[] {
  const endpoints: string[] = [];
  const routePattern = /\b(get|post|put|delete|patch|head|options)\s*\(\s*"([^"]+)"/gi;
  for (const match of source.matchAll(routePattern)) {
    endpoints.push(formatHttpEndpoint(match[1]!, match[2]!));
  }
  return endpoints;
}
