import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";
import type { TcpStackType } from "../../parsers/java/rest/rest-tcp-stack-type.js";

export type { TcpStackType };

export type DiscoveryStyle = "DECLARATIVE" | "PROGRAMMATIC";

export interface RestClientCreateIntent {
  readonly id: string;
  readonly applicationModuleId: string;
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly discoveryStyle: DiscoveryStyle;
  readonly clientFramework: string;
  readonly extendedInterfaceFqcn: readonly string[];
  readonly sourceFile: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export interface RestClientNaturalKeys {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly discoveryStyle: DiscoveryStyle;
  readonly clientFramework: string;
  readonly extendedInterfaceFqcn: readonly string[];
  readonly sourceFile: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export class RestClient extends Entity {
  private static readonly ENTITY_TYPE = "RestClient" as const;

  readonly applicationModuleId: string;
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly discoveryStyle: DiscoveryStyle;
  readonly clientFramework: string;
  readonly extendedInterfaceFqcn: readonly string[];
  readonly sourceFile: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;

  constructor(naturalKeys: RestClientNaturalKeys) {
    super(RestClient.ENTITY_TYPE, [naturalKeys.applicationModuleId, naturalKeys.fqcn]);
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.name = naturalKeys.name;
    this.fqcn = naturalKeys.fqcn;
    this.dtoFqcn = naturalKeys.dtoFqcn;
    this.endpoints = naturalKeys.endpoints;
    this.tcpStackType = naturalKeys.tcpStackType;
    this.discoveryStyle = naturalKeys.discoveryStyle;
    this.clientFramework = naturalKeys.clientFramework;
    this.extendedInterfaceFqcn = naturalKeys.extendedInterfaceFqcn;
    this.sourceFile = naturalKeys.sourceFile;
    if (naturalKeys.serviceName !== undefined) {
      this.serviceName = naturalKeys.serviceName;
    }
    if (naturalKeys.baseUrl !== undefined) {
      this.baseUrl = naturalKeys.baseUrl;
    }
  }

  toCreateIntent(): RestClientCreateIntent {
    return {
      id: this.id,
      applicationModuleId: this.applicationModuleId,
      name: this.name,
      fqcn: this.fqcn,
      dtoFqcn: this.dtoFqcn,
      endpoints: this.endpoints,
      tcpStackType: this.tcpStackType,
      discoveryStyle: this.discoveryStyle,
      clientFramework: this.clientFramework,
      extendedInterfaceFqcn: this.extendedInterfaceFqcn,
      sourceFile: this.sourceFile,
      ...(this.serviceName !== undefined ? { serviceName: this.serviceName } : {}),
      ...(this.baseUrl !== undefined ? { baseUrl: this.baseUrl } : {}),
    };
  }
}

export interface RestClientRecord extends DiscoveryEntityBase, RestClientCreateIntent {}
