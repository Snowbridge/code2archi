import type { SyntaxNode } from "tree-sitter";
import type { JavaTypeRef } from "../java/java-ast-model.js";
import {
  collectCallExpressions,
  extractCallableReferenceName,
  extractStringLiteral,
} from "./kotlin-functional-cst-utils.js";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import {
  micronautRouteBuilderProfile,
  type MicronautHttpMethod,
} from "../java/rest/profiles/micronaut-route-builder-profile.js";
import type { KotlinParameter } from "./kotlin-ast-model.js";

export interface MicronautKotlinHandlerBinding {
  readonly handlerMethodName: string;
  readonly controllerParameterName?: string;
  readonly usesThis: boolean;
}

export interface MicronautKotlinRouteExtraction {
  readonly endpoints: readonly string[];
  readonly handlerBindings: readonly MicronautKotlinHandlerBinding[];
}

const HTTP_METHOD_SET = new Set<string>(micronautRouteBuilderProfile.httpMethodNames);

export function extractMicronautKotlinRoutes(body: SyntaxNode | undefined): MicronautKotlinRouteExtraction {
  const endpoints = new Set<string>();
  const handlerBindings: MicronautKotlinHandlerBinding[] = [];

  collectCallExpressions(body, (methodName, args) => {
    if (!HTTP_METHOD_SET.has(methodName) || args.length === 0) {
      return;
    }

    const pathSegment = extractStringLiteral(args[0]);
    if (pathSegment === undefined) {
      return;
    }

    endpoints.add(formatEndpoint(methodName as MicronautHttpMethod, pathSegment));

    const handlerMethodName = args[2] ? extractStringLiteral(args[2]) : undefined;
    if (!handlerMethodName) {
      return;
    }

    const targetName = args[1] ? extractIdentifierName(args[1]) : undefined;
    handlerBindings.push({
      handlerMethodName,
      controllerParameterName: targetName && targetName !== "this" ? targetName : undefined,
      usesThis: targetName === "this",
    });
  });

  return {
    endpoints: [...endpoints].sort(),
    handlerBindings,
  };
}

function extractIdentifierName(expression: SyntaxNode): string | undefined {
  if (expression.type === "simple_identifier" || expression.type === "type_identifier") {
    return expression.text;
  }

  if (expression.type === "this_expression") {
    return "this";
  }

  for (let index = 0; index < expression.namedChildCount; index += 1) {
    const child = expression.namedChild(index);
    if (!child) {
      continue;
    }
    const name = extractIdentifierName(child);
    if (name) {
      return name;
    }
  }

  return undefined;
}

export function resolveMicronautKotlinHandlerParameterType(
  binding: MicronautKotlinHandlerBinding,
  parameters: readonly KotlinParameter[],
): JavaTypeRef | undefined {
  if (binding.usesThis) {
    return undefined;
  }

  if (!binding.controllerParameterName) {
    return undefined;
  }

  return parameters.find((parameter) => parameter.name === binding.controllerParameterName)?.type;
}
