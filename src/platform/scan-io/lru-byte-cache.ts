interface LruByteEntry<T> {
  readonly value: T;
  readonly sizeBytes: number;
}

export class LruByteCache<T> {
  private readonly maxBytes: number;
  private readonly entries = new Map<string, LruByteEntry<T>>();
  private currentBytes = 0;

  constructor(maxBytes: number) {
    this.maxBytes = Math.max(0, maxBytes);
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, sizeBytes: number): void {
    if (this.maxBytes === 0) {
      return;
    }

    const existing = this.entries.get(key);
    if (existing) {
      this.currentBytes -= existing.sizeBytes;
      this.entries.delete(key);
    }

    const normalizedSize = Math.max(1, sizeBytes);
    while (this.currentBytes + normalizedSize > this.maxBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        break;
      }
      const oldest = this.entries.get(oldestKey);
      if (oldest) {
        this.currentBytes -= oldest.sizeBytes;
      }
      this.entries.delete(oldestKey);
    }

    if (normalizedSize > this.maxBytes) {
      return;
    }

    this.entries.set(key, { value, sizeBytes: normalizedSize });
    this.currentBytes += normalizedSize;
  }

  clear(): void {
    this.entries.clear();
    this.currentBytes = 0;
  }

  get size(): number {
    return this.entries.size;
  }
}
