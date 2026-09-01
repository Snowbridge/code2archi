import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface RestControllerCreateIntent {
  readonly id: string;
  readonly applicationModuleId: string;
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly baseClassFqcn?: string;
  readonly implementedInterfaceFqcn: readonly string[];
  readonly sourceFile: string;
}

export interface RestControllerNaturalKeys {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly baseClassFqcn?: string;
  readonly implementedInterfaceFqcn: readonly string[];
  readonly sourceFile: string;
}

export class RestController extends Entity {
  private static readonly ENTITY_TYPE = "RestController" as const;

  readonly applicationModuleId: string;
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly baseClassFqcn?: string;
  readonly implementedInterfaceFqcn: readonly string[];
  readonly sourceFile: string;

  constructor(naturalKeys: RestControllerNaturalKeys) {
    super(RestController.ENTITY_TYPE, [
      naturalKeys.applicationModuleId,
      naturalKeys.fqcn,
    ]);
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.name = naturalKeys.name;
    this.fqcn = naturalKeys.fqcn;
    this.dtoFqcn = naturalKeys.dtoFqcn;
    this.endpoints = naturalKeys.endpoints;
    this.implementedInterfaceFqcn = naturalKeys.implementedInterfaceFqcn;
    this.sourceFile = naturalKeys.sourceFile;
    if (naturalKeys.baseClassFqcn !== undefined) {
      this.baseClassFqcn = naturalKeys.baseClassFqcn;
    }
  }

  toCreateIntent(): RestControllerCreateIntent {
    return {
      id: this.id,
      applicationModuleId: this.applicationModuleId,
      name: this.name,
      fqcn: this.fqcn,
      dtoFqcn: this.dtoFqcn,
      endpoints: this.endpoints,
      implementedInterfaceFqcn: this.implementedInterfaceFqcn,
      sourceFile: this.sourceFile,
      ...(this.baseClassFqcn !== undefined ? { baseClassFqcn: this.baseClassFqcn } : {}),
    };
  }
}

export interface RestControllerRecord extends DiscoveryEntityBase, RestControllerCreateIntent {}
