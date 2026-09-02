import type { JavaAnnotation, JavaTypeRef } from "../java/java-ast-model.js";

export interface KotlinMethodDeclaration {
  readonly name: string;
  readonly returnType?: JavaTypeRef;
  readonly parameters: readonly KotlinParameter[];
  readonly annotations: readonly JavaAnnotation[];
  readonly isSuspend: boolean;
}

export interface KotlinParameter {
  readonly name?: string;
  readonly type: JavaTypeRef;
  readonly annotations: readonly JavaAnnotation[];
}

export interface KotlinTypeDeclaration {
  readonly name: string;
  readonly fqcn: string;
  readonly annotations: readonly JavaAnnotation[];
  readonly superClass?: JavaTypeRef;
  readonly interfaces: readonly JavaTypeRef[];
  readonly methods: readonly KotlinMethodDeclaration[];
  readonly nestedTypes: readonly KotlinTypeDeclaration[];
}

export interface KotlinCompilationUnit {
  readonly packageName?: string;
  readonly imports: ReadonlyMap<string, string>;
  readonly types: readonly KotlinTypeDeclaration[];
}
