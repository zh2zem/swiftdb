import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, PoolStats, SwiftConfig, PoolOptions } from '../types';
import { buildPoolOptions } from '../config';

let pool: Pool | null = null;
let activeCount = 0;
let maxPending = 100;
let retryDelay = 1000;
let poolReady: Promise<void> | null = null;
let resolvePoolReady: (() => void) | null = null;

const MAX_RETRY_DELAY = 30000;

export function preparePool(): void {
  poolReady = new Promise((resolve) => {
    resolvePoolReady = resolve;
  });
}

export async function initializePool(config: SwiftConfig): Promise<void> {
  maxPending = config.maxPending;
  const options = buildPoolOptions(config);

  while (!pool) {
    try {
      pool = mysql.createPool(options);
      const conn = await pool.getConnection();
      conn.release();
      retryDelay = 1000;
      console.log(`^2[swiftdb] Connected to ${options.host}:${options.port}/${options.database}^0`);
      if (resolvePoolReady) resolvePoolReady();
    } catch (err: any) {
      pool = null;
      console.log(`^1[swiftdb] Connection failed: ${err.message}. Retrying in ${retryDelay / 1000}s...^0`);
      await new Promise((r) => setTimeout(r, retryDelay));
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    }
  }
}

export async function getConnection(): Promise<PoolConnection> {
  if (!pool && poolReady) await poolReady;
  if (!pool) throw new Error('[swiftdb] Pool not initialized');

  if (activeCount >= maxPending) {
    throw new Error(`[swiftdb] Backpressure limit reached (${maxPending} active queries). Query rejected.`);
  }

  try {
    const conn = await pool.getConnection();
    activeCount++;
    return conn;
  } catch (err) {
    throw err;
  }
}

export function releasePoolConnection(conn: PoolConnection): void {
  activeCount--;
  conn.release();
}

export function destroyPoolConnection(conn: PoolConnection): void {
  activeCount--;
  conn.destroy();
}

export function getPool(): Pool | null {
  return pool;
}

export function isPoolReady(): boolean {
  return pool !== null;
}

export function getPoolStats(): PoolStats {
  if (!pool) return { active: 0, pending: 0, idle: 0, total: 0 };

  const raw = (pool as any).pool;
  return {
    active: raw?._allConnections?.length - raw?._freeConnections?.length || 0,
    pending: activeCount,
    idle: raw?._freeConnections?.length || 0,
    total: raw?._allConnections?.length || 0,
  };
}
