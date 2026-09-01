import type { JavaAnnotation } from "../java-ast-model.js";
import { jaxRsProfile } from "./profiles/jax-rs-profile.js";
import { micronautProfile } from "./profiles/micronaut-profile.js";
import { springMvcProfile } from "./profiles/spring-mvc-profile.js";
import type { AnnotationRole, AnnotationRule, RestFrameworkProfile } from "./rest-framework-profile.js";

export const DEFAULT_REST_PROFILES: readonly RestFrameworkProfile[] = [
  springMvcProfile,
  jaxRsProfile,
  micronautProfile,
];

function annotationKeys(annotation: JavaAnnotation): string[] {
  return [annotation.name, annotation.qualifiedName];
}

export class RestAnnotationRegistry {
  private readonly rulesByKey = new Map<string, AnnotationRule[]>();
  private readonly profiles: readonly RestFrameworkProfile[];

  constructor(profiles: readonly RestFrameworkProfile[] = DEFAULT_REST_PROFILES) {
    this.profiles = profiles;
    for (const profile of profiles) {
      for (const rule of profile.rules) {
        for (const name of rule.names) {
          const existing = this.rulesByKey.get(name) ?? [];
          existing.push(rule);
          this.rulesByKey.set(name, existing);
        }
      }
    }
  }

  getProfiles(): readonly RestFrameworkProfile[] {
    return this.profiles;
  }

  lookupRules(annotation: JavaAnnotation): AnnotationRule[] {
    const rules: AnnotationRule[] = [];
    for (const key of annotationKeys(annotation)) {
      const matched = this.rulesByKey.get(key);
      if (matched) {
        rules.push(...matched);
      }
    }
    return rules;
  }

  lookupRulesByRole(annotation: JavaAnnotation, role: AnnotationRole): AnnotationRule[] {
    return this.lookupRules(annotation).filter((rule) => rule.role === role);
  }

  getUnwrapReturnTypes(): Set<string> {
    const wrappers = new Set<string>();
    for (const profile of this.profiles) {
      for (const wrapper of profile.unwrapReturnTypes) {
        wrappers.add(wrapper);
      }
    }
    return wrappers;
  }
}

export function createDefaultRestAnnotationRegistry(): RestAnnotationRegistry {
  return new RestAnnotationRegistry(DEFAULT_REST_PROFILES);
}
