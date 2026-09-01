import type { AnnotationRule, RestFrameworkProfile } from "../rest-framework-profile.js";

const JAX_RS_VERBS: AnnotationRule[] = [
  { names: ["GET", "jakarta.ws.rs.GET", "javax.ws.rs.GET"], role: "http-verb", httpMethod: "GET", mappingStyle: "split" },
  { names: ["POST", "jakarta.ws.rs.POST", "javax.ws.rs.POST"], role: "http-verb", httpMethod: "POST", mappingStyle: "split" },
  { names: ["PUT", "jakarta.ws.rs.PUT", "javax.ws.rs.PUT"], role: "http-verb", httpMethod: "PUT", mappingStyle: "split" },
  { names: ["PATCH", "jakarta.ws.rs.PATCH", "javax.ws.rs.PATCH"], role: "http-verb", httpMethod: "PATCH", mappingStyle: "split" },
  { names: ["DELETE", "jakarta.ws.rs.DELETE", "javax.ws.rs.DELETE"], role: "http-verb", httpMethod: "DELETE", mappingStyle: "split" },
  { names: ["HEAD", "jakarta.ws.rs.HEAD", "javax.ws.rs.HEAD"], role: "http-verb", httpMethod: "HEAD", mappingStyle: "split" },
  { names: ["OPTIONS", "jakarta.ws.rs.OPTIONS", "javax.ws.rs.OPTIONS"], role: "http-verb", httpMethod: "OPTIONS", mappingStyle: "split" },
];

export const jaxRsProfile: RestFrameworkProfile = {
  id: "jax-rs",
  controllerMarkerNames: ["Path", "jakarta.ws.rs.Path", "javax.ws.rs.Path"],
  usesPathAsMarker: true,
  requiresHandlerMethods: true,
  unwrapReturnTypes: ["Response", "GenericEntity", "Optional"],
  rules: [
    {
      names: ["Path", "jakarta.ws.rs.Path", "javax.ws.rs.Path"],
      role: "controller-marker",
    },
    {
      names: ["Path", "jakarta.ws.rs.Path", "javax.ws.rs.Path"],
      role: "class-base-path",
      pathAttribute: "value",
      mappingStyle: "split",
    },
    {
      names: ["Path", "jakarta.ws.rs.Path", "javax.ws.rs.Path"],
      role: "method-mapping",
      pathAttribute: "value",
      mappingStyle: "split",
    },
    ...JAX_RS_VERBS,
  ],
};
