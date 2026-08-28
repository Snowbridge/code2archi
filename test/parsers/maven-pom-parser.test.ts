import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseMavenRepository } from "../../src/parsers/maven-pom-parser.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("maven-pom-parser", () => {
  it("parses single-module pom with dependencies", () => {
    const root = createTestTempDir("c2a-maven-single-");
    writeFileSync(
      path.join(root, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.1.0</version>
    </dependency>
  </dependencies>
</project>`,
    );

    const modules = parseMavenRepository(root);
    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.coordinates.groupId, "com.example");
    assert.equal(modules[0]?.coordinates.artifactId, "my-app");
    assert.equal(modules[0]?.isMultimodule, false);
    assert.equal(modules[0]?.dependencies.length, 1);
    assert.equal(modules[0]?.dependencies[0]?.artifactId, "spring-core");
  });

  it("inherits groupId and version from parent pom", () => {
    const root = createTestTempDir("c2a-maven-parent-");
    mkdirSync(path.join(root, "child"), { recursive: true });
    writeFileSync(
      path.join(root, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.parent</groupId>
  <artifactId>parent</artifactId>
  <version>2.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>child</module>
  </modules>
</project>`,
    );
    writeFileSync(
      path.join(root, "child", "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.parent</groupId>
    <artifactId>parent</artifactId>
    <version>2.0.0</version>
  </parent>
  <artifactId>child</artifactId>
</project>`,
    );

    const modules = parseMavenRepository(root);
    assert.equal(modules.length, 2);
    const child = modules.find((module) => module.coordinates.artifactId === "child");
    assert.equal(child?.coordinates.groupId, "com.parent");
    assert.equal(child?.coordinates.version, "2.0.0");
    assert.equal(child?.parentCoordinates?.artifactId, "parent");
  });

  it("resolves dependency version from dependencyManagement", () => {
    const root = createTestTempDir("c2a-maven-dm-");
    writeFileSync(
      path.join(root, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>managed</artifactId>
  <version>1.0.0</version>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>com.lib</groupId>
        <artifactId>core</artifactId>
        <version>3.3.3</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.lib</groupId>
      <artifactId>core</artifactId>
    </dependency>
  </dependencies>
</project>`,
    );

    const modules = parseMavenRepository(root);
    assert.equal(modules[0]?.dependencies[0]?.version, "3.3.3");
  });
});
