import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiFolderIds } from "../../src/archimate-model/folders/archi-folder.js";
import {
  BuildScriptProfile,
  BuiltWithProfile,
  CompiledWithProfile,
  GitRepoProfile,
  GradleModuleArtifactProfile,
  LibraryModuleProfile,
  MavenModuleArtifactProfile,
  RestControllerProfile,
  RunsOnProfile,
} from "../../src/archimate-model/profiles/profile.js";

describe("ArchiProfile", () => {
  it("creates stable profile ids via typed classes", () => {
    const first = GitRepoProfile.create();
    const second = GitRepoProfile.create();
    assert.equal(first.id, second.id);
    assert.match(first.id, /^[0-9a-f]{64}$/);
  });

  it("creates distinct ids for different profile kinds", () => {
    const gitRepo = GitRepoProfile.create();
    const buildScript = BuildScriptProfile.create();
    const libraryModule = LibraryModuleProfile.create();
    const mavenModuleArtifact = MavenModuleArtifactProfile.create();
    const gradleModuleArtifact = GradleModuleArtifactProfile.create();

    assert.notEqual(gitRepo.id, buildScript.id);
    assert.notEqual(gitRepo.id, libraryModule.id);
    assert.notEqual(gitRepo.id, mavenModuleArtifact.id);
    assert.notEqual(mavenModuleArtifact.id, gradleModuleArtifact.id);
    assert.notEqual(gitRepo.id, ArchiFolderIds.rootIdFor("business"));
  });

  it("binds conceptType to each profile class in create-intent", () => {
    assert.deepEqual(GitRepoProfile.create().toCreateIntent(), {
      id: GitRepoProfile.create().id,
      name: "Source code repo",
      conceptType: "Artifact",
    });
    assert.deepEqual(LibraryModuleProfile.create().toCreateIntent(), {
      id: LibraryModuleProfile.create().id,
      name: "Library module",
      conceptType: "ApplicationComponent",
    });
  });

  it("fixes conceptType via intermediate profile base classes", () => {
    assert.equal(GitRepoProfile.create().conceptType, "Artifact");
    assert.equal(BuildScriptProfile.create().conceptType, "Artifact");
    assert.equal(MavenModuleArtifactProfile.create().conceptType, "Artifact");
    assert.equal(LibraryModuleProfile.create().conceptType, "ApplicationComponent");
    assert.equal(RestControllerProfile.create().conceptType, "ApplicationService");
    assert.equal(RunsOnProfile.create().conceptType, "AssignmentRelationship");
    assert.equal(BuiltWithProfile.create().conceptType, "AssignmentRelationship");
    assert.equal(CompiledWithProfile.create().conceptType, "AssignmentRelationship");
  });
});
