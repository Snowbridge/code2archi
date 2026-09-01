import type { AnnotationRule, RestFrameworkProfile } from "../rest-framework-profile.js";

const SPRING_MAPPING_ANNOTATIONS: AnnotationRule[] = [
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

export const springMvcProfile: RestFrameworkProfile = {
  id: "spring-mvc",
  controllerMarkerNames: [
    "RestController",
    "org.springframework.web.bind.annotation.RestController",
    "Controller",
    "org.springframework.web.bind.annotation.Controller",
  ],
  requiresHandlerMethods: true,
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
      names: ["RestController", "org.springframework.web.bind.annotation.RestController"],
      role: "controller-marker",
    },
    {
      names: ["Controller", "org.springframework.web.bind.annotation.Controller"],
      role: "controller-marker",
    },
    ...SPRING_MAPPING_ANNOTATIONS,
  ],
};
