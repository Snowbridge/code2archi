export const ktorRoutingProfile = {
  id: "ktor-routing",
  routeReceiverTypeNames: ["Route", "io.ktor.server.routing.Route"],
  routingFunctionNames: ["routing", "io.ktor.server.routing.routing"],
  httpMethodNames: ["get", "post", "put", "patch", "delete", "head", "options"] as const,
  pathPrefixMethodNames: ["route"] as const,
  defaultHttpMethodForRoute: "GET",
} as const;

export type KtorHttpMethod = (typeof ktorRoutingProfile.httpMethodNames)[number];
