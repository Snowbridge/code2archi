export type JavaKotlinImportKind = "type" | "wildcard";

export interface JavaKotlinImport {
  readonly kind: JavaKotlinImportKind;
  readonly qualifiedName: string;
  readonly alias?: string;
}

export interface JvmImportContext {
  readonly packageName: string;
  readonly imports: readonly JavaKotlinImport[];
}

export interface EsmImportBinding {
  readonly literalName: string;
  readonly fullImportLine: string;
}

export interface CjsImportBinding {
  readonly literalName: string;
  readonly fullImportLine: string;
}
