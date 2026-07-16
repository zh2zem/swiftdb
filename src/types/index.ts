import type { Pool, PoolConnection, PoolOptions } from 'mysql2/promise';

export type CFXParameters = Record<string, unknown> | unknown[] | null | undefined;
export type CFXCallback = (result: unknown, error?: string) => void;
export type QueryType = 'query' | 'single' | 'scalar' | 'update' | 'insert' | null;

export interface TransactionQueryObject {
  query: string;
  parameters?: CFXParameters;
  values?: CFXParameters;
}

export type TransactionQuery =
  | string[]
  | TransactionQueryObject[]
  | [string, CFXParameters][]
  | { query: string | string[]; parameters?: CFXParameters; values?: CFXParameters };

export interface SwiftConfig {
  connectionString: string;
  debug: boolean | string[];
  ui: boolean;
  slowQueryWarning: number;
  poolSize: number;
  maxPending: number;
  profilerSampleRate: number;
  transactionIsolation: number;
  logSize: number;
}

export interface QueryLogEntry {
  query: string;
  executionTime: number;
  resource: string;
  timestamp: number;
}

export { Pool, PoolConnection, PoolOptions };
