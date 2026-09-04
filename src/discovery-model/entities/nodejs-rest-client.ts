import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";
import type { TcpStackType } from "../../parsers/java/rest/rest-tcp-stack-type.js";

export type { TcpStackType };

export type NodejsDiscoveryStyle = "DECLARATIVE" | "PROGRAMMATIC";

export type NodejsClientFramework =
  | "axios"
  | "fetch"
  | "undici"
  | "got"
  | "node-http"
  | "superagent"
  | "nestjs-axios";

export interface NodejsRestClientCreateIntent {
  readonly id: string;
  readonly applicationModuleId: string;
  readonly name: string;
  readonly qualifiedSymbol: string;
  readonly dtoTypes: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly discoveryStyle: NodejsDiscoveryStyle;
  readonly clientFramework: NodejsClientFramework;
  readonly extendsTypeNames: readonly string[];
  readonly sourceFile: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export interface NodejsRestClientNaturalKeys {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly qualifiedSymbol: string;
  readonly dtoTypes: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly discoveryStyle: NodejsDiscoveryStyle;
  readonly clientFramework: NodejsClientFramework;
  readonly extendsTypeNames: readonly string[];
  readonly sourceFile: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export class NodejsRestClient extends Entity {
  private static readonly ENTITY_TYPE = "NodejsRestClient" as const;

  readonly applicationModuleId: string;
  readonly name: string;
  readonly qualifiedSymbol: string;
  readonly dtoTypes: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly discoveryStyle: NodejsDiscoveryStyle;
  readonly clientFramework: NodejsClientFramework;
  readonly extendsTypeNames: readonly string[];
  readonly sourceFile: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;

  constructor(naturalKeys: NodejsRestClientNaturalKeys) {
    super(NodejsRestClient.ENTITY_TYPE, [
      naturalKeys.applicationModuleId,
      naturalKeys.qualifiedSymbol,
    ]);
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.name = naturalKeys.name;
    this.qualifiedSymbol = naturalKeys.qualifiedSymbol;
    this.dtoTypes = naturalKeys.dtoTypes;
    this.endpoints = naturalKeys.endpoints;
    this.tcpStackType = naturalKeys.tcpStackType;
    this.discoveryStyle = naturalKeys.discoveryStyle;
    this.clientFramework = naturalKeys.clientFramework;
    this.extendsTypeNames = naturalKeys.extendsTypeNames;
    this.sourceFile = naturalKeys.sourceFile;
    if (naturalKeys.serviceName !== undefined) {
      this.serviceName = naturalKeys.serviceName;
    }
    if (naturalKeys.baseUrl !== undefined) {
      this.baseUrl = naturalKeys.baseUrl;
    }
  }

  toCreateIntent(): NodejsRestClientCreateIntent {
    return {
      id: this.id,
      applicationModuleId: this.applicationModuleId,
      name: this.name,
      qualifiedSymbol: this.qualifiedSymbol,
      dtoTypes: this.dtoTypes,
      endpoints: this.endpoints,
      tcpStackType: this.tcpStackType,
      discoveryStyle: this.discoveryStyle,
      clientFramework: this.clientFramework,
      extendsTypeNames: this.extendsTypeNames,
      sourceFile: this.sourceFile,
      ...(this.serviceName !== undefined ? { serviceName: this.serviceName } : {}),
      ...(this.baseUrl !== undefined ? { baseUrl: this.baseUrl } : {}),
    };
  }
}

export interface NodejsRestClientRecord extends DiscoveryEntityBase, NodejsRestClientCreateIntent {}
