export interface DiscoveryEntityBase {
  readonly id: string;
  readonly extractProcessor: string;
  readonly extractSchema: string;
  readonly extractedAt: string;
}

export interface DiscoveryEntityCreateIntent {
  readonly id: string;
}
