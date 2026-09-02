import type { SyntaxNode } from "tree-sitter";
import {
  findChildren,
  findDirectChild,
  findDirectChildren,
  nodeChildren,
  nodeText,
} from "./kotlin-tree-sitter-utils.js";

function unwrapParenthesized(node: SyntaxNode): SyntaxNode {
  if (node.type === "parenthesized_expression") {
    const inner = node.namedChild(0);
    if (inner) {
      return unwrapParenthesized(inner);
    }
  }
  return node;
}

function getLastNavigationSuffixName(navigation: SyntaxNode): string | undefined {
  const suffixes = findDirectChildren(navigation, "navigation_suffix");
  const lastSuffix = suffixes.at(-1);
  if (!lastSuffix) {
    return undefined;
  }

  const identifier = findDirectChild(lastSuffix, "simple_identifier");
  return identifier ? nodeText(identifier) : undefined;
}

function extractArgsFromCallSuffix(callSuffix: SyntaxNode | undefined): SyntaxNode[] {
  if (!callSuffix) {
    return [];
  }

  const valueArguments =
    findDirectChild(callSuffix, "value_arguments") ?? findDirectChild(callSuffix, "arguments");
  if (!valueArguments) {
    return [];
  }

  const args: SyntaxNode[] = [];
  for (const child of nodeChildren(valueArguments)) {
    if (child.type === "value_argument") {
      const expression =
        child.childForFieldName("value") ??
        nodeChildren(child).find(
          (node) => node.type !== "simple_identifier" && node.type !== ",",
        );
      if (expression) {
        args.push(expression);
      }
      continue;
    }

    if (child.type !== "," && child.type !== "(" && child.type !== ")") {
      args.push(child);
    }
  }

  return args;
}

export function extractStringLiteral(node: SyntaxNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  const unwrapped = unwrapParenthesized(node);

  if (unwrapped.type === "string_literal" || unwrapped.type === "line_string_literal") {
    const content = nodeText(unwrapped);
    if (content.length >= 2 && (content.startsWith('"') || content.startsWith("'"))) {
      return content.slice(1, -1);
    }
    return content;
  }

  if (unwrapped.type === "string_content") {
    return nodeText(unwrapped);
  }

  for (const child of nodeChildren(unwrapped)) {
    const value = extractStringLiteral(child);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function extractCallableReferenceName(node: SyntaxNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  const unwrapped = unwrapParenthesized(node);

  if (unwrapped.type === "callable_reference") {
    const identifier =
      findDirectChild(unwrapped, "simple_identifier") ?? findDirectChild(unwrapped, "type_identifier");
    if (identifier) {
      return nodeText(identifier);
    }
  }

  for (const child of nodeChildren(unwrapped)) {
    const name = extractCallableReferenceName(child);
    if (name) {
      return name;
    }
  }

  return undefined;
}

function findLambdaInCallSuffix(callNode: SyntaxNode): SyntaxNode | undefined {
  const callSuffix = findDirectChild(callNode, "call_suffix");
  if (!callSuffix) {
    return undefined;
  }

  for (const child of nodeChildren(callSuffix)) {
    const unwrapped = unwrapParenthesized(child);
    if (unwrapped.type === "lambda_literal" || unwrapped.type === "annotated_lambda") {
      return unwrapped;
    }
  }

  const unwrapped = unwrapParenthesized(callSuffix);
  if (unwrapped.type === "lambda_literal" || unwrapped.type === "annotated_lambda") {
    return unwrapped;
  }

  return findLambdaBlockArgument([callSuffix]);
}

export function getCallName(node: SyntaxNode): string | undefined {
  const unwrapped = unwrapParenthesized(node);

  if (unwrapped.type === "call_expression") {
    const innerCall = findDirectChild(unwrapped, "call_expression");
    if (innerCall) {
      return getCallName(innerCall);
    }

    const navigation = findDirectChild(unwrapped, "navigation_expression");
    if (navigation) {
      const suffixName = getLastNavigationSuffixName(navigation);
      if (suffixName) {
        return suffixName;
      }
    }

    const callee = unwrapped.childForFieldName("value") ?? unwrapped.namedChild(0);
    if (!callee) {
      return undefined;
    }

    if (callee.type === "simple_identifier" || callee.type === "type_identifier") {
      return nodeText(callee);
    }

    return getLastNavigationSuffixName(callee) ?? getCallName(callee);
  }

  if (unwrapped.type === "navigation_expression") {
    return getLastNavigationSuffixName(unwrapped);
  }

  if (unwrapped.type === "simple_identifier" || unwrapped.type === "type_identifier") {
    return nodeText(unwrapped);
  }

  return undefined;
}

export function getCallArguments(node: SyntaxNode): SyntaxNode[] {
  const unwrapped = unwrapParenthesized(node);

  if (unwrapped.type === "call_expression") {
    const innerCall = findDirectChild(unwrapped, "call_expression");
    if (innerCall) {
      return getCallArguments(innerCall);
    }

    return extractArgsFromCallSuffix(findDirectChild(unwrapped, "call_suffix"));
  }

  if (unwrapped.type === "navigation_expression") {
    const lastSuffix = findDirectChildren(unwrapped, "navigation_suffix").at(-1);
    return extractArgsFromCallSuffix(
      lastSuffix ? findDirectChild(lastSuffix, "call_suffix") : undefined,
    );
  }

  return [];
}

export function collectCallExpressions(
  root: SyntaxNode | undefined,
  visitor: (methodName: string, args: readonly SyntaxNode[], node: SyntaxNode) => void,
): void {
  if (!root) {
    return;
  }

  for (const node of findChildren(root, "call_expression")) {
    const methodName = getCallName(node);
    if (methodName) {
      visitor(methodName, getCallArguments(node), node);
    }
  }
}

export function findLambdaBlockArgument(args: readonly SyntaxNode[]): SyntaxNode | undefined {
  for (const arg of args) {
    const unwrapped = unwrapParenthesized(arg);
    if (unwrapped.type === "lambda_literal" || unwrapped.type === "annotated_lambda") {
      return unwrapped;
    }
  }

  return undefined;
}

export function findTrailingLambda(callNode: SyntaxNode): SyntaxNode | undefined {
  return findLambdaInCallSuffix(callNode);
}

export function bodyContainsCallNamed(body: SyntaxNode | undefined, names: readonly string[]): boolean {
  if (!body) {
    return false;
  }

  const nameSet = new Set(names.map((name) => name.toLowerCase()));
  let found = false;

  collectCallExpressions(body, (methodName) => {
    if (nameSet.has(methodName.toLowerCase())) {
      found = true;
    }
  });

  return found;
}
