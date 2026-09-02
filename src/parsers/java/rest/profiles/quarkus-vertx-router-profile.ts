export const quarkusVertxRouterProfile = {
  id: "quarkus-vertx-router",
  routerTypeNames: ["Router", "io.vertx.ext.web.Router"],
  httpMethodNames: ["get", "post", "put", "patch", "delete", "head", "options", "route"] as const,
} as const;
