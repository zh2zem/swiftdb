import type { CFXCallback, CFXParameters, TransactionQuery } from '../types';
import { acquireConnection, releaseConnection } from './connection';
import { parseArguments } from '../utils/parseArguments';
import { scheduleTick } from '../utils/scheduleTick';
import { logQuery, logSlowQuery } from '../logger';
import { typeCast } from '../utils/typeCast';
import { getIsolationLevel } from '../config';

interface ParsedQuery {
  sql: string;
  params: unknown[];
}

function parseTransaction(
  queries: TransactionQuery,
  parameters: CFXParameters
): ParsedQuery[] {
  if (Array.isArray(queries)) {
    return queries.map((item: any) => {
      if (typeof item === 'string') {
        const [sql, params] = parseArguments(item, parameters);
        return { sql, params };
      }

      if (Array.isArray(item)) {
        const [sql, params] = parseArguments(item[0], item[1]);
        return { sql, params };
      }

      if (typeof item === 'object') {
        const [sql, params] = parseArguments(item.query, item.parameters || item.values);
        return { sql, params };
      }

      throw new Error(`[swiftdb] Invalid transaction query format`);
    });
  }

  if (typeof queries === 'object' && 'query' in queries) {
    const queryList = Array.isArray(queries.query) ? queries.query : [queries.query];
    const txParams = queries.parameters || queries.values || parameters;
    return queryList.map((q) => {
      const [sql, params] = parseArguments(q, txParams);
      return { sql, params };
    });
  }

  throw new Error(`[swiftdb] Invalid transaction format`);
}

export async function executeTransaction(
  resource: string,
  queries: TransactionQuery,
  parameters: CFXParameters,
  cb?: CFXCallback,
  isPromise?: boolean,
  isolationLevel?: number
): Promise<boolean> {
  if (typeof parameters === 'function') {
    cb = parameters as unknown as CFXCallback;
    parameters = undefined;
    isPromise = false;
  }
  if (typeof cb !== 'function') {
    cb = undefined;
  }

  let conn;
  try {
    const parsed = parseTransaction(queries, parameters);
    conn = await acquireConnection();

    if (isolationLevel) {
      await conn.query(`SET TRANSACTION ISOLATION LEVEL ${getIsolationLevel(isolationLevel)}`);
    }

    await conn.beginTransaction();

    const startTime = performance.now();

    for (let i = 0; i < parsed.length; i++) {
      try {
        await conn.query({ sql: parsed[i].sql, typeCast } as any, parsed[i].params);
      } catch (err: any) {
        throw new Error(`Query ${i + 1} failed: ${err.message}\n${parsed[i].sql}`);
      }
    }

    await conn.commit();
    const execTime = performance.now() - startTime;
    releaseConnection(conn);

    logQuery(resource, `TRANSACTION(${parsed.length} queries)`, execTime);
    logSlowQuery(resource, `TRANSACTION(${parsed.length} queries)`, execTime);

    if (cb) {
      cb(true);
      if (!isPromise) scheduleTick(resource);
    }

    return true;
  } catch (err: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
      releaseConnection(conn);
    }

    const errorMsg = `[swiftdb] Transaction error: ${err.message}\nResource: ${resource}`;
    console.log(`^1${errorMsg}^0`);

    emit('oxmysql:transaction-error', {
      query: queries,
      parameters,
      message: err.message,
      err: (err as any).code,
      resource,
    });

    if (cb) {
      cb(false);
      if (!isPromise) scheduleTick(resource);
    }

    return false;
  }
}

export async function startTransaction(
  resource: string,
  queryCb: (query: (sql: string, params?: CFXParameters) => Promise<any>) => Promise<boolean | void>,
  cb?: CFXCallback,
  isPromise?: boolean
): Promise<boolean | null> {
  let conn;
  let timedOut = false;

  try {
    conn = await acquireConnection();
    await conn.beginTransaction();

    const timeout = setTimeout(() => {
      timedOut = true;
    }, 30000);

    const runQuery = async (sql: string, params?: CFXParameters): Promise<any> => {
      if (timedOut) throw new Error('[swiftdb] Transaction timed out (30s)');
      const [parsedSql, parsedParams] = parseArguments(sql, params);
      const [rows] = await conn!.query({ sql: parsedSql, typeCast } as any, parsedParams);
      return rows;
    };

    const shouldCommit = await queryCb(runQuery);

    clearTimeout(timeout);

    if (shouldCommit === false) {
      await conn.rollback();
      releaseConnection(conn);
      if (cb) cb(false);
      return false;
    }

    await conn.commit();
    releaseConnection(conn);
    if (cb) cb(true);
    return true;
  } catch (err: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
      releaseConnection(conn);
    }

    console.log(`^1[swiftdb] Interactive transaction error: ${err.message}^0`);

    if (cb) cb(null);
    return null;
  }
}
