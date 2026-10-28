import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GENERATE_ELEMENTS_GROUP_ID,
  GENERATE_VIEWS_GROUP_ID,
} from "../../../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../../../src/archimate-model/elements/archi-element.js";
import { MavenModuleArtifactProfile } from "../../../../../src/archimate-model/profiles/profile.js";
import { buildCodeInventorySnapshot } from "../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../src/code-inventory/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../../../src/code-inventory/entities/application-module-dependency.js";
import { Repository } from "../../../../../src/code-inventory/entities/repository.js";
import {
  applicationComponentIdForModule,
  aggregationRelationshipId,
} from "../../../../../src/generate/application-module-components.js";
import {
  cyclicalDependencyDiagramId,
  CyclicalDependenciesProcessor,
} from "../../../../../src/processors/generate/views/application/cyclical-dependencies-processor.js";
import { AppComponentsFromModulesProcessor } from "../../../../../src/processors/generate/elements/application/app-components-from-modules-processor.js";
import { LinkBuildTimeDependencyAggregationProcessor } from "../../../../../src/processors/generate/elements/application/link-build-time-dependency-aggregation-processor.js";
import { APPLICATION_MODULES_FOLDER } from "../../../../../src/processors/generate/elements/technology/syssoft-for-build-systems-and-runtimes-processor.js";
import { dedupeAndSortCanonicalCycles, enumerateElementaryCycles, buildBuildTimeDependencyAdjacency } from "../../../../../src/generate/module-build-dependency-graph.js";
import { defaultGenerateProcessorOptions } from "../../../../generate/generate-processor-test-options.js";

function repositoryRecord(
  naturalKeys: ConstructorParameters<typeof Repository>[0],
): ReturnType<Repository["toCreateIntent"]> {
  return new Repository(naturalKeys).toCreateIntent();
}

function moduleRecord(
  naturalKeys: ConstructorParameters<typeof ApplicationModule>[0],
): ReturnType<ApplicationModule["toCreateIntent"]> {
  return new ApplicationModule(naturalKeys).toCreateIntent();
}

function dependencyRecord(
  naturalKeys: ConstructorParameters<typeof ApplicationModuleDependency>[0],
): ReturnType<ApplicationModuleDependency["toCreateIntent"]> {
  return new ApplicationModuleDependency(naturalKeys).toCreateIntent();
}

function discoverySnapshot(
  repositories: ReturnType<typeof repositoryRecord>[],
  modules: ReturnType<typeof moduleRecord>[],
  dependencies: ReturnType<typeof dependencyRecord>[] = [],
) {
  return buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: repositories,
      ApplicationModule: modules,
      ApplicationModuleDependency: dependencies,
    },
  });
}

function seedModuleArtifact(
  store: ArchiModelStore,
  module: ReturnType<typeof moduleRecord>,
  profile = MavenModuleArtifactProfile.create(),
): void {
  const technologyFolderId = store.getPredefinedFolderId("technology");
  const modulesFolderId = ArchiFolderIds.nestedId(technologyFolderId, APPLICATION_MODULES_FOLDER);
  if (
    !store
      .snapshot()
      .findFolders({ parentFolderId: technologyFolderId, name: APPLICATION_MODULES_FOLDER }).length
  ) {
    store.createFolder(technologyFolderId, APPLICATION_MODULES_FOLDER);
  }
  if (store.snapshot().getElement(module.id) === undefined) {
    if (store.snapshot().findProfile(profile.name, profile.conceptType) === undefined) {
      store.registerProfile(profile);
    }
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.technology",
        artifactId: "syssoft-for-build-systems-and-runtimes",
      },
      {
        elements: [
          Artifact.withId(module.id)
            .name(String(module.name))
            .inFolder(modulesFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );
  }
}

function seedAppComponents(
  store: ArchiModelStore,
  discovery: ReturnType<typeof discoverySnapshot>,
): void {
  const processor = new AppComponentsFromModulesProcessor();
  const output = processor.process({
    discovery,
    archi: store.snapshot(),
    options: defaultGenerateProcessorOptions,
  });
  store.addCreateIntents(
    GENERATE_ELEMENTS_GROUP_ID,
    {
      groupId: "generate.elements.application",
      artifactId: "app-components-from-modules",
    },
    output,
  );
}

function triangleCycleDiscovery() {
  const repository = repositoryRecord({
    url: "",
    localPath: "/workspace/demo",
    name: "demo",
    namespace: "",
    buildSystems: ["maven"],
  });
  const moduleA = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "maven",
    groupId: "com.example",
    artifactId: "a",
    version: "1",
    name: "module-a",
    repoPath: "a",
    buildScript: "a/pom.xml",
    isMultimodule: false,
  });
  const moduleB = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "maven",
    groupId: "com.example",
    artifactId: "b",
    version: "1",
    name: "module-b",
    repoPath: "b",
    buildScript: "b/pom.xml",
    isMultimodule: false,
  });
  const moduleC = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "maven",
    groupId: "com.example",
    artifactId: "c",
    version: "1",
    name: "module-c",
    repoPath: "c",
    buildScript: "c/pom.xml",
    isMultimodule: false,
  });
  const dependencies = [
    dependencyRecord({
      parentId: moduleA.id,
      groupId: "com.example",
      artifactId: "b",
      version: "1.0",
    }),
    dependencyRecord({
      parentId: moduleB.id,
      groupId: "com.example",
      artifactId: "c",
      version: "1.0",
    }),
    dependencyRecord({
      parentId: moduleC.id,
      groupId: "com.example",
      artifactId: "a",
      version: "1.0",
    }),
  ];
  return {
    discovery: discoverySnapshot([repository], [moduleA, moduleB, moduleC], dependencies),
    modules: [moduleA, moduleB, moduleC],
    dependencies,
  };
}

