import type { CFXCallback, CFXParameters } from '../types';
import { acquireConnection, releaseConnection } from './connection';
import { parseArguments } from '../utils/parseArguments';
import { scheduleTick } from '../utils/scheduleTick';
import { logQuery, logSlowQuery } from '../logger';
import { typeCast } from '../utils/typeCast';

export async function executeBatch(
  resource: string,
  query: string,
  paramSets: any[][],
  cb?: CFXCallback,
  isPromise?: boolean
): Promise<any> {
  let conn;
  try {
    conn = await acquireConnection();
    await conn.beginTransaction();

    const startTime = performance.now();
    const results: any[] = [];

    for (const params of paramSets) {
      const [sql, values] = parseArguments(query, params);
      const [rows] = await conn.query({ sql, typeCast } as any, values);
      results.push(rows);
    }

    await conn.commit();
    const execTime = performance.now() - startTime;
    releaseConnection(conn);

    logQuery(resource, `BATCH(${paramSets.length}): ${query}`, execTime);
    logSlowQuery(resource, query, execTime);

    if (cb) {
      cb(results);
      if (!isPromise) scheduleTick(resource);
    }

    return results;
  } catch (err: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
      releaseConnection(conn);
    }

    const errorMsg = `[swiftdb] Batch error: ${err.message}\nQuery: ${query}\nResource: ${resource}`;
    console.log(`^1${errorMsg}^0`);

    if (cb) {
      cb(null, errorMsg);
      if (!isPromise) scheduleTick(resource);
    }

    return null;
  }
}
