import type { GenericCstNode } from "../java-cst-utils.js";
import { childNodes, firstChild, walkDescendants } from "../java-cst-utils.js";
import {
  extractStringLiteral,
  getInvocationArgumentExpressions,
  getSuffixName,
} from "../rest/functional-cst-utils.js";
import { joinPaths } from "../rest/rest-path-normalizer.js";

const URI_BUILDER_PATH_METHODS = new Set(["fromPath", "path"]);

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

export function extractUriComponentsBuilderPath(expression: GenericCstNode | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  let path: string | undefined;

  for (const primary of walkDescendants(expression, "primary")) {
    const suffixes = childNodes(primary, "primarySuffix");
    let pendingMethodName: string | undefined;

    for (const primarySuffix of suffixes) {
      const suffixName = getSuffixName(primarySuffix);
      const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
      const args = getInvocationArgumentExpressions(invocationSuffix);

      if (suffixName && args.length === 0 && !invocationSuffix) {
        pendingMethodName = suffixName;
        continue;
      }

      let methodName = suffixName;
      if (!methodName && args.length > 0 && pendingMethodName) {
        methodName = pendingMethodName;
        pendingMethodName = undefined;
      } else if (methodName) {
        pendingMethodName = undefined;
      }

      if (!methodName || !URI_BUILDER_PATH_METHODS.has(methodName) || args.length === 0) {
        continue;
      }

      const segment = extractStringLiteral(args[0]);
      if (!segment) {
        continue;
      }

      path = path ? joinPaths(path, segment) : segment;
    }
  }

  return path;
}

export function extractRestTemplatePathLiteral(argument: GenericCstNode | undefined): string | undefined {
  const builderPath = extractUriComponentsBuilderPath(argument);
  if (builderPath) {
    return builderPath;
  }

  const literal = extractStringLiteral(argument);
  if (!literal || isAbsoluteUrl(literal)) {
    return undefined;
  }

  return literal;
}
