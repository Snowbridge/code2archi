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

export class QuarkusVertxProcessor extends AbstractProcessor<ScanAppInput, ScanAppOutput> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.controllers",
    artifactId: "quarkus-vertx",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Quarkus Vert.x @Route and reactive route registrations from JVM src/main sources.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        discoverVertxRoutes(repository, module, builder);
      }
    });

    return builder.build();
  }
}

function discoverVertxRoutes(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
  builder: RestDiscoveryIntentBuilder,
): void {
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  for (const absolutePath of listProductionJvmSources(productionRoot)) {
    const source = readFileSync(absolutePath, "utf8");
    if (!source.includes("@Route") && !source.includes("router.route")) {
      continue;
    }
    const endpoints = extractVertxEndpoints(source);
    if (endpoints.length === 0) {
      continue;
    }
    const fileName = productionSourceRelativePath(absolutePath, repository.localPath);
    const symbolMatch = /(?:fun|void)\s+(\w+)/.exec(source);
    const symbol = symbolMatch?.[1] ?? "route";
    const fqcn = syntheticFqcn("VertxRoute", module.id, fileName, symbol);
    registerSyntheticController(builder, {
      applicationModuleId: module.id,
      fqcn,
      simpleName: syntheticSimpleName(fqcn),
      fileName,
      endpoints,
    });
  }
}

function extractVertxEndpoints(source: string): string[] {
  const endpoints: string[] = [];
  const routeAnnotation = /@Route\s*\([^)]*path\s*=\s*"([^"]+)"[^)]*methods\s*=\s*RouteType\.(\w+)/g;
  for (const match of source.matchAll(routeAnnotation)) {
    endpoints.push(formatHttpEndpoint(match[2]!, match[1]!));
  }
  const simpleRoute = /@Route\s*\(\s*"([^"]+)"\s*\)/g;
  for (const match of source.matchAll(simpleRoute)) {
    endpoints.push(formatHttpEndpoint("GET", match[1]!));
  }
  const routerRoute = /router\.(get|post|put|delete|patch)\s*\(\s*"([^"]+)"/gi;
  for (const match of source.matchAll(routerRoute)) {
    endpoints.push(formatHttpEndpoint(match[1]!, match[2]!));
  }
  return endpoints;
}
