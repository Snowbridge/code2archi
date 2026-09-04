import { NodejsRestController } from "../../../../../discovery-model/entities/nodejs-rest-controller.js";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import { extractNextJsAppRouterRoutes } from "../../../../../parsers/nodejs/nextjs-app-router-extractor.js";
import { collectNodejsRouteFiles } from "../../../../../parsers/nodejs/nodejs-module-scan.js";
import { resolveNpmNextJsAppRoot, toRepositoryRelativePath } from "../../../../../parsers/nodejs/nodejs-source-roots.js";
import { parseScanNodejsFile } from "../../../../../platform/scan-io/index.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import { isEligibleNpmModule, resolveNpmPackageRoot } from "../../../../../parsers/nodejs/nodejs-source-roots.js";
import { hasFrameworkPackage } from "../../../../../parsers/nodejs/package-json-framework-deps.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { toNextJsRouteControllerEntity } from "./nodejs-rest-entity-mapper.js";

export class NodejsRestControllerNextjsAppRouterProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.source.nodejs.rest",
    artifactId: "controller-nextjs-app-router",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description = "Discovers Next.js App Router route handlers in app/**/route.ts.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const controllers: NodejsRestController[] = [];

    forEachRepository(input, (repository) => {
      for (const entity of input.listEntities("ApplicationModule")) {
        const module = entity as unknown as ApplicationModuleRecord;
        if (!isEligibleNpmModule(module, repository) || module.repositoryId !== repository.id) {
          continue;
        }

        const packageRoot = resolveNpmPackageRoot(repository, module);
        if (!hasFrameworkPackage(packageRoot, "next", repository.localPath)) {
          continue;
        }

        const appRoot = resolveNpmNextJsAppRoot(repository, module);
        if (!appRoot) {
          continue;
        }

        const contexts = [
          {
            module,
            repository,
            sourceRoots: [appRoot],
            packageRoot,
          },
        ];

        for (const routeExtension of ["route.ts", "route.js", "route.tsx", "route.jsx"]) {
          for (const fileContext of collectNodejsRouteFiles(contexts, routeExtension)) {
            try {
              const unit = parseScanNodejsFile(fileContext.absolutePath);
              const repositoryRelativePath = toRepositoryRelativePath(
                fileContext.repository,
                fileContext.absolutePath,
              );
              const parsed = extractNextJsAppRouterRoutes(
                unit,
                fileContext.absolutePath,
                appRoot,
                repositoryRelativePath,
              );

              if (!parsed) {
                continue;
              }

              controllers.push(
                toNextJsRouteControllerEntity(
                  parsed,
                  fileContext.module,
                  fileContext.repository,
                  fileContext.absolutePath,
                ),
              );
            } catch (error) {
              this.logger.warn("failed to parse nextjs route file", {
                file: fileContext.absolutePath,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
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
