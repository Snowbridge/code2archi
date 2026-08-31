import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../src/discovery-model/entities/application-module.js";
import { ApplicationModuleDependency } from "../../src/discovery-model/entities/application-module-dependency.js";
import {
  applicationComponentIdForModule,
  buildModulesByCoordinates,
  buildModulesByRepositoryAndCoordinates,
  collectLibraryModuleIds,
  moduleCoordinateKey,
  resolveModuleForDependency,
  resolveModuleInRepository,
} from "../../src/generate/application-module-components.js";
import { LibraryModuleProfile, MavenModuleProfile } from "../../src/archimate-model/profiles/profile.js";

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

describe("application-module-components", () => {
  it("derives application component id with appmodule prefix", () => {
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
    });

    const componentId = applicationComponentIdForModule(module.id);
    assert.notEqual(componentId, module.id);
    assert.match(componentId, /^[0-9a-f]{64}$/);
  });

  it("resolves module coordinates within repository scope", () => {
    const repositoryId = "repo-1";
    const lib = moduleRecord({
      repositoryId,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "1",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const otherRepoLib = moduleRecord({
      repositoryId: "repo-2",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "1",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const index = buildModulesByRepositoryAndCoordinates([lib, otherRepoLib]);

    assert.equal(
      resolveModuleInRepository(index, repositoryId, "com.example", "lib")?.id,
      lib.id,
    );
    assert.equal(
      resolveModuleInRepository(index, "repo-2", "com.example", "lib")?.id,
      otherRepoLib.id,
    );
    assert.equal(moduleCoordinateKey("com.example", "lib"), "com.example\u0000lib");
  });

  it("collects library module ids from dependencies in same repository", () => {
    const repositoryId = "repo-1";
    const consumer = moduleRecord({
      repositoryId,
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
      repositoryId,
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
    const libraryIds = collectLibraryModuleIds([dependency], [consumer, library]);

    assert.deepEqual([...libraryIds], [library.id]);
    assert.notEqual(MavenModuleProfile.create().id, LibraryModuleProfile.create().id);
  });

  it("collects library module ids from cross-repository dependencies", () => {
    const consumer = moduleRecord({
      repositoryId: "repo-consumer",
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
      repositoryId: "repo-library",
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

    const libraryIds = collectLibraryModuleIds([dependency], [consumer, library]);

    assert.deepEqual([...libraryIds], [library.id]);
  });

  it("resolves dependency target in same repository first", () => {
    const repositoryId = "repo-1";
    const consumer = moduleRecord({
      repositoryId,
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
      repositoryId,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const otherRepoLib = moduleRecord({
      repositoryId: "repo-2",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const index = buildModulesByRepositoryAndCoordinates([consumer, library, otherRepoLib]);
    const modulesByCoordinate = buildModulesByCoordinates([consumer, library, otherRepoLib]);

    assert.equal(
      resolveModuleForDependency(index, modulesByCoordinate, consumer, "com.example", "lib")?.id,
      library.id,
    );
  });

  it("resolves dependency target across repositories when missing in consumer repo", () => {
    const consumer = moduleRecord({
      repositoryId: "repo-consumer",
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
      repositoryId: "repo-library",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const index = buildModulesByRepositoryAndCoordinates([consumer, library]);
    const modulesByCoordinate = buildModulesByCoordinates([consumer, library]);

    assert.equal(
      resolveModuleForDependency(index, modulesByCoordinate, consumer, "com.example", "lib")?.id,
      library.id,
    );
  });

  it("returns undefined for external dependency with no scanned module", () => {
    const consumer = moduleRecord({
      repositoryId: "repo-consumer",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const index = buildModulesByRepositoryAndCoordinates([consumer]);
    const modulesByCoordinate = buildModulesByCoordinates([consumer]);

    assert.equal(
      resolveModuleForDependency(index, modulesByCoordinate, consumer, "com.example", "external"),
      undefined,
    );
  });

  it("picks deterministic cross-repo target when same GAV exists in multiple repositories", () => {
    const consumer = moduleRecord({
      repositoryId: "repo-consumer",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const libraryA = moduleRecord({
      repositoryId: "repo-a",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib-a",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const libraryB = moduleRecord({
      repositoryId: "repo-b",
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "lib",
      version: "2",
      name: "lib-b",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const index = buildModulesByRepositoryAndCoordinates([consumer, libraryA, libraryB]);
    const modulesByCoordinate = buildModulesByCoordinates([consumer, libraryA, libraryB]);
    const [firstLibrary, secondLibrary] = [libraryA, libraryB].sort((left, right) =>
      left.id.localeCompare(right.id),
    );

    assert.equal(
      resolveModuleForDependency(index, modulesByCoordinate, consumer, "com.example", "lib")?.id,
      firstLibrary.id,
    );
    assert.notEqual(firstLibrary.id, secondLibrary.id);
  });
});
