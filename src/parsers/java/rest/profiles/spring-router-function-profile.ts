export const springRouterFunctionProfile = {
  id: "spring-router-function",
  beanAnnotationNames: ["Bean", "org.springframework.context.annotation.Bean"],
  routerFunctionTypeNames: [
    "RouterFunction",
    "org.springframework.web.reactive.function.server.RouterFunction",
    "org.springframework.web.servlet.function.RouterFunction",
  ],
  coRouterFunctionTypeNames: [
    "CoRouterFunction",
    "org.springframework.web.reactive.function.server.CoRouterFunction",
  ],
  kotlinRouterEntrypointNames: ["router", "coRouter"] as const,
  httpMethodNames: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const,
  pathPrefixMethodNames: ["nest", "path"],
  routeBuilderMethodNames: ["route", "andRoute"],
} as const;

export type SpringRouterHttpMethod =
  (typeof springRouterFunctionProfile.httpMethodNames)[number];
