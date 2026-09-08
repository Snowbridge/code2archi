import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../../../src/archimate-model/elements/archi-element.js";
import {
  BuildTimeDependencyProfile,
  GradleModuleArtifactProfile,
  LibraryModuleProfile,
  MavenModuleArtifactProfile,
  MavenModuleProfile,
} from "../../../../../src/archimate-model/profiles/profile.js";
import { buildCodeInventorySnapshot } from "../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../src/code-inventory/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../../../src/code-inventory/entities/application-module-dependency.js";
import { Repository } from "../../../../../src/code-inventory/entities/repository.js";
import {
  applicationComponentIdForModule,
  aggregationRelationshipId,
} from "../../../../../src/generate/application-module-components.js";
import { AppComponentsFromModulesProcessor } from "../../../../../src/processors/generate/elements/application/app-components-from-modules-processor.js";
import { LinkBuildTimeDependencyAggregationProcessor } from "../../../../../src/processors/generate/elements/application/link-build-time-dependency-aggregation-processor.js";
import { APPLICATION_MODULES_FOLDER } from "../../../../../src/processors/generate/elements/technology/syssoft-for-build-systems-and-runtimes-processor.js";
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

describe("LinkBuildTimeDependencyAggregationProcessor", () => {
  it("exposes generate.elements.application coordinates and ON_DEMAND policy", () => {
    const processor = new LinkBuildTimeDependencyAggregationProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application",
      artifactId: "link-build-time-dependency-aggregation",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ON_DEMAND");
  });

  it("creates Aggregation with c2a:libraryVersion for same-repository dependency", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const consumer = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const library = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const dependency = dependencyRecord({
      parentId: consumer.id,
      groupId: "com.example",
      artifactId: "lib",
      version: "2.0.0",
    });
    const discovery = discoverySnapshot([repository], [consumer, library], [dependency]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, consumer);
    seedModuleArtifact(store, library);
    seedAppComponents(store, discovery);

    const processor = new LinkBuildTimeDependencyAggregationProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const aggregation = output.relations?.find(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregation?.sourceId, applicationComponentIdForModule(consumer.id));
    assert.equal(aggregation?.targetId, applicationComponentIdForModule(library.id));
    assert.deepEqual(aggregation?.profileIds, [BuildTimeDependencyProfile.create().id]);
    assert.equal(
      aggregation?.properties?.find((property) => property.key === "c2a:libraryVersion")?.value,
      "2.0.0",
    );
    assert.equal(
      aggregation?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "module-lib-aggregation",
    );
    assert.equal(
      aggregation?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.application:link-build-time-dependency-aggregation",
    );
    assert.equal(
      aggregation?.id,
      aggregationRelationshipId(
        applicationComponentIdForModule(consumer.id),
        applicationComponentIdForModule(library.id),
        dependency.id,
      ),
    );
  });

  it("creates Aggregation for cross-repository dependency", () => {
    const consumerRepository = repositoryRecord({
      url: "",
      localPath: "/workspace/consumer",
      name: "consumer",
      namespace: "",
      buildSystems: ["maven"],
    });
    const libraryRepository = repositoryRecord({
      url: "",
      localPath: "/workspace/library",
      name: "library",
      namespace: "",
      buildSystems: ["maven"],
    });
    const consumer = moduleRecord({
      repositoryId: consumerRepository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const library = moduleRecord({
      repositoryId: libraryRepository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const dependency = dependencyRecord({
      parentId: consumer.id,
      groupId: "com.example",
      artifactId: "lib",
      version: "2.0.0",
    });
    const discovery = discoverySnapshot(
      [consumerRepository, libraryRepository],
      [consumer, library],
      [dependency],
    );
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, consumer);
    seedModuleArtifact(store, library);
    seedAppComponents(store, discovery);

    const processor = new LinkBuildTimeDependencyAggregationProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const aggregation = output.relations?.find(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.ok(aggregation);
    assert.equal(aggregation?.sourceId, applicationComponentIdForModule(consumer.id));
    assert.equal(aggregation?.targetId, applicationComponentIdForModule(library.id));
    assert.deepEqual(aggregation?.profileIds, [BuildTimeDependencyProfile.create().id]);
    assert.equal(
      aggregation?.properties?.find((property) => property.key === "c2a:libraryVersion")?.value,
      "2.0.0",
    );
    assert.equal(
      aggregation?.id,
      aggregationRelationshipId(
        applicationComponentIdForModule(consumer.id),
        applicationComponentIdForModule(library.id),
        dependency.id,
      ),
    );
  });

  it("skips external dependency when target module is not in discovery", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const consumer = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: "svc",
      buildScript: "svc/pom.xml",
      isMultimodule: false,
    });
    const externalDependency = dependencyRecord({
      parentId: consumer.id,
      groupId: "org.external",
      artifactId: "lib",
      version: "1.0.0",
    });
    const discovery = discoverySnapshot([repository], [consumer], [externalDependency]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, consumer);
    seedAppComponents(store, discovery);

    const processor = new LinkBuildTimeDependencyAggregationProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("skips aggregation when consumer is multimodule parent", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
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
    const library = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "1",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const dependency = dependencyRecord({
      parentId: parent.id,
      groupId: "com.example",
      artifactId: "lib",
      version: "1.0.0",
    });
    const discovery = discoverySnapshot([repository], [parent, library], [dependency]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, library);
    seedAppComponents(store, discovery);

    const processor = new LinkBuildTimeDependencyAggregationProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("emits aggregation when app-module-component endpoints are missing from archi snapshot", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const consumer = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const library = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const dependency = dependencyRecord({
      parentId: consumer.id,
      groupId: "com.example",
      artifactId: "lib",
      version: "2.0.0",
    });
    const discovery = discoverySnapshot([repository], [consumer, library], [dependency]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new LinkBuildTimeDependencyAggregationProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.relationType, "AggregationRelationship");
  });
});
