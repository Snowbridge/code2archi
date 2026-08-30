import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import { computeArchiId } from "../../../src/archimate-model/archi-id.js";
import { GitRepoProfile } from "../../../src/archimate-model/profiles/profile.js";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../src/discovery-model/entities/application-module-dependency.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { CodeRepositoriesWithModulesProcessor } from "../../../src/processors/generate.elements/code-repositories-with-modules-processor.js";

function createDiscoveryStore(
  repository: Repository,
  modules: ApplicationModule[],
  dependencies: ApplicationModuleDependency[] = [],
): RunEntityStore {
  const store = new RunEntityStore({
    sourceDirs: [repository.localPath],
    scanId: "scan-1",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
  });
  store.addCreateIntents(
    "scan.scope",
    { groupId: "scan.scope", artifactId: "test" },
    { entities: { Repository: [repository] } },
  );
  store.addCreateIntents(
    "scan.source",
    { groupId: "scan.source", artifactId: "test" },
    {
      entities: {
        ApplicationModule: modules,
        ApplicationModuleDependency: dependencies,
      },
    },
  );
  return store;
}

function createArchiStore(): ArchiModelStore {
  return new ArchiModelStore({
    modelName: "test",
    modelId: "model-id",
  });
}

describe("CodeRepositoriesWithModulesProcessor", () => {
  it("maps repository and standalone modules with relations", () => {
    const repository = new Repository({
      url: "https://example.com/app.git",
      localPath: "/repo/app",
      name: "app-repo",
      namespace: "/app",
      buildSystems: ["maven", "npm"],
    });
    const mavenModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "service-a",
      version: "1.0.0",
      name: "service-a",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const npmModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "npm",
      groupId: "@scope",
      artifactId: "web-ui",
      version: "2.0.0",
      name: "web-ui",
      repoPath: "frontend",
      buildScript: "frontend/package.json",
      isMultimodule: false,
    });

    const discovery = createDiscoveryStore(repository, [mavenModule, npmModule]).snapshot();
    const archi = createArchiStore().snapshot();
    const output = new CodeRepositoriesWithModulesProcessor().process({ discovery, archi });

    assert.equal(output.profiles?.length, 7);
    assert.equal(output.elements?.length, 5);
    assert.equal(output.relations?.length, 6);

    const repoArtifact = output.elements?.find((element) => element.id === repository.id);
    assert.equal(repoArtifact?.name, "app-repo");
    assert.equal(
      repoArtifact?.properties?.find((property) => property.key === "c2a:modulesCount")?.value,
      "2",
    );

    const mavenBuildScriptId = computeArchiId("BuildScript", repository.id, "pom.xml");
    assert.ok(output.elements?.some((element) => element.id === mavenBuildScriptId));
    assert.ok(output.relations?.some((relation) => relation.relationType === "CompositionRelationship"));
    assert.ok(output.relations?.some((relation) => relation.relationType === "RealizationRelationship"));
    assert.ok(output.relations?.some((relation) => relation.relationType === "AssociationRelationship"));
  });

  it("creates library module and aggregation only for declared dependencies", () => {
    const repository = new Repository({
      url: "",
      localPath: "/repo/app",
      name: "app-repo",
      namespace: "/app",
      buildSystems: ["maven"],
    });
    const appModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "app",
      version: "1.0.0",
      name: "app",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const libModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.dep",
      artifactId: "lib",
      version: "2.0.0",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const dependency = new ApplicationModuleDependency({
      parentId: appModule.id,
      groupId: "com.dep",
      artifactId: "lib",
      version: "2.0.0",
    });

    const discovery = createDiscoveryStore(repository, [appModule, libModule], [dependency]).snapshot();
    const archi = createArchiStore().snapshot();
    const output = new CodeRepositoriesWithModulesProcessor().process({ discovery, archi });

    const libraryComponents = output.elements?.filter(
      (element) =>
        element.conceptType === "ApplicationComponent" &&
        element.profileIds?.length === 1 &&
        element.id === libModule.id,
    );
    assert.equal(libraryComponents?.length, 1);

    const aggregations = output.relations?.filter(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregations?.length, 1);
    assert.equal(aggregations?.[0]?.sourceId, appModule.id);
    assert.equal(aggregations?.[0]?.targetId, libModule.id);
    assert.equal(
      aggregations?.[0]?.properties?.find((property) => property.key === "version")?.value,
      "2.0.0",
    );

    const libBuildScriptId = computeArchiId("BuildScript", repository.id, "lib/pom.xml");
    assert.equal(output.elements?.some((element) => element.id === libBuildScriptId), false);
  });

  it("does not treat depended-on modules as standalone", () => {
    const repository = new Repository({
      url: "",
      localPath: "/repo/app",
      name: "app-repo",
      namespace: "/app",
      buildSystems: ["maven"],
    });
    const appModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "app",
      version: "1.0.0",
      name: "app",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const libModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.dep",
      artifactId: "lib",
      version: "2.0.0",
      name: "lib",
      repoPath: "lib",
      buildScript: "lib/pom.xml",
      isMultimodule: false,
    });
    const dependency = new ApplicationModuleDependency({
      parentId: appModule.id,
      groupId: "com.dep",
      artifactId: "lib",
      version: "2.0.0",
    });

    const discovery = createDiscoveryStore(repository, [appModule, libModule], [dependency]).snapshot();
    const archi = createArchiStore().snapshot();
    const output = new CodeRepositoriesWithModulesProcessor().process({ discovery, archi });

    const realizationToLib = output.relations?.find(
      (relation) =>
        relation.relationType === "RealizationRelationship" && relation.targetId === libModule.id,
    );
    assert.equal(realizationToLib, undefined);
  });

  it("does not emit profiles already present in archi snapshot", () => {
    const repository = new Repository({
      url: "",
      localPath: "/repo/app",
      name: "app-repo",
      namespace: "/app",
      buildSystems: ["maven"],
    });
    const module = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "app",
      version: "1.0.0",
      name: "app",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });

    const archiStore = createArchiStore();
    archiStore.registerProfile(GitRepoProfile.create());
    const discovery = createDiscoveryStore(repository, [module]).snapshot();
    const output = new CodeRepositoriesWithModulesProcessor().process({
      discovery,
      archi: archiStore.snapshot(),
    });

    assert.equal(output.profiles?.some((profile) => profile.name === "Git repo"), false);
    assert.equal(output.profiles?.length, 6);
  });

  it("creates SystemSoftware and Assignment relations for build tool and runtimes", () => {
    const repository = new Repository({
      url: "",
      localPath: "/repo/app",
      name: "app-repo",
      namespace: "/app",
      buildSystems: ["gradle"],
    });
    const module = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "gradle",
      groupId: "com.example",
      artifactId: "app",
      version: "1.0.0",
      name: "app",
      repoPath: ".",
      buildScript: "build.gradle",
      isMultimodule: false,
      buildToolVersion: "8.5",
      javaVersion: "17",
      kotlinJvmTarget: "17",
      kotlinCompilerVersion: "1.9.22",
      nodeVersion: "unknown",
    });

    const discovery = createDiscoveryStore(repository, [module]).snapshot();
    const archi = createArchiStore().snapshot();
    const output = new CodeRepositoriesWithModulesProcessor().process({ discovery, archi });

    const gradleId = computeArchiId("SystemSoftware", "gradle", "8.5");
    const javaId = computeArchiId("SystemSoftware", "java", "17");
    const kotlinId = computeArchiId("SystemSoftware", "kotlin", "1.9.22");
    const buildScriptId = computeArchiId("BuildScript", repository.id, "build.gradle");

    assert.ok(output.elements?.some((element) => element.id === gradleId && element.name === "Gradle 8.5"));
    assert.ok(output.elements?.some((element) => element.id === javaId && element.name === "Java 17"));
    assert.ok(output.elements?.some((element) => element.id === kotlinId && element.name === "Kotlin 1.9.22"));

    const assignments = output.relations?.filter(
      (relation) => relation.relationType === "AssignmentRelationship",
    );
    assert.equal(assignments?.length, 3);
    assert.ok(
      assignments?.some(
        (relation) => relation.sourceId === gradleId && relation.targetId === buildScriptId,
      ),
    );
    assert.ok(
      assignments?.some(
        (relation) =>
          relation.sourceId === javaId &&
          relation.targetId === module.id &&
          relation.profileIds?.length === 1,
      ),
    );
    assert.ok(
      assignments?.some(
        (relation) =>
          relation.sourceId === kotlinId &&
          relation.targetId === module.id &&
          relation.profileIds?.length === 1,
      ),
    );
  });
});
