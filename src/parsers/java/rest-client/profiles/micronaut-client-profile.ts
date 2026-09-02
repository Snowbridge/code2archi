import type { ClientAnnotationRule, RestClientFrameworkProfile } from "../rest-client-framework-profile.js";

const MICRONAUT_CLIENT_MAPPING: ClientAnnotationRule[] = [
  {
    names: ["Client", "io.micronaut.http.client.annotation.Client"],
    role: "class-base-path",
    pathAttribute: "value",
    mappingStyle: "combined",
  },
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
    names: ["Delete", "io.micronaut.http.annotation.Delete"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "DELETE",
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

export const micronautClientProfile: RestClientFrameworkProfile = {
  id: "micronaut-client",
  clientMarkerNames: ["Client", "io.micronaut.http.client.annotation.Client"],
  unwrapReturnTypes: ["HttpResponse", "MutableHttpResponse", "Optional"],
  rules: [
    {
      names: ["Client", "io.micronaut.http.client.annotation.Client"],
      role: "client-marker",
    },
    ...MICRONAUT_CLIENT_MAPPING,
  ],
};
