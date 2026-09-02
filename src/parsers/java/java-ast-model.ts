import type { GenericCstNode } from "./java-cst-utils.js";

export interface JavaAnnotation {
  readonly name: string;
  readonly qualifiedName: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
}

export interface JavaTypeRef {
  readonly raw: string;
  readonly simpleName: string;
  readonly typeArguments: readonly JavaTypeRef[];
}

export interface JavaParameter {
  readonly name?: string;
  readonly type: JavaTypeRef;
  readonly annotations: readonly JavaAnnotation[];
}

export interface JavaMethodDeclaration {
  readonly name: string;
  readonly returnType?: JavaTypeRef;
  readonly parameters: readonly JavaParameter[];
  readonly annotations: readonly JavaAnnotation[];
  readonly body?: GenericCstNode;
  readonly isSuspend?: boolean;
}

export interface JavaTypeDeclaration {
  readonly name: string;
  readonly fqcn: string;
  readonly annotations: readonly JavaAnnotation[];
  readonly superClass?: JavaTypeRef;
  readonly interfaces: readonly JavaTypeRef[];
  readonly methods: readonly JavaMethodDeclaration[];
  readonly nestedTypes: readonly JavaTypeDeclaration[];
}

export interface JavaCompilationUnit {
  readonly packageName?: string;
  readonly imports: ReadonlyMap<string, string>;
  readonly types: readonly JavaTypeDeclaration[];
}
