import type { JavaCompilationUnit, JavaMethodDeclaration, JavaTypeDeclaration } from "../java/java-ast-model.js";
import { extractRestControllers, type ParsedRestController } from "../java/rest/rest-controller-extractor.js";
import type { KotlinCompilationUnit, KotlinTypeDeclaration } from "./kotlin-ast-model.js";

function adaptMethod(method: KotlinTypeDeclaration["methods"][number]): JavaMethodDeclaration {
  return {
    name: method.name,
    returnType: method.returnType,
    parameters: method.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      annotations: parameter.annotations,
    })),
    annotations: method.annotations,
    isSuspend: method.isSuspend,
  };
}

function adaptType(type: KotlinTypeDeclaration): JavaTypeDeclaration {
  return {
    name: type.name,
    fqcn: type.fqcn,
    annotations: type.annotations,
    superClass: type.superClass,
    interfaces: type.interfaces,
    methods: type.methods.map(adaptMethod),
    fields: [],
    nestedTypes: type.nestedTypes.map(adaptType),
  };
}

export function adaptKotlinCompilationUnitToJava(
  compilationUnit: KotlinCompilationUnit,
): JavaCompilationUnit {
  return {
    packageName: compilationUnit.packageName,
    imports: compilationUnit.imports,
    types: compilationUnit.types.map(adaptType),
  };
}

export function extractKotlinRestControllers(
  compilationUnit: KotlinCompilationUnit,
): ParsedRestController[] {
  return extractRestControllers(adaptKotlinCompilationUnitToJava(compilationUnit));
}
