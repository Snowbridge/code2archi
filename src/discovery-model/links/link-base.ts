export interface DiscoveryLinkBase {
  readonly id: string;
  readonly linkerExtractor: string;
  readonly linkerSchema: string;
  readonly linkedAt: string;
}

export interface DiscoveryLinkCreateIntent {
  readonly id: string;
}
