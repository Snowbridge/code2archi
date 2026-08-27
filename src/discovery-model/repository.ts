export interface Repository {
  readonly id: string;
  readonly name: string;
  readonly namespace: string;
  readonly localPath: string;
  readonly url: string;
  readonly buildSystems: readonly string[];
}
