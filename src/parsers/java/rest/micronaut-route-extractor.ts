import type { JavaParameter, JavaTypeRef } from "../java-ast-model.js";
import type { GenericCstNode } from "../java-cst-utils.js";
import {
  collectPrimaryInvocations,
  extractIdentifierName,
  extractStringLiteral,
} from "./functional-cst-utils.js";
import { formatEndpoint } from "./rest-path-normalizer.js";
import {
  micronautRouteBuilderProfile,
  type MicronautHttpMethod,
} from "./profiles/micronaut-route-builder-profile.js";

export interface MicronautHandlerBinding {
  readonly handlerMethodName: string;
  readonly controllerParameterName?: string;
  readonly usesThis: boolean;
}

export interface MicronautRouteExtraction {
  readonly endpoints: readonly string[];
  readonly handlerBindings: readonly MicronautHandlerBinding[];
}

const HTTP_METHOD_SET = new Set<string>(micronautRouteBuilderProfile.httpMethodNames);

export function extractMicronautRoutes(
  body: GenericCstNode | undefined,
): MicronautRouteExtraction {
  const endpoints = new Set<string>();
  const handlerBindings: MicronautHandlerBinding[] = [];

  collectPrimaryInvocations(body, (methodName, args) => {
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

export function resolveMicronautHandlerParameterType(
  binding: MicronautHandlerBinding,
  parameters: readonly JavaParameter[],
): JavaTypeRef | undefined {
  if (binding.usesThis) {
    return undefined;
  }

  if (!binding.controllerParameterName) {
    return undefined;
  }

  return parameters.find((parameter) => parameter.name === binding.controllerParameterName)?.type;
}
