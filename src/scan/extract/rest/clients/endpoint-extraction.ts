const COMMENT_ENDPOINT_PATTERN =
  /\/\/\s*(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s*]+)/gi;

const PATH_LITERAL_PATTERN = /"(\/[^"]+)"/g;

const FROM_PATH_LITERAL_PATTERN = /\.fromPath\s*\(\s*"([^"]+)"\s*\)/g;

const PATH_METHOD_PATTERN = /\.path\s*\(\s*"([^"]+)"\s*\)/g;

const CONCAT_PATH_PATTERN = /\+\s*"(\/[^"]+)"/g;

const JAVA_STRING_CONSTANT_PATTERN =
  /(?:private\s+)?static\s+final\s+String\s+(\w+)\s*=\s*"([^"]+)"/g;

const KOTLIN_STRING_CONSTANT_PATTERN =
  /(?:private\s+)?const\s+val\s+(\w+)\s*=\s*"([^"]+)"/g;

const FROM_PATH_CONSTANT_PATTERN = /\.fromPath\s*\(\s*(\w+)\s*\)/g;

const HTTP_METHOD_ENUM_PATTERN = /HttpMethod\.(\w+)/g;

export function extractClassStringConstants(
  classBodyText: string,
  language: "java" | "kotlin",
): ReadonlyMap<string, string> {
  const constants = new Map<string, string>();
  const pattern =
    language === "java" ? JAVA_STRING_CONSTANT_PATTERN : KOTLIN_STRING_CONSTANT_PATTERN;
  for (const match of classBodyText.matchAll(pattern)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined && value.startsWith("/")) {
      constants.set(name, value);
    }
  }
  return constants;
}

export function extractProgrammaticEndpoints(
  classBodyText: string,
  methodBodies: readonly { readonly name: string; readonly text: string }[],
  language: "java" | "kotlin",
): string[] {
  const constants = extractClassStringConstants(classBodyText, language);
  const endpoints = new Set<string>();

  for (const match of classBodyText.matchAll(COMMENT_ENDPOINT_PATTERN)) {
    const method = match[1]?.toUpperCase();
    const path = normalizePath(match[2]);
    if (method !== undefined && path !== undefined) {
      endpoints.add(`${method} ${path}`);
    }
  }

  for (const method of methodBodies) {
    collectEndpointsFromMethodText(method.text, constants, endpoints);
  }

  collectLiteralPaths(classBodyText, constants, endpoints);

  return [...endpoints].sort((left, right) => left.localeCompare(right));
}

function collectEndpointsFromMethodText(
  methodText: string,
  constants: ReadonlyMap<string, string>,
  endpoints: Set<string>,
): void {
  const httpMethod = inferHttpMethod(methodText);

  for (const match of methodText.matchAll(FROM_PATH_LITERAL_PATTERN)) {
    const path = normalizePath(match[1]);
    if (path !== undefined) {
      endpoints.add(`${httpMethod} ${path}`);
    }
  }

  for (const match of methodText.matchAll(FROM_PATH_CONSTANT_PATTERN)) {
    const constantName = match[1];
    if (constantName === undefined) {
      continue;
    }
    const path = normalizePath(constants.get(constantName));
    if (path !== undefined) {
      endpoints.add(`${httpMethod} ${path}`);
    }
  }

  for (const match of methodText.matchAll(PATH_METHOD_PATTERN)) {
    const path = normalizePath(match[1]);
    if (path !== undefined) {
      endpoints.add(`${httpMethod} ${path}`);
    }
  }

  for (const match of methodText.matchAll(CONCAT_PATH_PATTERN)) {
    const path = normalizePath(match[1]);
    if (path !== undefined) {
      endpoints.add(`${httpMethod} ${path}`);
    }
  }

  for (const match of methodText.matchAll(PATH_LITERAL_PATTERN)) {
    const path = normalizePath(match[1]);
    if (path !== undefined && isLikelyEndpointPath(path)) {
      endpoints.add(`${httpMethod} ${path}`);
    }
  }
}

function collectLiteralPaths(
  classBodyText: string,
  constants: ReadonlyMap<string, string>,
  endpoints: Set<string>,
): void {
  for (const [, value] of constants) {
    const path = normalizePath(value);
    if (path !== undefined) {
      endpoints.add(`GET ${path}`);
    }
  }
}

function inferHttpMethod(context: string): string {
  const enumMatch = [...context.matchAll(HTTP_METHOD_ENUM_PATTERN)][0];
  if (enumMatch?.[1] !== undefined) {
    return enumMatch[1].toUpperCase();
  }
  if (/new\s+HttpPost\b|postForObject|\.post\s*\(/i.test(context)) {
    return "POST";
  }
  if (/new\s+HttpPut\b|putForObject|\.put\s*\(/i.test(context)) {
    return "PUT";
  }
  if (/new\s+HttpDelete\b|\.delete\s*\(/i.test(context)) {
    return "DELETE";
  }
  if (/new\s+HttpPatch\b|\.patch\s*\(/i.test(context)) {
    return "PATCH";
  }
  if (/getForObject|new\s+HttpGet\b|\.get\s*\(/i.test(context)) {
    return "GET";
  }
  return "POST";
}

function normalizePath(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, "") || "/";
}

function isLikelyEndpointPath(path: string): boolean {
  if (path === "/" || path.length < 2) {
    return false;
  }
  return /[a-zA-Z0-9_{}-]/.test(path);
}
