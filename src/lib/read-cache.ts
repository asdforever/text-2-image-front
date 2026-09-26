const DEFAULT_READ_TTL_MS = 10_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface InflightEntry {
  promise: Promise<unknown>;
  keyVersion: number;
  epoch: number;
}

interface ReadCacheOptions {
  now?: () => number;
  ttlMs?: number;
}

export class ReadCache {
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, InflightEntry>();
  private readonly keyVersions = new Map<string, number>();
  private epoch = 0;

  constructor(options: ReadCacheOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_READ_TTL_MS;
  }

  read<T>(key: string, load: () => Promise<T>, ttlMs = this.ttlMs, force = false): Promise<T> {
    const cached = this.entries.get(key);
    if (!force && cached && cached.expiresAt > this.now()) return Promise.resolve(cached.value as T);

    const keyVersion = this.keyVersions.get(key) ?? 0;
    const existing = this.inflight.get(key);
    if (existing && existing.keyVersion === keyVersion && existing.epoch === this.epoch) {
      return existing.promise as Promise<T>;
    }

    const epoch = this.epoch;
    const promise = Promise.resolve()
      .then(load)
      .then((value) => {
        const current = this.inflight.get(key);
        if (
          current?.promise === promise
          && this.epoch === epoch
          && (this.keyVersions.get(key) ?? 0) === keyVersion
        ) {
          this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
        }
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key)?.promise === promise) this.inflight.delete(key);
      });

    this.inflight.set(key, { promise, keyVersion, epoch });
    return promise;
  }

  peek<T>(key: string): T | undefined {
    return this.entries.get(key)?.value as T | undefined;
  }

  invalidate(key: string) {
    this.entries.delete(key);
    this.inflight.delete(key);
    this.keyVersions.set(key, (this.keyVersions.get(key) ?? 0) + 1);
  }

  invalidatePrefix(prefix: string) {
    const keys = new Set([...this.entries.keys(), ...this.inflight.keys(), ...this.keyVersions.keys()]);
    for (const key of keys) {
      if (key.startsWith(prefix)) this.invalidate(key);
    }
  }

  clear() {
    this.epoch += 1;
    this.entries.clear();
    this.inflight.clear();
    this.keyVersions.clear();
  }
}

export const readCacheKeys = {
  projectList: (includeArchived = false) => `projects:list:${includeArchived ? "all" : "active"}`,
  projectDetail: (projectId: string) => `projects:detail:${projectId}`,
  promptTemplates: (stage?: string) => `prompts:templates:${stage ?? "all"}`,
  promptCategories: "prompts:categories",
  promptDetail: (templateId: string) => `prompts:detail:${templateId}`,
  promptVersions: (templateId: string) => `prompts:versions:${templateId}`,
  publishedGenerationConfig: "generation-config:published",
} as const;

export const sharedReadCache = new ReadCache();
