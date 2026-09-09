import type { JvmTypeModel } from "../../../parsers/jvm/types.js";
import { annotationMatches } from "../../../parsers/jvm/extract-jvm-file.js";

const REGISTER_REST_CLIENT = "RegisterRestClient";

export function isMicroProfileRestClient(type: JvmTypeModel): boolean {
  return type.annotations.some((annotation) => annotationMatches(annotation, REGISTER_REST_CLIENT));
}
