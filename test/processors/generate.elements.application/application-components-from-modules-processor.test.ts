import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../src/archimate-model/elements/archi-element.js";
import {
  GradleModuleArtifactProfile,
  LibraryModuleProfile,
  MavenModuleArtifactProfile,
  MavenModuleProfile,
} from "../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../src/discovery-model/entities/application-module-dependency.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import {
  applicationComponentIdForModule,
  aggregationRelationshipId,
  realizationRelationshipId,
} from "../../../src/generate/application-module-components.js";
import { ApplicationComponentsFromModulesProcessor } from "../../../src/processors/generate.elements.application/application-components-from-modules-processor.js";
import { CODE_REPOSITORIES_FOLDER } from "../../../src/processors/generate.elements.technology/repositories-processor.js";
import { APPLICATION_MODULES_FOLDER } from "../../../src/processors/generate.elements.technology/modules-build-systems-and-runtimes-processor.js";

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
  return buildDiscoveryModelSnapshot({
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
  if (!store.snapshot().findFolders({ parentFolderId: technologyFolderId, name: APPLICATION_MODULES_FOLDER }).length) {
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
        artifactId: "modules-build-systems-and-runtimes",
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

describe("ApplicationComponentsFromModulesProcessor", () => {
  it("exposes generate.elements.application coordinates", () => {
    const processor = new ApplicationComponentsFromModulesProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application",
      artifactId: "application-components-from-modules",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationComponent and Realization when module Artifact exists", () => {
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
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, module);

    const processor = new ApplicationComponentsFromModulesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    const componentId = applicationComponentIdForModule(module.id);
    const component = output.elements?.find((element) => element.id === componentId);
    assert.equal(component?.conceptType, "ApplicationComponent");
    assert.deepEqual(component?.profileIds, [MavenModuleProfile.create().id]);

    const realization = output.relations?.find(
      (relation) => relation.relationType === "RealizationRelationship",
    );
    assert.equal(realization?.sourceId, module.id);
    assert.equal(realization?.targetId, componentId);
    assert.equal(
      realization?.id,
      realizationRelationshipId(module.id, componentId),
    );
  });

  it("skips Realization when module Artifact is missing", () => {
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
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new ApplicationComponentsFromModulesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("assigns Library profile and Aggregation with c2a:libraryVersion", () => {
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
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, consumer);
    seedModuleArtifact(store, library);

    const processor = new ApplicationComponentsFromModulesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [consumer, library], [dependency]),
      archi: store.snapshot(),
    });

    const libraryComponent = output.elements?.find(
      (element) => element.id === applicationComponentIdForModule(library.id),
    );
    assert.deepEqual(libraryComponent?.profileIds, [LibraryModuleProfile.create().id]);

    const aggregation = output.relations?.find(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregation?.sourceId, applicationComponentIdForModule(consumer.id));
    assert.equal(aggregation?.targetId, applicationComponentIdForModule(library.id));
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

  it("skips multimodule parent and skips external dependency aggregation", () => {
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
      parentId: parent.id,
    });
    const externalDependency = dependencyRecord({
      parentId: consumer.id,
      groupId: "org.external",
      artifactId: "lib",
      version: "1.0.0",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, consumer);

    const processor = new ApplicationComponentsFromModulesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [parent, consumer], [externalDependency]),
      archi: store.snapshot(),
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.id, applicationComponentIdForModule(consumer.id));
    assert.equal(
      output.relations?.some((relation) => relation.relationType === "AggregationRelationship"),
      false,
    );
  });

  it("creates nested application folders from repository namespace", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/fizz/fuzz/demo",
      name: "demo",
      namespace: "fuzz/bar",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
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
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, module);

    const processor = new ApplicationComponentsFromModulesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.application",
        artifactId: "application-components-from-modules",
      },
      output,
    );

    const applicationFolderId = store.getPredefinedFolderId("application");
    assert.equal(
      store.listElements().find((element) => element.id === applicationComponentIdForModule(module.id))
        ?.folderId,
      ArchiFolderIds.nestedId(
        ArchiFolderIds.nestedId(applicationFolderId, "fuzz"),
        "bar",
      ),
    );
    assert.ok(store.listFolders().some((folder) => folder.name === "bar"));
    assert.notEqual(CODE_REPOSITORIES_FOLDER, "application");
    assert.notEqual(GradleModuleArtifactProfile.create().id, MavenModuleProfile.create().id);
  });
});
