import type { ClientAnnotationRule, RestClientFrameworkProfile } from "../rest-client-framework-profile.js";

const SPRING_CLIENT_MAPPING_ANNOTATIONS: ClientAnnotationRule[] = [
  {
    names: ["RequestMapping", "org.springframework.web.bind.annotation.RequestMapping"],
    role: "class-base-path",
    pathAttribute: "value",
    mappingStyle: "combined",
  },
  {
    names: ["RequestMapping", "org.springframework.web.bind.annotation.RequestMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    mappingStyle: "combined",
  },
  {
    names: ["GetMapping", "org.springframework.web.bind.annotation.GetMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "GET",
    mappingStyle: "combined",
  },
  {
    names: ["PostMapping", "org.springframework.web.bind.annotation.PostMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "POST",
    mappingStyle: "combined",
  },
  {
    names: ["PutMapping", "org.springframework.web.bind.annotation.PutMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "PUT",
    mappingStyle: "combined",
  },
  {
    names: ["PatchMapping", "org.springframework.web.bind.annotation.PatchMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "PATCH",
    mappingStyle: "combined",
  },
  {
    names: ["DeleteMapping", "org.springframework.web.bind.annotation.DeleteMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "DELETE",
    mappingStyle: "combined",
  },
  {
    names: ["HeadMapping", "org.springframework.web.bind.annotation.HeadMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "HEAD",
    mappingStyle: "combined",
  },
  {
    names: ["OptionsMapping", "org.springframework.web.bind.annotation.OptionsMapping"],
    role: "method-mapping",
    pathAttribute: "value",
    httpMethod: "OPTIONS",
    mappingStyle: "combined",
  },
  {
    names: ["RequestBody", "org.springframework.web.bind.annotation.RequestBody"],
    role: "request-body",
  },
];

export const springFeignProfile: RestClientFrameworkProfile = {
  id: "feign",
  clientMarkerNames: ["FeignClient", "org.springframework.cloud.openfeign.FeignClient"],
  unwrapReturnTypes: [
    "ResponseEntity",
    "HttpEntity",
    "Mono",
    "Flux",
    "Publisher",
    "Optional",
  ],
  rules: [
    {
      names: ["FeignClient", "org.springframework.cloud.openfeign.FeignClient"],
      role: "client-marker",
    },
    ...SPRING_CLIENT_MAPPING_ANNOTATIONS,
  ],
};
