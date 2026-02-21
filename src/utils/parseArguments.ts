import type { CFXParameters, CachedStatement } from '../types';
import { getCached, setCached } from '../cache/statementCache';

const NAMED_PARAM_RE = /(?<!["'])[:@]([a-zA-Z][a-zA-Z0-9_]*)/g;

function convertNamedToPositional(
  query: string,
  params: Record<string, unknown>
): [string, unknown[]] {
  const cached = getCached(query);
  if (cached) {
    return [cached.sql, cached.params.map((k) => params[k] ?? null)];
  }

  const paramNames: string[] = [];
  const sql = query.replace(NAMED_PARAM_RE, (_match, name) => {
    paramNames.push(name);
    return '?';
  });

  setCached(query, { sql, params: paramNames });
  return [sql, paramNames.map((k) => params[k] ?? null)];
}

function normalizeObjectParams(params: Record<string, unknown>, count: number): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < count; i++) {
    result.push(params[String(i + 1)] ?? null);
  }
  return result;
}

function countPlaceholders(query: string): number {
  let count = 0;
  for (let i = 0; i < query.length; i++) {
    if (query[i] === '?' && query[i + 1] !== '?') count++;
  }
  return count;
}

export function parseArguments(
  query: string,
  parameters?: CFXParameters
): [string, unknown[]] {
  if (parameters === null || parameters === undefined || typeof parameters === 'function') {
    return [query, []];
  }

  if (!Array.isArray(parameters) && typeof parameters === 'object') {
    if (query.includes(':') || query.includes('@')) {
      return convertNamedToPositional(query, parameters as Record<string, unknown>);
    }

    const count = countPlaceholders(query);
    return [query, normalizeObjectParams(parameters as Record<string, unknown>, count)];
  }

  if (Array.isArray(parameters)) {
    const count = countPlaceholders(query);
    const arr = parameters as unknown[];

    if (arr.length < count) {
      const padded = [...arr];
      while (padded.length < count) padded.push(null);
      return [query, padded];
    }

    if (arr.length > count && count > 0) {
      throw new Error(
        `[swiftdb] Too many parameters (${arr.length}) for query with ${count} placeholders`
      );
    }

    return [query, arr];
  }

  return [query, []];
}
