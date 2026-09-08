import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FqcnResolutionError,
  parseJavaImports,
  resolveJavaFqcn,
} from "../../../src/parsers/type-resolution/index.js";

const JAVA_SOURCE = `
import com.farzoom.fnscontainerparser.interfaces.FnsContainerContract;
import com.farzoom.fnscontainerparser;
import java.util.zip.ZipEntry;
import com.foo.bar.glimpjwornzwort.*;
`;

describe("resolve-java-fqcn", () => {
  const imports = parseJavaImports(JAVA_SOURCE);

  it("resolves simple name via exact import", () => {
    assert.equal(
      resolveJavaFqcn("FnsContainerContract", { packageName: "com.app", imports }),
      "com.farzoom.fnscontainerparser.interfaces.FnsContainerContract",
    );
    assert.equal(
      resolveJavaFqcn("ZipEntry", { packageName: "com.app", imports }),
      "java.util.zip.ZipEntry",
    );
  });

  it("resolves simple name via single wildcard import", () => {
    assert.equal(
      resolveJavaFqcn("MzulkPlyrtQwyst", { packageName: "com.app", imports }),
      "com.foo.bar.glimpjwornzwort.MzulkPlyrtQwyst",
    );
  });

  it("resolves qualified name via partial import match", () => {
    assert.equal(
      resolveJavaFqcn("fnscontainerparser.exception.BuhRecordItemHelper", {
        packageName: "com.app",
        imports,
      }),
      "com.farzoom.fnscontainerparser.exception.BuhRecordItemHelper",
    );
  });

  it("resolves same-package simple name", () => {
    assert.equal(
      resolveJavaFqcn("LocalHelper", { packageName: "com.example.app", imports: [] }),
      "com.example.app.LocalHelper",
    );
  });

  it("resolves java.lang for empty package", () => {
    assert.equal(resolveJavaFqcn("String", { packageName: "", imports: [] }), "java.lang.String");
  });

  it("throws on ambiguous exact imports", () => {
    assert.throws(
      () =>
        resolveJavaFqcn("Duplicate", {
          packageName: "com.app",
          imports: [
            { kind: "type", qualifiedName: "com.one.Duplicate" },
            { kind: "type", qualifiedName: "com.two.Duplicate" },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof FqcnResolutionError);
        assert.equal(error.reason, "ambiguous_import");
        return true;
      },
    );
  });

  it("throws when no wildcard imports match", () => {
    assert.throws(
      () => resolveJavaFqcn("Unknown", { packageName: "", imports: [] }),
      (error: unknown) => {
        assert.ok(error instanceof FqcnResolutionError);
        assert.equal(error.reason, "unresolved");
        return true;
      },
    );
  });

  it("throws on multiple wildcard imports", () => {
    assert.throws(
      () =>
        resolveJavaFqcn("Unknown", {
          packageName: "",
          imports: [
            { kind: "wildcard", qualifiedName: "com.one" },
            { kind: "wildcard", qualifiedName: "com.two" },
          ],
        }),
      (error: unknown) => error instanceof FqcnResolutionError,
    );
  });

  it("throws for qualified name without partial import", () => {
    assert.throws(
      () =>
        resolveJavaFqcn("missing.Type", {
          packageName: "com.app",
          imports: [{ kind: "wildcard", qualifiedName: "com.foo" }],
        }),
      (error: unknown) => error instanceof FqcnResolutionError,
    );
  });
});
