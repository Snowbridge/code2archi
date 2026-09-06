export type { ConcurrencyModel, TcpStackType } from "../../../code-inventory/entities/http-api-concurrency-model.js";

import type { ConcurrencyModel } from "../../../code-inventory/entities/http-api-concurrency-model.js";
import type { JavaMethodDeclaration, JavaTypeRef } from "../java-ast-model.js";

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

export function resolveConcurrencyModel(
  handlerMethods: readonly JavaMethodDeclaration[],
): ConcurrencyModel {
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

/** @deprecated Use resolveConcurrencyModel */
export const resolveTcpStackType = resolveConcurrencyModel;
