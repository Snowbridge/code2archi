import type { JavaCompilationUnit, JavaTypeDeclaration } from "../java-ast-model.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";

export interface IndexedJavaType {
  readonly compilationUnit: JavaCompilationUnit;
  readonly type: JavaTypeDeclaration;
}

export class ModuleTypeIndex {
  private readonly typesByFqcn = new Map<string, IndexedJavaType>();

  addCompilationUnit(compilationUnit: JavaCompilationUnit): void {
    for (const type of this.flattenTypes(compilationUnit.types)) {
      this.typesByFqcn.set(type.fqcn, { compilationUnit, type });
    }
  }

  getType(fqcn: string): IndexedJavaType | undefined {
    return this.typesByFqcn.get(fqcn);
  }

  resolveDirectSuperFqcn(
    compilationUnit: JavaCompilationUnit,
    type: JavaTypeDeclaration,
  ): string[] {
    const supers: string[] = [];

    if (type.superClass) {
      const superFqcn = resolveTypeFqcn(
        type.superClass,
        compilationUnit.packageName,
        compilationUnit.imports,
      );
      if (superFqcn && superFqcn !== "java.lang.Object") {
        supers.push(superFqcn);
      }
    }

    for (const interfaceType of type.interfaces) {
      supers.push(
        resolveTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
      );
    }

    return supers;
  }

  collectInheritedTypes(
    compilationUnit: JavaCompilationUnit,
    type: JavaTypeDeclaration,
  ): IndexedJavaType[] {
    const visited = new Set<string>();
    const queue = [...this.resolveDirectSuperFqcn(compilationUnit, type)];
    const inherited: IndexedJavaType[] = [];

    while (queue.length > 0) {
      const fqcn = queue.shift();
      if (!fqcn || visited.has(fqcn)) {
        continue;
      }
      visited.add(fqcn);

      const indexed = this.getType(fqcn);
      if (!indexed) {
        continue;
      }

      inherited.push(indexed);
      queue.push(...this.resolveDirectSuperFqcn(indexed.compilationUnit, indexed.type));
    }

    return inherited;
  }

  private flattenTypes(types: readonly JavaTypeDeclaration[]): JavaTypeDeclaration[] {
    const flattened: JavaTypeDeclaration[] = [];
    for (const type of types) {
      flattened.push(type);
      flattened.push(...this.flattenTypes(type.nestedTypes));
    }
    return flattened;
  }
}
