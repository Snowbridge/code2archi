import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FqcnResolutionError,
  parseKotlinImports,
  resolveKotlinFqcn,
} from "../../../src/parsers/type-resolution/index.js";

const KOTLIN_SOURCE = `
import com.farzoom.fnscontainerparser.interfaces.FnsContainerContract
import online.oboz.notificator.message_processing.output as GW
import online.oboz.notificator.message_processing.domain.service.*
`;

describe("resolve-kotlin-fqcn", () => {
  const imports = parseKotlinImports(KOTLIN_SOURCE);

  it("resolves simple name via exact import", () => {
    assert.equal(
      resolveKotlinFqcn("FnsContainerContract", { packageName: "com.app", imports }),
      "com.farzoom.fnscontainerparser.interfaces.FnsContainerContract",
    );
  });

  it("resolves simple name via single wildcard import", () => {
    assert.equal(
      resolveKotlinFqcn("UsersCrudService", { packageName: "com.app", imports }),
      "online.oboz.notificator.message_processing.domain.service.UsersCrudService",
    );
  });

  it("resolves qualified name via import alias", () => {
    assert.equal(
      resolveKotlinFqcn("GW.UserAccessWorkerRolesCrudGateway", {
        packageName: "com.app",
        imports,
      }),
      "online.oboz.notificator.message_processing.output.UserAccessWorkerRolesCrudGateway",
    );
  });

  it("throws for unresolved qualified name", () => {
    assert.throws(
      () =>
        resolveKotlinFqcn("repository.DefaultSettingsRepo", {
          packageName: "com.app",
          imports,
        }),
      (error: unknown) => error instanceof FqcnResolutionError,
    );
  });
});
