import type { HttpMethod } from "../rest/rest-framework-profile.js";

export type ClientAnnotationRole =
  | "client-marker"
  | "class-base-path"
  | "method-mapping"
  | "http-verb"
  | "request-body";

export type MappingStyle = "combined" | "split";

export interface ClientAnnotationRule {
  readonly names: readonly string[];
  readonly role: ClientAnnotationRole;
  readonly pathAttribute?: "value" | "path" | "uri";
  readonly httpMethod?: HttpMethod;
  readonly mappingStyle?: MappingStyle;
}

export interface RestClientFrameworkProfile {
  readonly id: string;
  readonly rules: readonly ClientAnnotationRule[];
  readonly unwrapReturnTypes: readonly string[];
  readonly clientMarkerNames: readonly string[];
}
