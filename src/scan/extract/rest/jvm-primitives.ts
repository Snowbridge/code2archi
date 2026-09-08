const JVM_PRIMITIVE_AND_EXCLUDED = new Set([
  "void",
  "boolean",
  "byte",
  "short",
  "int",
  "long",
  "float",
  "double",
  "char",
  "Boolean",
  "Byte",
  "Short",
  "Integer",
  "Long",
  "Float",
  "Double",
  "Character",
  "String",
  "CharSequence",
  "Object",
  "Void",
  "Unit",
  "Any",
  "Nothing",
  "Optional",
  "byte[]",
  "ByteArray",
]);

export function isJvmPrimitiveOrExcluded(typeName: string): boolean {
  const trimmed = typeName.trim();
  if (trimmed.length === 0) {
    return true;
  }

  const simpleName = trimmed.includes(".")
    ? trimmed.slice(trimmed.lastIndexOf(".") + 1)
    : trimmed.replace(/<.*>/, "").replace(/\[\]$/, "");

  if (JVM_PRIMITIVE_AND_EXCLUDED.has(simpleName)) {
    return true;
  }

  if (trimmed.startsWith("java.lang.")) {
    return true;
  }

  if (trimmed.startsWith("kotlin.")) {
    return true;
  }

  if (trimmed.startsWith("javax.servlet.") || trimmed.startsWith("jakarta.servlet.")) {
    return true;
  }

  return false;
}
