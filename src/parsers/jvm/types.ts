export interface JvmAnnotation {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
}

export interface JvmMethodModel {
  readonly name: string;
  readonly annotations: readonly JvmAnnotation[];
  readonly parameterTypes: readonly string[];
  readonly returnType: string;
}

export interface JvmTypeModel {
  readonly simpleName: string;
  readonly fqcn: string;
  readonly annotations: readonly JvmAnnotation[];
  readonly implementedInterfaces: readonly string[];
  readonly methods: readonly JvmMethodModel[];
}

export interface JvmFileModel {
  readonly packageName: string;
  readonly types: readonly JvmTypeModel[];
}
