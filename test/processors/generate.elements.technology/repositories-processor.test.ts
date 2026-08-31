import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import { ArchiFolderIds } from "../../../src/archimate-model/folders/archi-folder.js";
import { Artifact } from "../../../src/archimate-model/elements/archi-element.js";
import { GitRepoProfile } from "../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { packageVersion } from "../../../src/package-version.js";
import {
  CODE_REPOSITORIES_FOLDER,
  RepositoriesProcessor,
} from "../../../src/processors/generate.elements.technology/repositories-processor.js";
import {
  defaultGenerateProcessorOptions,
  undecoratedGenerateProcessorOptions,
} from "../../generate/generate-processor-test-options.js";

function repositoryRecord(
  naturalKeys: ConstructorParameters<typeof Repository>[0],
): ReturnType<Repository["toCreateIntent"]> {
  return new Repository(naturalKeys).toCreateIntent();
}

function discoverySnapshot(repositories: ReturnType<typeof repositoryRecord>[]) {
  return buildDiscoveryModelSnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: repositories,
    },
  });
}

describe("RepositoriesProcessor", () => {
  it("exposes generate.elements.technology coordinates", () => {
    const processor = new RepositoriesProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.technology",
      artifactId: "repositories",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates Artifact in Code repositories for repo without namespace", () => {
    const repository = repositoryRecord({
      url: "https://example.com/demo.git",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.profiles?.length, 1);
    assert.equal(output.folders?.length, 1);
    assert.equal(output.folders?.[0]?.name, CODE_REPOSITORIES_FOLDER);
    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.conceptType, "Artifact");
    assert.equal(output.elements?.[0]?.id, repository.id);
    assert.equal(output.elements?.[0]?.name, "demo.git");
    assert.deepEqual(output.elements?.[0]?.profileIds, [GitRepoProfile.create().id]);

    const urlProperty = output.elements?.[0]?.properties?.find(
      (property) => property.key === "c2a:url",
    );
    assert.equal(urlProperty?.value, "https://example.com/demo.git");

    const generatorProperty = output.elements?.[0]?.properties?.find(
      (property) => property.key === "c2a:generator",
    );
    assert.equal(generatorProperty?.value, "generate.elements.technology:repositories");

    const schemaProperty = output.elements?.[0]?.properties?.find(
      (property) => property.key === "c2a:schema",
    );
    assert.equal(schemaProperty?.value, packageVersion);
  });

  it("creates nested folders for namespace segments", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/fizz/fuzz/bar/buzz/flow-app",
      name: "flow-app",
      namespace: "fuzz/bar/buzz",
      buildSystems: ["maven"],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const technologyFolderId = store.getPredefinedFolderId("technology");
    const codeReposId = ArchiFolderIds.nestedId(technologyFolderId, CODE_REPOSITORIES_FOLDER);
    const buzzFolderId = ArchiFolderIds.nestedId(
      ArchiFolderIds.nestedId(ArchiFolderIds.nestedId(codeReposId, "fuzz"), "bar"),
      "buzz",
    );

    assert.equal(output.elements?.[0]?.folderId, buzzFolderId);
    assert.equal(output.folders?.some((folder) => folder.name === "fuzz"), true);
    assert.equal(output.folders?.some((folder) => folder.name === "buzz"), true);
  });

  it("skips element creation when repository id already exists in archi snapshot", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: [],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const technologyFolderId = store.getPredefinedFolderId("technology");
    const codeReposId = ArchiFolderIds.nestedId(technologyFolderId, CODE_REPOSITORIES_FOLDER);
    store.createFolder(technologyFolderId, CODE_REPOSITORIES_FOLDER);
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      { groupId: "generate.elements.technology", artifactId: "repositories" },
      {
        profiles: [GitRepoProfile.create()],
        elements: [
          Artifact.withId(repository.id)
            .name("demo")
            .inFolder(codeReposId)
            .profiles(GitRepoProfile.create().id)
            .build(),
        ],
      },
    );

    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.profiles?.length ?? 0, 0);
  });

  it("does not emit profile when Source code repo already exists", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: [],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    store.registerProfile(GitRepoProfile.create());

    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.profiles?.length ?? 0, 0);
    assert.equal(output.elements?.length, 1);
  });

  it("adds nested folders to store when multiple repositories share namespace prefixes", () => {
    const repositories = [
      repositoryRecord({
        url: "",
        localPath: "/workspace/fizz/fuzz/bar/buzz/repo-a",
        name: "repo-a",
        namespace: "fuzz/bar/buzz",
        buildSystems: [],
      }),
      repositoryRecord({
        url: "",
        localPath: "/workspace/fizz/fuzz/bar/other/repo-b",
        name: "repo-b",
        namespace: "fuzz/bar/other",
        buildSystems: [],
      }),
      repositoryRecord({
        url: "",
        localPath: "/workspace/fizz/alpha/repo-c",
        name: "repo-c",
        namespace: "alpha",
        buildSystems: [],
      }),
    ];
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot(repositories),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.ok(output.folders && output.folders.length > 1);

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.technology", artifactId: "repositories" },
      output,
    );

    assert.equal(store.listElements().length, 3);
    assert.ok(store.listFolders().some((folder) => folder.name === "buzz"));
    assert.ok(store.listFolders().some((folder) => folder.name === CODE_REPOSITORIES_FOLDER));
  });

  it("keeps raw repository name when no-decorate option is enabled", () => {
    const repository = repositoryRecord({
      url: "https://example.com/demo.git",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository]),
      archi: store.snapshot(),
      options: undecoratedGenerateProcessorOptions,
    });

    assert.equal(output.elements?.[0]?.name, "demo");
  });

  it("does not double-append .git when repository name already ends with .git", () => {
    const repository = repositoryRecord({
      url: "https://example.com/demo.git",
      localPath: "/workspace/demo.git",
      name: "demo.git",
      namespace: "",
      buildSystems: ["maven"],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const processor = new RepositoriesProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.[0]?.name, "demo.git");
  });
});
