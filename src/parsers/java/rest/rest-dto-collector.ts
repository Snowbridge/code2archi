import type { JavaAnnotation, JavaMethodDeclaration, JavaTypeRef } from "../java-ast-model.js";
import {
  collectCollectionElementTypes,
  flattenTypeRefs,
  isExcludedDtoType,
  resolveTypeFqcn,
  unwrapTypeArguments,
} from "../java-type-resolver.js";
import type { RestAnnotationRegistry } from "./rest-annotation-registry.js";
import { methodHasMapping } from "./rest-endpoint-builder.js";

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

function parameterIsRequestBody(
  annotations: readonly JavaAnnotation[],
  registry: RestAnnotationRegistry,
): boolean {
  return annotations.some(
    (annotation) => registry.lookupRulesByRole(annotation, "request-body").length > 0,
  );
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
    if (parameterIsRequestBody(parameter.annotations, registry)) {
      collectTypesFromRef(
        parameter.type,
        packageName,
        imports,
        wrapperSimpleNames,
        dtoFqcn,
      );
    }
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
