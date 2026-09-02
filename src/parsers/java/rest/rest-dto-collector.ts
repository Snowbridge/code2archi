import type { JavaMethodDeclaration, JavaTypeDeclaration, JavaTypeRef } from "../java-ast-model.js";
import {
  collectCollectionElementTypes,
  flattenTypeRefs,
  isExcludedDtoType,
  resolveTypeFqcn,
  unwrapTypeArguments,
} from "../java-type-resolver.js";
import { springMvcProfile } from "./profiles/spring-mvc-profile.js";
import type { RestAnnotationRegistry } from "./rest-annotation-registry.js";
import { methodHasMapping } from "./rest-endpoint-builder.js";

const OVERRIDE_ANNOTATION_NAMES = ["Override", "java.lang.Override"] as const;

function hasAnnotationName(
  annotations: readonly { readonly name: string; readonly qualifiedName: string }[],
  names: readonly string[],
): boolean {
  const nameSet = new Set(names);
  return annotations.some(
    (annotation) =>
      nameSet.has(annotation.name) || nameSet.has(annotation.qualifiedName),
  );
}

function isSpringRestController(type: JavaTypeDeclaration): boolean {
  return hasAnnotationName(type.annotations, [
    "RestController",
    "org.springframework.web.bind.annotation.RestController",
  ]);
}

function filterOverrideMethods(
  methods: readonly JavaMethodDeclaration[],
): JavaMethodDeclaration[] {
  return methods.filter((method) =>
    hasAnnotationName(method.annotations, OVERRIDE_ANNOTATION_NAMES),
  );
}

function collectTypesFromRef(
  typeRef: JavaTypeRef | undefined,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
  wrapperSimpleNames: ReadonlySet<string>,
  sink: Set<string>,
): void {
  const unwrapped = unwrapTypeArguments(typeRef, wrapperSimpleNames);
  if (!unwrapped) {
    return;
  }

  for (const candidate of [
  unwrapped,
  ...flattenTypeRefs(unwrapped),
  ...collectCollectionElementTypes(unwrapped),
  ]) {
    const fqcn = resolveTypeFqcn(candidate, packageName, imports);
    if (!isExcludedDtoType(fqcn, wrapperSimpleNames)) {
      sink.add(fqcn);
    }
  }
}
export function collectDtoFqcn(
  handlerMethods: readonly JavaMethodDeclaration[],
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
  registry: RestAnnotationRegistry,
): string[] {
  const dtoFqcn = new Set<string>();
  const wrapperSimpleNames = registry.getUnwrapReturnTypes();

  for (const method of handlerMethods) {
  collectTypesFromRef(
    method.returnType,
    packageName,
    imports,
    wrapperSimpleNames,
    dtoFqcn,
  );

  for (const parameter of method.parameters) {
    collectTypesFromRef(
      parameter.type,
      packageName,
      imports,
      wrapperSimpleNames,
      dtoFqcn,
    );
  }
  }

  return [...dtoFqcn].sort();
}

export function filterHandlerMethods(
  methods: readonly JavaMethodDeclaration[],
  registry: RestAnnotationRegistry,
): JavaMethodDeclaration[] {
  return methods.filter((method) => methodHasMapping(method.annotations, registry));
}

export function resolveDtoSourceMethods(
  type: JavaTypeDeclaration,
  mappingHandlerMethods: readonly JavaMethodDeclaration[],
  framework: string,
): JavaMethodDeclaration[] {
  if (mappingHandlerMethods.length > 0) {
    return [...mappingHandlerMethods];
  }

  if (framework !== springMvcProfile.id || !isSpringRestController(type) || type.interfaces.length === 0) {
    return [];
  }

  const overrideMethods = filterOverrideMethods(type.methods);
  if (overrideMethods.length > 0) {
    return overrideMethods;
  }

  return [...type.methods];
}
