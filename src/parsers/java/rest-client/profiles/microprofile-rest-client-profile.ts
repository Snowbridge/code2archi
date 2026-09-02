import type { AnnotationRule } from "../../rest/rest-framework-profile.js";
import { jaxRsProfile } from "../../rest/profiles/jax-rs-profile.js";
import type { ClientAnnotationRule, RestClientFrameworkProfile } from "../rest-client-framework-profile.js";

const MP_REST_MAPPING_RULES: ClientAnnotationRule[] = jaxRsProfile.rules
  .filter((rule) => rule.role !== "controller-marker")
  .map((rule) => ({ ...rule, role: rule.role as ClientAnnotationRule["role"] }));

export const microprofileRestClientProfile: RestClientFrameworkProfile = {
  id: "mp-rest-client",
  clientMarkerNames: [
    "RegisterRestClient",
    "org.eclipse.microprofile.rest.client.inject.RegisterRestClient",
  ],
  unwrapReturnTypes: jaxRsProfile.unwrapReturnTypes,
  rules: [
    {
      names: [
        "RegisterRestClient",
        "org.eclipse.microprofile.rest.client.inject.RegisterRestClient",
      ],
      role: "client-marker",
    },
    ...MP_REST_MAPPING_RULES,
  ],
};
