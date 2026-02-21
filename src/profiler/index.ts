import type { PoolConnection } from '../types';

let sampleRate = 20;
let counter = 0;

export function initProfiler(rate: number): void {
  sampleRate = rate;
}

export function shouldProfile(): boolean {
  return ++counter % sampleRate === 0;
}

export async function profileQuery(conn: PoolConnection): Promise<number> {
  try {
    await conn.query('SET profiling = 1');
    return performance.now();
  } catch {
    return performance.now();
  }
}

export async function getProfileDuration(conn: PoolConnection, startTime: number): Promise<number> {
  try {
    const [rows] = await conn.query('SHOW PROFILES') as any;
    if (rows && rows.length > 0) {
      const last = rows[rows.length - 1];
      await conn.query('SET profiling = 0');
      return last.Duration * 1000;
    }
  } catch {}
  return performance.now() - startTime;
}
