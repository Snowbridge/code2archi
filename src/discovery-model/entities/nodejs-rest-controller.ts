import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";
import type { TcpStackType } from "../../parsers/java/rest/rest-tcp-stack-type.js";

export type { TcpStackType };

export type NodejsProgrammingModel = "DECLARATIVE" | "FUNCTIONAL" | "CONVENTION_BASED";

export type NodejsServerFramework =
  | "express"
  | "fastify"
  | "hono"
  | "koa"
  | "nestjs"
  | "nextjs-app-router";

export interface NodejsRestControllerCreateIntent {
  readonly id: string;
  readonly applicationModuleId: string;
  readonly name: string;
  readonly qualifiedSymbol: string;
  readonly dtoTypes: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly programmingModel: NodejsProgrammingModel;
  readonly serverFramework: NodejsServerFramework;
  readonly extendsTypeName?: string;
  readonly implementsTypeNames: readonly string[];
  readonly sourceFile: string;
}

export interface NodejsRestControllerNaturalKeys {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly qualifiedSymbol: string;
  readonly dtoTypes: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly programmingModel: NodejsProgrammingModel;
  readonly serverFramework: NodejsServerFramework;
  readonly extendsTypeName?: string;
  readonly implementsTypeNames: readonly string[];
  readonly sourceFile: string;
}

export class NodejsRestController extends Entity {
  private static readonly ENTITY_TYPE = "NodejsRestController" as const;

  readonly applicationModuleId: string;
  readonly name: string;
  readonly qualifiedSymbol: string;
  readonly dtoTypes: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly programmingModel: NodejsProgrammingModel;
  readonly serverFramework: NodejsServerFramework;
  readonly extendsTypeName?: string;
  readonly implementsTypeNames: readonly string[];
  readonly sourceFile: string;

  constructor(naturalKeys: NodejsRestControllerNaturalKeys) {
    super(NodejsRestController.ENTITY_TYPE, [
      naturalKeys.applicationModuleId,
      naturalKeys.qualifiedSymbol,
    ]);
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.name = naturalKeys.name;
    this.qualifiedSymbol = naturalKeys.qualifiedSymbol;
    this.dtoTypes = naturalKeys.dtoTypes;
    this.endpoints = naturalKeys.endpoints;
    this.tcpStackType = naturalKeys.tcpStackType;
    this.programmingModel = naturalKeys.programmingModel;
    this.serverFramework = naturalKeys.serverFramework;
    this.implementsTypeNames = naturalKeys.implementsTypeNames;
    this.sourceFile = naturalKeys.sourceFile;
    if (naturalKeys.extendsTypeName !== undefined) {
      this.extendsTypeName = naturalKeys.extendsTypeName;
    }
  }

  toCreateIntent(): NodejsRestControllerCreateIntent {
    return {
      id: this.id,
      applicationModuleId: this.applicationModuleId,
      name: this.name,
      qualifiedSymbol: this.qualifiedSymbol,
      dtoTypes: this.dtoTypes,
      endpoints: this.endpoints,
      tcpStackType: this.tcpStackType,
      programmingModel: this.programmingModel,
      serverFramework: this.serverFramework,
      implementsTypeNames: this.implementsTypeNames,
      sourceFile: this.sourceFile,
      ...(this.extendsTypeName !== undefined ? { extendsTypeName: this.extendsTypeName } : {}),
    };
  }
}

export interface NodejsRestControllerRecord
  extends DiscoveryEntityBase,
    NodejsRestControllerCreateIntent {}
