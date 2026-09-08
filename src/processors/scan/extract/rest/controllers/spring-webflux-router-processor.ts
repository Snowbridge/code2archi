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

export class SpringWebfluxRouterProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.controllers",
    artifactId: "spring-webflux-router",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Spring WebFlux RouterFunction and CoRouterFunction routes from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        discoverRouterFunctions(repository, module, builder);
      }
    });

    return builder.build();
  }
}

function discoverRouterFunctions(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
  builder: RestDiscoveryIntentBuilder,
): void {
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  for (const absolutePath of listProductionJvmSources(productionRoot)) {
    const source = readFileSync(absolutePath, "utf8");
    if (!source.includes("RouterFunction") && !source.includes("CoRouterFunction")) {
      continue;
    }
    const kotlinMatches = [...source.matchAll(
      /(?:fun|def)\s+(\w+)\s*\([^)]*\)\s*:\s*(?:RouterFunction|CoRouterFunction)/g,
    )];
    const fileName = productionSourceRelativePath(absolutePath, repository.localPath);
    if (kotlinMatches.length > 0) {
      for (const match of kotlinMatches) {
        const symbol = match[1]!;
        const endpoints = extractSpringRouterEndpoints(source);
        if (endpoints.length === 0) {
          continue;
        }
        const fqcn = syntheticFqcn("RouterFunction", module.id, fileName, symbol);
        registerSyntheticController(builder, {
          applicationModuleId: module.id,
          fqcn,
          simpleName: syntheticSimpleName(fqcn),
          fileName,
          endpoints,
        });
      }
      continue;
    }
    const javaSymbol = /RouterFunction\s+(\w+)\s*\(/.exec(source);
    if (javaSymbol) {
      const endpoints = extractSpringRouterEndpoints(source);
      if (endpoints.length > 0) {
        const fqcn = syntheticFqcn("RouterFunction", module.id, fileName, javaSymbol[1]!);
        registerSyntheticController(builder, {
          applicationModuleId: module.id,
          fqcn,
          simpleName: syntheticSimpleName(fqcn),
          fileName,
          endpoints,
        });
      }
    }
  }
}

function extractSpringRouterEndpoints(source: string): string[] {
  const endpoints: string[] = [];
  const predicatePattern =
    /RequestPredicates\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*"([^"]+)"/g;
  for (const match of source.matchAll(predicatePattern)) {
    endpoints.push(formatHttpEndpoint(match[1]!, match[2]!));
  }
  return endpoints;
}
