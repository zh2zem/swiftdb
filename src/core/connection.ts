import type { PoolConnection } from '../types';
import { getConnection, releasePoolConnection, destroyPoolConnection } from './pool';

export async function acquireConnection(): Promise<PoolConnection> {
  return getConnection();
}

export function releaseConnection(conn: PoolConnection): void {
  try {
    releasePoolConnection(conn);
  } catch {}
}

export function destroyConnection(conn: PoolConnection): void {
  try {
    destroyPoolConnection(conn);
  } catch {}
}
