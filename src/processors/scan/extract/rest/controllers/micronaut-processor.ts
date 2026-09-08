import { readFileSync } from "node:fs";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../../../code-inventory/entities/repository.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import {
  discoverJvmRestControllersForModule,
  registerSyntheticController,
  syntheticFqcn,
  syntheticSimpleName,
} from "../../../../../scan/extract/rest/discover-jvm-rest-module.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";
import {
  extractMicronautClassPathPrefix,
  extractMicronautEndpoints,
  isMicronautController,
  isMicronautRouteBuilder,
} from "../../../../../scan/extract/rest/micronaut-mapping.js";
import { listProductionJvmSources } from "../../../../../scan/extract/rest/list-module-sources.js";
import { moduleProductionRoot } from "../../../../../scan/extract/rest/module-binding.js";
import { productionSourceRelativePath } from "../../../../../scan/extract/rest/source-scope.js";
import { formatHttpEndpoint } from "../../../../../scan/extract/rest/endpoint-format.js";

export class MicronautProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.controllers",
    artifactId: "micronaut",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Micronaut @Controller and RouteBuilder REST routes from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        const moduleBuilder = discoverJvmRestControllersForModule(repository, module, {
          isEligible: (type) => isMicronautController(type) || isMicronautRouteBuilder(type),
          extractEndpoints: (type) => {
            if (isMicronautRouteBuilder(type)) {
              return extractRouteBuilderEndpoints(
                readSourceForType(repository, module, type.fqcn),
                module.id,
              );
            }
            return extractMicronautEndpoints(type, extractMicronautClassPathPrefix(type));
          },
        });
        builder.mergeFrom(moduleBuilder);
        discoverRouteBuildersFromSources(repository, module, builder);
      }
    });

    return builder.build();
  }
}

function readSourceForType(repository: RepositoryRecord, module: ApplicationModuleRecord, fqcn: string): string {
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  const sources = listProductionJvmSources(productionRoot);
  for (const absolutePath of sources) {
    const source = readFileSync(absolutePath, "utf8");
    if (source.includes(fqcn.split(".").pop() ?? "")) {
      return source;
    }
  }
  return "";
}

function extractRouteBuilderEndpoints(source: string, applicationModuleId: string): string[] {
  const endpoints: string[] = [];
  const routePattern = /(GET|POST|PUT|DELETE|PATCH)\s*\(\s*"([^"]+)"/g;
  for (const match of source.matchAll(routePattern)) {
    endpoints.push(formatHttpEndpoint(match[1]!, match[2]!));
  }
  return endpoints;
}

function discoverRouteBuildersFromSources(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
  builder: RestDiscoveryIntentBuilder,
): void {
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  for (const absolutePath of listProductionJvmSources(productionRoot)) {
    const source = readFileSync(absolutePath, "utf8");
    if (!source.includes("RouteBuilder")) {
      continue;
    }
    const symbolMatch = /(?:class|object)\s+(\w+)/.exec(source);
    const symbol = symbolMatch?.[1] ?? "RouteBuilder";
    const endpoints = extractRouteBuilderEndpoints(source, module.id);
    if (endpoints.length === 0) {
      continue;
    }
    const fileName = productionSourceRelativePath(absolutePath, repository.localPath);
    const fqcn = syntheticFqcn("RouteBuilder", module.id, fileName, symbol);
    registerSyntheticController(builder, {
      applicationModuleId: module.id,
      fqcn,
      simpleName: syntheticSimpleName(fqcn),
      fileName,
      endpoints,
    });
  }
}
