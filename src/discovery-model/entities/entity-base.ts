export interface DiscoveryEntityBase {
  readonly id: string;
  readonly scannerExtractor: string;
  readonly scannerSchema: string;
  readonly extractedAt: string;
}

export interface DiscoveryEntityCreateIntent {
  readonly id: string;
}
