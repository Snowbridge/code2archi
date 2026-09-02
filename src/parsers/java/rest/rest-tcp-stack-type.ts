import type { JavaMethodDeclaration, JavaTypeRef } from "../java-ast-model.js";

export type TcpStackType = "BLOCKING" | "NON_BLOCKING";

const NON_BLOCKING_RETURN_TYPES = new Set(["Mono", "Flux", "Uni", "Multi"]);

function returnTypeContainsNonBlockingWrapper(typeRef: JavaTypeRef | undefined): boolean {
  if (!typeRef) {
    return false;
  }

  if (NON_BLOCKING_RETURN_TYPES.has(typeRef.simpleName)) {
    return true;
  }

  return typeRef.typeArguments.some(returnTypeContainsNonBlockingWrapper);
}

export function resolveTcpStackType(
  handlerMethods: readonly JavaMethodDeclaration[],
): TcpStackType {
  for (const method of handlerMethods) {
    if (method.isSuspend) {
      return "NON_BLOCKING";
    }
  }

  for (const method of handlerMethods) {
    if (returnTypeContainsNonBlockingWrapper(method.returnType)) {
      return "NON_BLOCKING";
    }
  }

  return "BLOCKING";
}
