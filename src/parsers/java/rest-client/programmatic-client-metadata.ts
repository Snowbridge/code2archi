import type { JavaCompilationUnit, JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import { isPublicJavaMethod } from "../method-api-visibility.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import { collectPayloadTypesFromMethods } from "../rest/rest-dto-collector.js";
import type { KotlinCompilationUnit, KotlinMethodDeclaration, KotlinTypeDeclaration } from "../../kotlin/kotlin-ast-model.js";
import { isPublicKotlinMethod } from "../method-api-visibility.js";
import { resolveKotlinTypeFqcn } from "../../kotlin/kotlin-type-resolver.js";

const OBJECT_FQCN = "java.lang.Object";

export function collectJavaInheritedContractTypes(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): string[] {
  const contractTypes: string[] = [];

  if (type.superClass) {
    const superFqcn = resolveTypeFqcn(
      type.superClass,
      compilationUnit.packageName,
      compilationUnit.imports,
    );
    if (superFqcn !== OBJECT_FQCN) {
      contractTypes.push(superFqcn);
    }
  }

  for (const interfaceType of type.interfaces) {
    contractTypes.push(
      resolveTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
    );
  }

  return [...contractTypes].sort();
}

export function collectJavaPublicMethodPayloadTypes(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): string[] {
  const publicMethods = type.methods.filter(isPublicJavaMethod);
  return collectPayloadTypesFromMethods(
    publicMethods,
    compilationUnit.packageName,
    compilationUnit.imports,
  );
}

export function collectKotlinInheritedContractTypes(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): string[] {
  const contractTypes: string[] = [];

  if (type.superClass) {
    const superFqcn = resolveKotlinTypeFqcn(
      type.superClass,
      compilationUnit.packageName,
      compilationUnit.imports,
    );
    if (superFqcn !== OBJECT_FQCN && superFqcn !== "kotlin.Any") {
      contractTypes.push(superFqcn);
    }
  }

  for (const interfaceType of type.interfaces) {
    contractTypes.push(
      resolveKotlinTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
    );
  }

  return [...contractTypes].sort();
}

export function collectKotlinPublicMethodPayloadTypes(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): string[] {
  const publicMethods = type.methods.filter(isPublicKotlinMethod);
  return collectPayloadTypesFromMethods(
    publicMethods.map((method) => ({
      name: method.name,
      returnType: method.returnType,
      parameters: method.parameters.map((parameter) => ({
        name: parameter.name,
        type: parameter.type,
        annotations: parameter.annotations,
      })),
      annotations: method.annotations,
      visibility: "public",
    })),
    compilationUnit.packageName,
    compilationUnit.imports,
  );
}

export function collectPayloadTypesFromJavaMethods(
  compilationUnit: JavaCompilationUnit,
  methods: readonly JavaMethodDeclaration[],
): string[] {
  return collectPayloadTypesFromMethods(
    methods,
    compilationUnit.packageName,
    compilationUnit.imports,
  );
}
