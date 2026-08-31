import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../src/archimate-model/elements/archi-element.js";
import {
  BuiltWithProfile,
  CompiledWithProfile,
  MavenModuleArtifactProfile,
  RunsOnProfile,
} from "../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { packageVersion } from "../../../src/package-version.js";
import { UNKNOWN_VERSION } from "../../../src/parsers/build-tool-versions.js";
import {
  APPLICATION_MODULES_FOLDER,
  BUILD_TOOLS_AND_RUNTIMES_FOLDER,
  ModulesBuildSystemsAndRuntimesProcessor,
} from "../../../src/processors/generate.elements.technology/modules-build-systems-and-runtimes-processor.js";
import {
  assignmentRelationshipId,
  systemSoftwareIdForEntry,
} from "../../../src/generate/module-version-catalog.js";

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

function discoverySnapshot(
  repositories: ReturnType<typeof repositoryRecord>[],
  modules: ReturnType<typeof moduleRecord>[],
) {
  return buildDiscoveryModelSnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: repositories,
      ApplicationModule: modules,
    },
  });
}

describe("ModulesBuildSystemsAndRuntimesProcessor", () => {
  it("exposes generate.elements.technology coordinates", () => {
    const processor = new ModulesBuildSystemsAndRuntimesProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.technology",
      artifactId: "modules-build-systems-and-runtimes",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates Artifact for single-module and skips multimodule parent", () => {
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
      javaVersion: "17",
    });
    const child = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "child",
      version: "1",
      name: "child",
      repoPath: "child",
      buildScript: "child/pom.xml",
      isMultimodule: false,
      parentId: parent.id,
      javaVersion: "17",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new ModulesBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [parent, child]),
      archi: store.snapshot(),
    });

    const moduleArtifacts = output.elements?.filter((element) => element.conceptType === "Artifact");
    assert.equal(moduleArtifacts?.length, 1);
    assert.equal(moduleArtifacts?.[0]?.id, child.id);
    assert.deepEqual(moduleArtifacts?.[0]?.profileIds, [MavenModuleArtifactProfile.create().id]);
  });

  it("deduplicates SystemSoftware for shared Java version", () => {
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
      name: "a",
      repoPath: "a",
      buildScript: "a/pom.xml",
      isMultimodule: false,
      javaVersion: "17",
    });
    const moduleB = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "b",
      version: "1",
      name: "b",
      repoPath: "b",
      buildScript: "b/pom.xml",
      isMultimodule: false,
      javaVersion: "17",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new ModulesBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [moduleA, moduleB]),
      archi: store.snapshot(),
    });

    const java17Id = systemSoftwareIdForEntry("javaVersion", "17");
    const systemSoftware = output.elements?.filter(
      (element) => element.conceptType === "SystemSoftware",
    );
    assert.equal(systemSoftware?.filter((element) => element.id === java17Id).length, 1);
    assert.equal(
      output.relations?.filter((relation) => relation.sourceId === java17Id).length,
      2,
    );
  });

  it("assigns profiles by version field kind", () => {
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
      javaVersion: "17",
      kotlinJvmTarget: "17",
      buildToolVersion: "3.9.7",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new ModulesBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    const javaRelation = output.relations?.find(
      (relation) =>
        relation.sourceId === systemSoftwareIdForEntry("javaVersion", "17") &&
        relation.targetId === module.id,
    );
    assert.deepEqual(javaRelation?.profileIds, [RunsOnProfile.create().id]);

    const kotlinRelation = output.relations?.find(
      (relation) =>
        relation.sourceId === systemSoftwareIdForEntry("kotlinJvmTarget", "17") &&
        relation.targetId === module.id,
    );
    assert.deepEqual(kotlinRelation?.profileIds, [CompiledWithProfile.create().id]);

    const mavenRelation = output.relations?.find(
      (relation) =>
        relation.sourceId ===
          systemSoftwareIdForEntry("buildToolVersion", "3.9.7", "maven") &&
        relation.targetId === module.id,
    );
    assert.deepEqual(mavenRelation?.profileIds, [BuiltWithProfile.create().id]);
  });

  it("creates shared Java unknown SystemSoftware with unknown confidence", () => {
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
      javaVersion: UNKNOWN_VERSION,
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new ModulesBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    const javaUnknownId = systemSoftwareIdForEntry("javaVersion", UNKNOWN_VERSION);
    const javaUnknown = output.elements?.find((element) => element.id === javaUnknownId);
    assert.equal(javaUnknown?.name, "Java unknown");
    assert.equal(
      javaUnknown?.properties?.find((property) => property.key === "c2a:confidence")?.value,
      "unknown",
    );

    const relation = output.relations?.find(
      (relation) =>
        relation.sourceId === javaUnknownId && relation.targetId === module.id,
    );
    assert.equal(
      relation?.properties?.find((property) => property.key === "c2a:confidence")?.value,
      "unknown",
    );
  });

  it("skips module element when id already exists in archi snapshot", () => {
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
      javaVersion: "17",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const modulesFolderId = ArchiFolderIds.nestedId(technologyFolderId, APPLICATION_MODULES_FOLDER);
    store.createFolder(technologyFolderId, APPLICATION_MODULES_FOLDER);
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.technology",
        artifactId: "modules-build-systems-and-runtimes",
      },
      {
        profiles: [MavenModuleArtifactProfile.create()],
        elements: [
          Artifact.withId(module.id)
            .name("svc")
            .inFolder(modulesFolderId)
            .profiles(MavenModuleArtifactProfile.create().id)
            .build(),
        ],
      },
    );

    const processor = new ModulesBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    assert.equal(
      output.elements?.filter((element) => element.conceptType === "Artifact").length ?? 0,
      0,
    );
    assert.ok((output.elements?.length ?? 0) > 0);
  });

  it("creates technology folders parent-first for store merge", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
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
      javaVersion: "17",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new ModulesBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
    });

    assert.ok(output.folders && output.folders.length > 1);
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.technology",
        artifactId: "modules-build-systems-and-runtimes",
      },
      output,
    );

    const technologyFolderId = store.getPredefinedFolderId("technology");
    assert.ok(
      store.listFolders().some((folder) => folder.name === APPLICATION_MODULES_FOLDER),
    );
    assert.ok(
      store.listFolders().some((folder) => folder.name === BUILD_TOOLS_AND_RUNTIMES_FOLDER),
    );
    assert.equal(
      store.listElements().find((element) => element.id === module.id)?.folderId,
      ArchiFolderIds.nestedId(
        ArchiFolderIds.nestedId(
          ArchiFolderIds.nestedId(technologyFolderId, APPLICATION_MODULES_FOLDER),
          "fuzz",
        ),
        "bar",
      ),
    );

    const generatorProperty = store
      .listElements()
      .find((element) => element.id === module.id)
      ?.properties?.find((property) => property.key === "c2a:generator");
    assert.equal(generatorProperty?.value, "generate.elements.technology:modules-build-systems-and-runtimes");

    const schemaProperty = store
      .listRelations()
      .find(
        (relation) =>
          relation.id ===
          assignmentRelationshipId(systemSoftwareIdForEntry("javaVersion", "17"), module.id),
      )
      ?.properties?.find((property) => property.key === "c2a:schema");
    assert.equal(schemaProperty?.value, packageVersion);
  });
});
