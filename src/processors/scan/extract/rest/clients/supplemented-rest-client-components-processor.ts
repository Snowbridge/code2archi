import { readFileSync } from "node:fs";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ScanAppInput, ScanAppOutput } from "../../../../../platform/processors/processor.js";
import {
  AbstractProcessor,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";
import { discoverSupplementedRestClientsForModule } from "../../../../../scan/extract/rest/clients/discover-supplemented-rest-clients-module.js";
import {
  indexSupplementedRestClientsByFqcn,
  parseRestClientSupplement,
  type SupplementedRestClientEntry,
} from "../../../../../scan/extract/rest/clients/supplement-rest-client-file.js";
import { RestDiscoveryIntentBuilder } from "../../../../../scan/extract/rest/intent-builder.js";

const SUPPLEMENT_BASENAMES = new Set(["rest-client.json", "rest-clients.json"]);

function isRestClientSupplementBasename(basename: string): boolean {
  return SUPPLEMENT_BASENAMES.has(basename);
}

export class SupplementedRestClientComponentsProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.extract.rest.clients",
    artifactId: "supplemented-rest-clients",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers REST client usages declared in a rest-client.json supplement (class fields and method local variables) and adds RestClient entities to consuming JVM modules.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const builder = new RestDiscoveryIntentBuilder();
    const restClientRefs = (input.supplements ?? []).filter((ref) =>
      isRestClientSupplementBasename(ref.basename),
    );
    if (restClientRefs.length === 0) {
      return builder.build();
    }

    const entriesByFqcn = this.loadSupplementEntries(restClientRefs);
    if (entriesByFqcn === undefined) {
      return builder.build();
    }

    const modules = [...input.listEntities("ApplicationModule")]
      .map((entity) => entity as unknown as ApplicationModuleRecord)
      .filter((module) => module.buildSystem === "maven" || module.buildSystem === "gradle");

    forEachRepository(input, (repository) => {
      for (const module of modules.filter((item) => item.repositoryId === repository.id)) {
        builder.mergeFrom(
          discoverSupplementedRestClientsForModule(repository, module, entriesByFqcn),
        );
      }
    });

    return builder.build();
  }

  /**
   * Reads and validates all `rest-client.json` supplement refs.
   * Returns `undefined` when any ref is missing/wrong-format (WARN is logged),
   * signalling that no clients should be added.
   */
  private loadSupplementEntries(
    refs: readonly { readonly path: string; readonly basename: string }[],
  ): ReadonlyMap<string, SupplementedRestClientEntry> | undefined {
    const collected: SupplementedRestClientEntry[] = [];
    for (const ref of refs) {
      let content: string;
      try {
        content = readFileSync(ref.path, "utf8");
      } catch (error) {
        this.logger.warn("supplement rest-client.json could not be read", {
          path: ref.path,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
      const entries = parseRestClientSupplement(content);
      if (entries === undefined) {
        this.logger.warn("supplement rest-client.json has invalid format", { path: ref.path });
        return undefined;
      }
      collected.push(...entries);
    }
    return indexSupplementedRestClientsByFqcn(collected);
  }
}