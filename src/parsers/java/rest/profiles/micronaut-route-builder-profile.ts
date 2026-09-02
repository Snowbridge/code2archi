export const micronautRouteBuilderProfile = {
  id: "micronaut-route-builder",
  routeBuilderTypeNames: [
    "RouteBuilder",
    "io.micronaut.web.router.RouteBuilder",
    "DefaultRouteBuilder",
    "io.micronaut.web.router.DefaultRouteBuilder",
  ],
  httpMethodNames: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"] as const,
} as const;

export type MicronautHttpMethod = (typeof micronautRouteBuilderProfile.httpMethodNames)[number];
