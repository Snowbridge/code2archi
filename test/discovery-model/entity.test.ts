import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../src/discovery-model/entities/application-module.js";
import { ApplicationModuleDependency } from "../../src/discovery-model/entities/application-module-dependency.js";
import { Repository } from "../../src/discovery-model/entities/repository.js";
import { withTestLogging } from "../platform/logging/test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

describe("Entity id", () => {
  it("returns deterministic sha256 hex for Repository", () => {
    const keys = {
      url: "https://github.com/example/repo.git",
      localPath: "/workspace/my-app",
      name: "my-app",
      namespace: "/my-app",
      buildSystems: ["maven"],
    };
    const first = new Repository(keys);
    const second = new Repository(keys);

    assert.equal(first.id, second.id);
    assert.match(first.id, /^[a-f0-9]{64}$/);
  });

  it("changes Repository id when localPath differs", () => {
    const base = {
      url: "",
      name: "a",
      namespace: "/a",
      buildSystems: [] as const,
    };
    const a = new Repository({ ...base, localPath: "/workspace/a" });
    const b = new Repository({ ...base, localPath: "/workspace/b" });
    assert.notEqual(a.id, b.id);
  });

  it("uses different ids for different entity types with the same natural key values", () => {
    const repository = new Repository({
      url: "",
      localPath: "/workspace/shared",
      name: "shared",
      namespace: "/shared",
      buildSystems: [],
    });
    const module = new ApplicationModule({
      repositoryId: "repo",
      buildSystem: "maven",
      groupId: "g",
      artifactId: "shared",
      version: "1",
      name: "shared",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });

    assert.notEqual(repository.id, module.id);
  });

  it("computes ApplicationModuleDependency id from parent id and coordinates", () => {
    const parentId = ApplicationModule.idForCoordinates("", "maven", "com.example", "parent");
    const dependency = new ApplicationModuleDependency({
      parentId,
      groupId: "com.example",
      artifactId: "lib",
      version: "1.0.0",
    });

    const again = new ApplicationModuleDependency({
      parentId,
      groupId: "com.example",
      artifactId: "lib",
      version: "1.0.0",
    });

    assert.equal(dependency.id, again.id);
    assert.match(dependency.id, /^[a-f0-9]{64}$/);
  });

  it("logs hash and natural keys at DEBUG log level", async () => {
    const keys = {
      url: "",
      localPath: "/workspace/my-app",
      name: "my-app",
      namespace: "/my-app",
      buildSystems: [] as const,
    };
    let repository!: Repository;
    const dir = await withTestLogging({ logLevel: "DEBUG", verbose: false }, () => {
      repository = new Repository(keys);
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /entity id computed/);
    assert.match(content, new RegExp(`hash=${repository.id}`));
    assert.match(content, /input=Repository::\/workspace\/my-app/);
  });
});
