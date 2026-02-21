import type { CFXParameters } from '../types';

const convertNamedPlaceholders: (query: string, params: Record<string, any>) => [string, any[]] =
  require('named-placeholders')();

export function parseArguments(
  query: string,
  parameters?: CFXParameters
): [string, unknown[]] {
  if (convertNamedPlaceholders && parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
    if (query.includes(':') || query.includes('@')) {
      [query, parameters] = convertNamedPlaceholders(query, parameters as Record<string, unknown>);
    }
  }

  if (!parameters || typeof parameters === 'function') {
    return [query, []];
  }

  const placeholders = query.match(/\?(?!\?)/g)?.length ?? 0;

  if (parameters && !Array.isArray(parameters)) {
    const arr: unknown[] = [];
    for (let i = 0; i < placeholders; i++) {
      arr[i] = (parameters as Record<string, unknown>)[i + 1] ?? null;
    }
    return [query, arr];
  }

  if (placeholders) {
    if ((parameters as unknown[]).length === 0) {
      const arr: unknown[] = [];
      for (let i = 0; i < placeholders; i++) arr[i] = null;
      return [query, arr];
    }

    const diff = placeholders - (parameters as unknown[]).length;
    if (diff > 0) {
      const padded = [...(parameters as unknown[])];
      for (let i = 0; i < diff; i++) padded.push(null);
      return [query, padded];
    } else if (diff < 0) {
      throw new Error(`Expected ${placeholders} parameters, but received ${(parameters as unknown[]).length}.`);
    }
  }

  return [query, parameters as unknown[]];
}
