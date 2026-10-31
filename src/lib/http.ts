import { config } from "./config";

interface CacheEntry<T> {
  expires: number;
  value: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const value = load();
  cache.set(key, { expires: now + ttlMs, value });
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchText(
  url: string,
  headers: Record<string, string> = {}
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": config.userAgent,
          "accept-language": "sk-SK,sk;q=0.9,en;q=0.5",
          ...headers,
        },
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });
      if (res.status === 404) throw new UpstreamError("Not found", 404);
      if (!res.ok) {
        throw new UpstreamError(
          `kinopovazan.sk responded with HTTP ${res.status}`,
          res.status
        );
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if (err instanceof UpstreamError && err.status && err.status < 500) {
        throw err;
      }
    }
  }
  if (lastError instanceof UpstreamError) throw lastError;
  throw new UpstreamError(
    `Could not reach kinopovazan.sk: ${(lastError as Error)?.message ?? lastError}`
  );
}
