import type { ClientAnnotationRule, RestClientFrameworkProfile } from "../rest-client-framework-profile.js";

const HTTP_EXCHANGE_ANNOTATIONS: ClientAnnotationRule[] = [
  {
    names: ["HttpExchange", "org.springframework.web.service.annotation.HttpExchange"],
    role: "class-base-path",
    pathAttribute: "value",
    mappingStyle: "combined",
  },
  {
    names: ["GetExchange", "org.springframework.web.service.annotation.GetExchange"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "GET",
    mappingStyle: "combined",
  },
  {
    names: ["PostExchange", "org.springframework.web.service.annotation.PostExchange"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "POST",
    mappingStyle: "combined",
  },
  {
    names: ["PutExchange", "org.springframework.web.service.annotation.PutExchange"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "PUT",
    mappingStyle: "combined",
  },
  {
    names: ["PatchExchange", "org.springframework.web.service.annotation.PatchExchange"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "PATCH",
    mappingStyle: "combined",
  },
  {
    names: ["DeleteExchange", "org.springframework.web.service.annotation.DeleteExchange"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "DELETE",
    mappingStyle: "combined",
  },
];

export const springHttpExchangeProfile: RestClientFrameworkProfile = {
  id: "http-exchange",
  clientMarkerNames: ["HttpExchange", "org.springframework.web.service.annotation.HttpExchange"],
  unwrapReturnTypes: ["ResponseEntity", "HttpEntity", "Mono", "Flux", "Optional"],
  rules: [
    {
      names: ["HttpExchange", "org.springframework.web.service.annotation.HttpExchange"],
      role: "client-marker",
    },
    ...HTTP_EXCHANGE_ANNOTATIONS,
  ],
};
