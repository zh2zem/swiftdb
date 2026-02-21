import type { CachedStatement } from '../types';

let maxSize = 500;
const cache = new Map<string, CachedStatement>();

export function initCache(size: number): void {
  maxSize = size;
}

export function getCached(query: string): CachedStatement | undefined {
  const entry = cache.get(query);
  if (entry) {
    cache.delete(query);
    cache.set(query, entry);
  }
  return entry;
}

export function setCached(query: string, parsed: CachedStatement): void {
  if (cache.size >= maxSize) {
    const first = cache.keys().next().value!;
    cache.delete(first);
  }
  cache.set(query, parsed);
}

export function clearCache(): void {
  cache.clear();
}
