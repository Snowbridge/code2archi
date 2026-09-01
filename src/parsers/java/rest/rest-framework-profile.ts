export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type AnnotationRole =
  | "controller-marker"
  | "class-base-path"
  | "method-mapping"
  | "http-verb"
  | "request-body";

export type MappingStyle = "combined" | "split";

export interface AnnotationRule {
  readonly names: readonly string[];
  readonly role: AnnotationRole;
  readonly pathAttribute?: "value" | "path" | "uri";
  readonly httpMethod?: HttpMethod;
  readonly mappingStyle?: MappingStyle;
}

export interface RestFrameworkProfile {
  readonly id: string;
  readonly rules: readonly AnnotationRule[];
  readonly unwrapReturnTypes: readonly string[];
  readonly requiresHandlerMethods?: boolean;
  readonly controllerMarkerNames: readonly string[];
  readonly usesPathAsMarker?: boolean;
}

export const ALL_HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
