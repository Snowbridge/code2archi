import type { AnnotationRule, RestFrameworkProfile } from "../rest-framework-profile.js";

const MICRONAUT_MAPPING_ANNOTATIONS: AnnotationRule[] = [
  {
    names: ["Get", "io.micronaut.http.annotation.Get"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "GET",
    mappingStyle: "combined",
  },
  {
    names: ["Post", "io.micronaut.http.annotation.Post"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "POST",
    mappingStyle: "combined",
  },
  {
    names: ["Put", "io.micronaut.http.annotation.Put"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "PUT",
    mappingStyle: "combined",
  },
  {
    names: ["Patch", "io.micronaut.http.annotation.Patch"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "PATCH",
    mappingStyle: "combined",
  },
  {
    names: ["Delete", "io.micronaut.http.annotation.Delete"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "DELETE",
    mappingStyle: "combined",
  },
  {
    names: ["Head", "io.micronaut.http.annotation.Head"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "HEAD",
    mappingStyle: "combined",
  },
  {
    names: ["Options", "io.micronaut.http.annotation.Options"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "OPTIONS",
    mappingStyle: "combined",
  },
  {
    names: ["Body", "io.micronaut.http.annotation.Body"],
    role: "request-body",
  },
];

export const micronautProfile: RestFrameworkProfile = {
  id: "micronaut",
  controllerMarkerNames: ["Controller", "io.micronaut.http.annotation.Controller"],
  requiresHandlerMethods: true,
  unwrapReturnTypes: ["HttpResponse", "MutableHttpResponse", "Optional"],
  rules: [
    {
      names: ["Controller", "io.micronaut.http.annotation.Controller"],
      role: "controller-marker",
    },
    {
      names: ["Controller", "io.micronaut.http.annotation.Controller"],
      role: "class-base-path",
      pathAttribute: "value",
      mappingStyle: "combined",
    },
    ...MICRONAUT_MAPPING_ANNOTATIONS,
  ],
};
