import type { SyntaxNode } from "tree-sitter";
import type { JavaAnnotation, JavaTypeRef } from "../java/java-ast-model.js";

export interface KotlinParameter {
  readonly name?: string;
  readonly type: JavaTypeRef;
  readonly annotations: readonly JavaAnnotation[];
}

export interface KotlinMethodDeclaration {
  readonly name: string;
  readonly returnType?: JavaTypeRef;
  readonly parameters: readonly KotlinParameter[];
  readonly annotations: readonly JavaAnnotation[];
  readonly isSuspend: boolean;
  readonly receiverType?: JavaTypeRef;
  readonly body?: SyntaxNode;
  readonly isTopLevel?: boolean;
  readonly enclosingTypeFqcn?: string;
}

export interface KotlinPropertyDeclaration {
  readonly name: string;
  readonly type?: JavaTypeRef;
  readonly annotations: readonly JavaAnnotation[];
  readonly initializer?: SyntaxNode;
}

export interface KotlinFunctionDeclaration extends KotlinMethodDeclaration {
  readonly isTopLevel: boolean;
}

export interface KotlinTypeDeclaration {
  readonly name: string;
  readonly fqcn: string;
  readonly annotations: readonly JavaAnnotation[];
  readonly superClass?: JavaTypeRef;
  readonly interfaces: readonly JavaTypeRef[];
  readonly methods: readonly KotlinMethodDeclaration[];
  readonly properties: readonly KotlinPropertyDeclaration[];
  readonly nestedTypes: readonly KotlinTypeDeclaration[];
}

export interface KotlinCompilationUnit {
  readonly packageName?: string;
  readonly imports: ReadonlyMap<string, string>;
  readonly fileBaseName: string;
  readonly types: readonly KotlinTypeDeclaration[];
  readonly topLevelFunctions: readonly KotlinFunctionDeclaration[];
  readonly topLevelProperties: readonly KotlinPropertyDeclaration[];
}
