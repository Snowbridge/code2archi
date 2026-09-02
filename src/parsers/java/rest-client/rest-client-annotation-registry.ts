import type { JavaAnnotation } from "../java-ast-model.js";
import type { AnnotationRule } from "../rest/rest-framework-profile.js";
import { RestAnnotationRegistry } from "../rest/rest-annotation-registry.js";
import { microprofileRestClientProfile } from "./profiles/microprofile-rest-client-profile.js";
import { micronautClientProfile } from "./profiles/micronaut-client-profile.js";
import { retrofitProfile } from "./profiles/retrofit-profile.js";
import { springFeignProfile } from "./profiles/spring-feign-profile.js";
import { springHttpExchangeProfile } from "./profiles/spring-http-exchange-profile.js";
import type {
  ClientAnnotationRule,
  RestClientFrameworkProfile,
} from "./rest-client-framework-profile.js";

export const DEFAULT_REST_CLIENT_PROFILES: readonly RestClientFrameworkProfile[] = [
  springFeignProfile,
  springHttpExchangeProfile,
  microprofileRestClientProfile,
  micronautClientProfile,
  retrofitProfile,
];

function toMappingRules(rules: readonly ClientAnnotationRule[]): AnnotationRule[] {
  return rules
    .filter((rule) => rule.role !== "client-marker")
    .map((rule) => ({
      names: rule.names,
      role: rule.role,
      ...(rule.pathAttribute ? { pathAttribute: rule.pathAttribute } : {}),
      ...(rule.httpMethod ? { httpMethod: rule.httpMethod } : {}),
      ...(rule.mappingStyle ? { mappingStyle: rule.mappingStyle } : {}),
    })) as AnnotationRule[];
}

export class RestClientProfileBundle {
  readonly profiles: readonly RestClientFrameworkProfile[];
  readonly mappingRegistry: RestAnnotationRegistry;

  constructor(profiles: readonly RestClientFrameworkProfile[] = DEFAULT_REST_CLIENT_PROFILES) {
    this.profiles = profiles;
    const mappingRules = profiles.flatMap((profile) => toMappingRules(profile.rules));
    this.mappingRegistry = new RestAnnotationRegistry(
      profiles.map((profile) => ({
        id: profile.id,
        controllerMarkerNames: profile.clientMarkerNames,
        unwrapReturnTypes: profile.unwrapReturnTypes,
        rules: toMappingRules(profile.rules),
      })),
    );
    void mappingRules;
  }

  detectProfile(
    annotations: readonly { readonly name: string; readonly qualifiedName: string }[],
  ): RestClientFrameworkProfile | undefined {
    for (const profile of this.profiles) {
      if (profile.clientMarkerNames.length > 0) {
        const hasMarker = annotations.some((annotation) =>
          profile.clientMarkerNames.some(
            (name) => name === annotation.name || name === annotation.qualifiedName,
          ),
        );
        if (hasMarker) {
          return profile;
        }
      }
    }
    return undefined;
  }

  detectRetrofitInterface(type: {
    readonly methods: readonly { readonly annotations: readonly JavaAnnotation[] }[];
  }): RestClientFrameworkProfile | undefined {
    const hasRetrofitMapping = type.methods.some((method) =>
      method.annotations.some((annotation) =>
        retrofitProfile.rules.some((rule) =>
          rule.names.some(
            (name) => name === annotation.name || name === annotation.qualifiedName,
          ),
        ),
      ),
    );
    return hasRetrofitMapping ? retrofitProfile : undefined;
  }
}

export function createDefaultRestClientProfileBundle(): RestClientProfileBundle {
  return new RestClientProfileBundle();
}