describe("CyclicalDependenciesProcessor", () => {
  it("exposes ALWAYS policy and coordinates", () => {
    const processor = new CyclicalDependenciesProcessor();
    assert.deepEqual(processor.id, {
      groupId: "generate.views.application",
      artifactId: "cyclical-dependencies",
    });
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates cyclical dependencies folder when no cycles exist", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "solo",
      version: "1",
      name: "solo",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const discovery = discoverySnapshot([repository], [module]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new CyclicalDependenciesProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.folders?.length, 1);
    assert.equal(output.folders?.[0]?.name, "Cyclical dependencies");
    assert.equal(output.elements?.length ?? 0, 0);
  });

  it("creates one diagram with connections for a triangle cycle", () => {
    const { discovery, modules, dependencies } = triangleCycleDiscovery();
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    for (const module of modules) {
      seedModuleArtifact(store, module);
    }
    seedAppComponents(store, discovery);

    const linkProcessor = new LinkBuildTimeDependencyAggregationProcessor();
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      linkProcessor.id,
      linkProcessor.process({
        discovery,
        archi: store.snapshot(),
        options: defaultGenerateProcessorOptions,
      }),
    );

    const adjacency = buildBuildTimeDependencyAdjacency(discovery);
    const canonical = dedupeAndSortCanonicalCycles(enumerateElementaryCycles(adjacency));
    assert.equal(canonical.length, 1);

    const processor = new CyclicalDependenciesProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    store.addCreateIntents(GENERATE_VIEWS_GROUP_ID, processor.id, output);

    const diagramId = cyclicalDependencyDiagramId(canonical[0].canonicalCycleKey);
    const diagram = store.snapshot().getElement(diagramId);
    assert.ok(diagram);
    assert.equal(diagram?.viewpoint, "Application Layer");
    assert.equal(diagram?.diagramObjects?.length, 3);

    const consumerComponentId = applicationComponentIdForModule(modules[0].id);
    const libraryComponentId = applicationComponentIdForModule(modules[1].id);
    const relationId = aggregationRelationshipId(
      consumerComponentId,
      libraryComponentId,
      dependencies[0].id,
    );
    const sourceObject = diagram?.diagramObjects?.find(
      (object) => object.archimateElement === consumerComponentId,
    );
    assert.ok(sourceObject?.sourceConnections.some((conn) => conn.archimateRelationship === relationId));
  });

  it("creates diagram nodes without connections when link aggregation processor did not run", () => {
    const { discovery, modules } = triangleCycleDiscovery();
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    for (const module of modules) {
      seedModuleArtifact(store, module);
    }
    seedAppComponents(store, discovery);

    const processor = new CyclicalDependenciesProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    const diagram = output.elements?.[0];
    assert.ok(diagram?.diagramObjects?.every((object) => object.sourceConnections.length === 0));
  });

  it("does not place npm or multimodule parent modules in cycle graph", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["npm", "maven"],
    });
    const npmModule = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "npm",
      groupId: "",
      artifactId: "pkg",
      version: "1",
      name: "pkg",
      repoPath: ".",
      buildScript: "package.json",
      isMultimodule: false,
    });
    const parent = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "parent",
      version: "1",
      name: "parent",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: true,
    });
    const discovery = discoverySnapshot([repository], [npmModule, parent]);
    const adjacency = buildBuildTimeDependencyAdjacency(discovery);
    assert.equal(adjacency.size, 0);
  });
});
