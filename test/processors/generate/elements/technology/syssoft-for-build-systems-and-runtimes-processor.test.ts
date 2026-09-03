import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../../../src/archimate-model/elements/archi-element.js";
import {
  BuiltWithProfile,
  CompiledWithProfile,
  GitRepoProfile,
  MavenModuleArtifactProfile,
  RunsOnProfile,
} from "../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../src/discovery-model/entities/repository.js";
import { packageVersion } from "../../../../../src/package-version.js";
import { UNKNOWN_VERSION } from "../../../../../src/parsers/build-tool-versions.js";
import { CODE_REPOSITORIES_FOLDER } from "../../../../../src/processors/generate/elements/technology/code-repositories-processor.js";
import {
  APPLICATION_MODULES_FOLDER,
  BUILD_TOOLS_AND_RUNTIMES_FOLDER,
  SyssoftForBuildSystemsAndRuntimesProcessor,
} from "../../../../../src/processors/generate/elements/technology/syssoft-for-build-systems-and-runtimes-processor.js";
import {
  assignmentRelationshipId,
  repositoryModuleCompositionRelationshipId,
  systemSoftwareIdForEntry,
} from "../../../../../src/generate/module-version-catalog.js";
import {
  defaultGenerateProcessorOptions,
  undecoratedGenerateProcessorOptions,
} from "../../../../generate/generate-processor-test-options.js";

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

function seedRepositoryArtifact(
  store: ArchiModelStore,
  repository: ReturnType<typeof repositoryRecord>,
): void {
  const technologyFolderId = store.getPredefinedFolderId("technology");
  const codeReposId = ArchiFolderIds.nestedId(technologyFolderId, CODE_REPOSITORIES_FOLDER);
  store.createFolder(technologyFolderId, CODE_REPOSITORIES_FOLDER);
  store.addCreateIntents(
    GENERATE_ELEMENTS_GROUP_ID,
    { groupId: "generate.elements.technology", artifactId: "code-repositories" },
    {
      profiles: [GitRepoProfile.create()],
      elements: [
        Artifact.withId(repository.id)
          .name(String(repository.name))
          .inFolder(codeReposId)
          .profiles(GitRepoProfile.create().id)
          .build(),
      ],
    },
  );
}

describe("SyssoftForBuildSystemsAndRuntimesProcessor", () => {
  it("exposes generate.elements.technology coordinates", () => {
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.technology",
      artifactId: "syssoft-for-build-systems-and-runtimes",
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [parent, child]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const moduleArtifacts = output.elements?.filter((element) => element.conceptType === "Artifact");
    assert.equal(moduleArtifacts?.length, 1);
    assert.equal(moduleArtifacts?.[0]?.id, child.id);
    assert.deepEqual(moduleArtifacts?.[0]?.profileIds, [MavenModuleArtifactProfile.create().id]);
    assert.equal(
      moduleArtifacts?.[0]?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "module-artifact",
    );
    assert.equal(
      moduleArtifacts?.[0]?.properties?.find((property) => property.key === "c2a:repo-path")?.value,
      "/demo://child",
    );
  });

  it("creates Composition from repository Artifact to module Artifact", () => {
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
    seedRepositoryArtifact(store, repository);
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const composition = output.relations?.find(
      (relation) => relation.relationType === "CompositionRelationship",
    );
    assert.equal(composition?.sourceId, repository.id);
    assert.equal(composition?.targetId, module.id);
    assert.equal(
      composition?.id,
      repositoryModuleCompositionRelationshipId(repository.id, module.id),
    );
    assert.equal(
      composition?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.technology:syssoft-for-build-systems-and-runtimes",
    );
    assert.equal(
      composition?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "repo-module-composition",
    );
  });

  it("does not create Composition when repository Artifact is missing from archi", () => {
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(
      output.relations?.some((relation) => relation.relationType === "CompositionRelationship"),
      false,
    );
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [moduleA, moduleB]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
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

    const javaSystemSoftware = output.elements?.find(
      (element) => element.id === systemSoftwareIdForEntry("javaVersion", "17"),
    );
    assert.equal(
      javaSystemSoftware?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "syssoft-runtime",
    );
    const kotlinSystemSoftware = output.elements?.find(
      (element) => element.id === systemSoftwareIdForEntry("kotlinJvmTarget", "17"),
    );
    assert.equal(
      kotlinSystemSoftware?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "syssoft-compiled",
    );
    const mavenSystemSoftware = output.elements?.find(
      (element) =>
        element.id === systemSoftwareIdForEntry("buildToolVersion", "3.9.7", "maven"),
    );
    assert.equal(
      mavenSystemSoftware?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "syssoft-build-system",
    );
    assert.equal(
      javaRelation?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "syssoft-assign",
    );
  });

  it("skips SystemSoftware and Assignment for unknown version fields", () => {
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
      nodeVersion: UNKNOWN_VERSION,
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(
      output.elements?.filter((element) => element.conceptType === "SystemSoftware").length ?? 0,
      0,
    );
    assert.equal(output.relations?.length ?? 0, 0);
    assert.equal(output.elements?.filter((element) => element.conceptType === "Artifact").length, 1);
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
    seedRepositoryArtifact(store, repository);
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const modulesFolderId = ArchiFolderIds.nestedId(technologyFolderId, APPLICATION_MODULES_FOLDER);
    store.createFolder(technologyFolderId, APPLICATION_MODULES_FOLDER);
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.technology",
        artifactId: "syssoft-for-build-systems-and-runtimes",
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

    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(
      output.elements?.filter((element) => element.conceptType === "Artifact").length ?? 0,
      0,
    );
    assert.ok((output.elements?.length ?? 0) > 0);
    assert.equal(
      output.relations?.filter((relation) => relation.relationType === "CompositionRelationship")
        .length,
      1,
    );
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.ok(output.folders && output.folders.length > 1);
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.technology",
        artifactId: "syssoft-for-build-systems-and-runtimes",
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
    assert.equal(generatorProperty?.value, "generate.elements.technology:syssoft-for-build-systems-and-runtimes");

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

  it("keeps raw module artifact name when no-decorate option is enabled", () => {
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: undecoratedGenerateProcessorOptions,
    });

    assert.equal(output.elements?.find((element) => element.id === module.id)?.name, "svc");
  });

  it("decorates module artifact name by default", () => {
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
    const processor = new SyssoftForBuildSystemsAndRuntimesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.find((element) => element.id === module.id)?.name, "svc (maven)");
  });
});
