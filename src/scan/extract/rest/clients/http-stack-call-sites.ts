import type { JvmMethodBody } from "./jvm-class-body.js";

const HTTP_CALL_PATTERNS: readonly RegExp[] = [
  /\.getForObject\s*\(/,
  /\.postForObject\s*\(/,
  /\.putForObject\s*\(/,
  /\.delete\s*\(/,
  /\.exchange\s*\(/,
  /\.execute\s*\(/,
  /RestTemplate/,
  /WebClient/,
  /RestClient\.create/,
  /\.get\s*\(\s*\)/,
  /\.post\s*\(\s*\)/,
  /\.put\s*\(\s*\)/,
  /\.patch\s*\(\s*\)/,
  /new\s+Http(?:Post|Get|Put|Delete|Patch)\b/,
  /HttpClient\.newHttpClient/,
  /HttpRequest\.newBuilder/,
  /\.send\s*\(/,
  /OkHttpClient/,
  /\.newCall\s*\(/,
];

export function methodHasHttpCallSite(method: JvmMethodBody): boolean {
  return HTTP_CALL_PATTERNS.some((pattern) => pattern.test(method.text));
}

export function typeHasHttpCallSiteInOwnMethods(methods: readonly JvmMethodBody[]): boolean {
  return methods.some((method) => methodHasHttpCallSite(method));
}
