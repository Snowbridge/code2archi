import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ModuleBindingResolutionError,
  parseEsmImports,
  resolveEsmBinding,
} from "../../../src/parsers/type-resolution/index.js";

const ESM_SOURCE = `
export const welcome = 'Welcome';
import { sayHello as hello, Messenger } from './message.js';
import * as MyModule from 'module-name';
import { standardGenerateElementProperties } from "../../../../generate/archi-element-properties.js";
import yargs from "yargs";
`;

describe("resolve-esm-binding", () => {
  const bindings = parseEsmImports(ESM_SOURCE);

  it("resolves named import binding", () => {
    assert.equal(
      resolveEsmBinding("Messenger", bindings),
      "Messenger#import { sayHello as hello, Messenger } from './message.js';",
    );
  });

  it("resolves renamed import binding", () => {
    assert.equal(
      resolveEsmBinding("hello", bindings),
      "hello#import { sayHello as hello, Messenger } from './message.js';",
    );
  });

  it("resolves namespace import binding", () => {
    assert.equal(
      resolveEsmBinding("MyModule", bindings),
      "MyModule#import * as MyModule from 'module-name';",
    );
  });

  it("resolves default import binding", () => {
    assert.equal(
      resolveEsmBinding("yargs", bindings),
      "yargs#import yargs from \"yargs\";",
    );
  });

  it("resolves deep relative named import", () => {
    assert.equal(
      resolveEsmBinding("standardGenerateElementProperties", bindings),
      'standardGenerateElementProperties#import { standardGenerateElementProperties } from "../../../../generate/archi-element-properties.js";',
    );
  });

  it("throws for unresolved binding", () => {
    assert.throws(
      () => resolveEsmBinding("Missing", bindings),
      (error: unknown) => error instanceof ModuleBindingResolutionError,
    );
  });
});
