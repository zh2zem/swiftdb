import type { PoolConnection } from '../types';
import { getConnection } from './pool';

export async function acquireConnection(): Promise<PoolConnection> {
  return getConnection();
}

export function releaseConnection(conn: PoolConnection): void {
  try {
    conn.release();
  } catch {}
}
