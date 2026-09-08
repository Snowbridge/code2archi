import path from "node:path";

const PRODUCTION_SOURCE_SEGMENT = "/src/main/";

export function isProductionJvmSourcePath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized.includes(PRODUCTION_SOURCE_SEGMENT);
}

export function isJvmSourceFile(fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".java" || extension === ".kt" || extension === ".kts";
}

export function productionSourceRelativePath(absolutePath: string, repositoryRoot: string): string {
  return path.relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
}
