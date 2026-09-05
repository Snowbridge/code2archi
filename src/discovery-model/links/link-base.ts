export interface DiscoveryLinkBase {
  readonly id: string;
  readonly transformProcessor: string;
  readonly transformSchema: string;
  readonly linkedAt: string;
}

export interface DiscoveryLinkCreateIntent {
  readonly id: string;
}
