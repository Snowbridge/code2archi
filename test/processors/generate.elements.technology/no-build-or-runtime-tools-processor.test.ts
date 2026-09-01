import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../src/archimate-model/elements/archi-element.js";
import {
  BuiltWithProfile,
  MavenModuleArtifactProfile,
  RunsOnProfile,
} from "../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { UNKNOWN_VERSION } from "../../../src/parsers/build-tool-versions.js";
import {
  APPLICATION_MODULES_FOLDER,
  BUILD_TOOLS_AND_RUNTIMES_FOLDER,
} from "../../../src/processors/generate.elements.technology/modules-build-systems-and-runtimes-processor.js";
import { NoBuildOrRuntimeToolsProcessor } from "../../../src/processors/generate.elements.technology/no-build-or-runtime-tools-processor.js";
import {
  systemSoftwareIdForEntry,
} from "../../../src/generate/module-version-catalog.js";
import { defaultGenerateProcessorOptions } from "../../generate/generate-processor-test-options.js";

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

function discoverySnapshot(modules: ReturnType<typeof moduleRecord>[]) {
  return buildDiscoveryModelSnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: [],
      ApplicationModule: modules,
    },
  });
}

function seedModuleArtifact(store: ArchiModelStore, module: ReturnType<typeof moduleRecord>): void {
  const technologyFolderId = store.getPredefinedFolderId("technology");
  const modulesFolderId = ArchiFolderIds.nestedId(technologyFolderId, APPLICATION_MODULES_FOLDER);
  store.createFolder(technologyFolderId, APPLICATION_MODULES_FOLDER);
  store.registerProfile(MavenModuleArtifactProfile.create());
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
          .profiles(MavenModuleArtifactProfile.create().id)
          .build(),
      ],
    },
  );
}

describe("NoBuildOrRuntimeToolsProcessor", () => {
  it("exposes generate.elements.technology coordinates", () => {
    const processor = new NoBuildOrRuntimeToolsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.technology",
      artifactId: "no-build-or-runtime-tools",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ON_DEMAND");
  });

  it("creates unknown Maven build and Java runtime markers when module artifact exists", () => {
    const module = moduleRecord({
      repositoryId: "repo-1",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
      buildToolVersion: UNKNOWN_VERSION,
      javaVersion: UNKNOWN_VERSION,
      kotlinJvmTarget: "17",
      kotlinCompilerVersion: "2.0.0",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, module);

    const processor = new NoBuildOrRuntimeToolsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const mavenUnknownId = systemSoftwareIdForEntry("buildToolVersion", UNKNOWN_VERSION, "maven");
    const javaUnknownId = systemSoftwareIdForEntry("javaVersion", UNKNOWN_VERSION);

    const systemSoftware = output.elements?.filter(
      (element) => element.conceptType === "SystemSoftware",
    );
    assert.equal(systemSoftware?.length, 2);
    assert.equal(systemSoftware?.some((element) => element.name === "Maven unknown"), true);
    assert.equal(systemSoftware?.some((element) => element.name === "Java unknown"), true);
    assert.equal(
      systemSoftware?.find((element) => element.id === mavenUnknownId)?.properties?.find(
        (property) => property.key === "c2a:confidence",
      )?.value,
      "unknown",
    );
    assert.equal(
      systemSoftware?.find((element) => element.id === mavenUnknownId)?.properties?.find(
        (property) => property.key === "c2a:slot",
      )?.value,
      "syssoft-build-system",
    );

    const buildRelation = output.relations?.find(
      (relation) =>
        relation.sourceId === mavenUnknownId && relation.targetId === module.id,
    );
    const javaRelation = output.relations?.find(
      (relation) => relation.sourceId === javaUnknownId && relation.targetId === module.id,
    );
    assert.deepEqual(buildRelation?.profileIds, [BuiltWithProfile.create().id]);
    assert.deepEqual(javaRelation?.profileIds, [RunsOnProfile.create().id]);
    assert.equal(
      buildRelation?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "syssoft-assign",
    );
    assert.equal(
      buildRelation?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.technology:no-build-or-runtime-tools",
    );
    assert.equal(output.folders?.[0]?.name, BUILD_TOOLS_AND_RUNTIMES_FOLDER);
  });

  it("creates npm node unknown marker without Java unknown", () => {
    const module = moduleRecord({
      repositoryId: "repo-1",
      buildSystem: "npm",
      groupId: "",
      artifactId: "pkg",
      version: "1",
      name: "pkg",
      repoPath: ".",
      buildScript: "package.json",
      isMultimodule: false,
      buildToolVersion: UNKNOWN_VERSION,
      javaVersion: UNKNOWN_VERSION,
      nodeVersion: UNKNOWN_VERSION,
      typescriptVersion: "5.0.0",
      tsxVersion: "4.0.0",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, module);

    const processor = new NoBuildOrRuntimeToolsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const systemSoftware = output.elements?.filter(
      (element) => element.conceptType === "SystemSoftware",
    );
    assert.equal(systemSoftware?.some((element) => element.name === "Java unknown"), false);
    assert.equal(systemSoftware?.some((element) => element.name === "Node unknown"), true);
    assert.equal(systemSoftware?.some((element) => element.name === "npm unknown"), true);
  });

  it("skips assignments when module artifact is missing from archi", () => {
    const module = moduleRecord({
      repositoryId: "repo-1",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
      buildToolVersion: UNKNOWN_VERSION,
      javaVersion: UNKNOWN_VERSION,
      kotlinJvmTarget: "17",
      kotlinCompilerVersion: "2.0.0",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new NoBuildOrRuntimeToolsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.ok((output.elements?.length ?? 0) > 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("is idempotent when unknown system software and assignments already exist", () => {
    const module = moduleRecord({
      repositoryId: "repo-1",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
      buildToolVersion: UNKNOWN_VERSION,
      javaVersion: UNKNOWN_VERSION,
      kotlinJvmTarget: "17",
      kotlinCompilerVersion: "2.0.0",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedModuleArtifact(store, module);

    const processor = new NoBuildOrRuntimeToolsProcessor();
    const firstOutput = processor.process({
      discovery: discoverySnapshot([module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      {
        groupId: "generate.elements.technology",
        artifactId: "no-build-or-runtime-tools",
      },
      {
        folders: firstOutput.folders,
        elements: firstOutput.elements,
        relations: firstOutput.relations,
      },
    );

    const secondOutput = processor.process({
      discovery: discoverySnapshot([module]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(secondOutput.elements?.length ?? 0, 0);
    assert.equal(secondOutput.relations?.length ?? 0, 0);
  });

  it("skips multimodule parent without parentId", () => {
    const parent = moduleRecord({
      repositoryId: "repo-1",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "parent",
      version: "1",
      name: "parent",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: true,
      buildToolVersion: UNKNOWN_VERSION,
      javaVersion: UNKNOWN_VERSION,
      kotlinJvmTarget: "17",
      kotlinCompilerVersion: "2.0.0",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new NoBuildOrRuntimeToolsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([parent]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });
});
