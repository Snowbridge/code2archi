import type { ClientAnnotationRule, RestClientFrameworkProfile } from "../rest-client-framework-profile.js";

const RETROFIT_HTTP_VERBS: ClientAnnotationRule[] = [
  {
    names: ["GET", "retrofit2.http.GET"],
    role: "http-verb",
    httpMethod: "GET",
    mappingStyle: "split",
  },
  {
    names: ["POST", "retrofit2.http.POST"],
    role: "http-verb",
    httpMethod: "POST",
    mappingStyle: "split",
  },
  {
    names: ["PUT", "retrofit2.http.PUT"],
    role: "http-verb",
    httpMethod: "PUT",
    mappingStyle: "split",
  },
  {
    names: ["PATCH", "retrofit2.http.PATCH"],
    role: "http-verb",
    httpMethod: "PATCH",
    mappingStyle: "split",
  },
  {
    names: ["DELETE", "retrofit2.http.DELETE"],
    role: "http-verb",
    httpMethod: "DELETE",
    mappingStyle: "split",
  },
  {
    names: ["HEAD", "retrofit2.http.HEAD"],
    role: "http-verb",
    httpMethod: "HEAD",
    mappingStyle: "split",
  },
  {
    names: ["OPTIONS", "retrofit2.http.OPTIONS"],
    role: "http-verb",
    httpMethod: "OPTIONS",
    mappingStyle: "split",
  },
  {
    names: ["Path", "retrofit2.http.Path"],
    role: "class-base-path",
    pathAttribute: "value",
    mappingStyle: "split",
  },
  {
    names: ["Path", "retrofit2.http.Path"],
    role: "method-mapping",
    pathAttribute: "value",
    mappingStyle: "split",
  },
];

export const retrofitProfile: RestClientFrameworkProfile = {
  id: "retrofit",
  clientMarkerNames: [],
  unwrapReturnTypes: ["Call", "Response", "Optional"],
  rules: [...RETROFIT_HTTP_VERBS],
};
