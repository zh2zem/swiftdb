import type { CFXCallback, CFXParameters } from '../types';
import { acquireConnection, releaseConnection, destroyConnection } from './connection';
import { parseArguments } from '../utils/parseArguments';
import { scheduleTick } from '../utils/scheduleTick';
import { logQuery, logSlowQuery } from '../logger';
import { typeCast } from '../utils/typeCast';

const INSERT_RE = /^INSERT\s+INTO\s+.+VALUES\s*(\([^)]+\))\s*$/i;
const MAX_BATCH_SIZE = 1000;

function buildMultiInsert(
  sql: string,
  paramSets: unknown[][],
  placeholderGroup: string
): [string, unknown[]] {
  const groups = new Array(paramSets.length);
  for (let i = 0; i < paramSets.length; i++) {
    groups[i] = placeholderGroup;
  }

  const multiSql = sql.replace(placeholderGroup, groups.join(','));
  const flat = new Array(paramSets.length * paramSets[0].length);
  let idx = 0;
  for (let i = 0; i < paramSets.length; i++) {
    const set = paramSets[i];
    for (let j = 0; j < set.length; j++) {
      flat[idx++] = set[j];
    }
  }

  return [multiSql, flat];
}

export async function executeBatch(
  resource: string,
  query: string,
  paramSets: any[][],
  cb?: CFXCallback,
  isPromise?: boolean
): Promise<any> {
  let conn;
  try {
    const [sql] = parseArguments(query, paramSets[0]);

    conn = await acquireConnection();
    await conn.beginTransaction();

    const startTime = performance.now();
    const results: any[] = [];

    const insertMatch = sql.match(INSERT_RE);

    if (insertMatch) {
      const placeholderGroup = insertMatch[1];

      for (let offset = 0; offset < paramSets.length; offset += MAX_BATCH_SIZE) {
        const chunk = paramSets.slice(offset, offset + MAX_BATCH_SIZE);
        const resolvedChunk = new Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          const [, values] = parseArguments(query, chunk[i]);
          resolvedChunk[i] = values;
        }

        const [multiSql, flatParams] = buildMultiInsert(sql, resolvedChunk, placeholderGroup);
        const [rows] = await conn.query({ sql: multiSql, typeCast } as any, flatParams);
        results.push(rows);
      }
    } else {
      for (let i = 0; i < paramSets.length; i++) {
        const [paramSql, values] = parseArguments(query, paramSets[i]);
        const [rows] = await conn.query({ sql: paramSql, typeCast } as any, values);
        results.push(rows);
      }
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
        releaseConnection(conn);
      } catch {
        destroyConnection(conn);
      }
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
