import type { QueryType, CFXParameters, CFXCallback } from '../types';
import { acquireConnection, releaseConnection } from './connection';
import { parseArguments } from '../utils/parseArguments';
import { parseResponse } from '../utils/parseResponse';
import { typeCast } from '../utils/typeCast';
import { scheduleTick } from '../utils/scheduleTick';
import { logQuery, logSlowQuery } from '../logger';
import { shouldProfile, profileQuery, getProfileDuration } from '../profiler';

function setCallback(
  parameters: CFXParameters,
  cb?: CFXCallback | CFXParameters,
  isPromise?: boolean
): [CFXParameters, CFXCallback | undefined, boolean] {
  if (typeof parameters === 'function') {
    return [undefined, parameters as unknown as CFXCallback, false];
  }
  if (typeof cb === 'function') {
    return [parameters, cb as CFXCallback, isPromise || false];
  }
  return [parameters, undefined, isPromise || false];
}

export async function executeQuery(
  type: QueryType,
  resource: string,
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  isPromise?: boolean
): Promise<any> {
  [parameters, cb, isPromise] = setCallback(parameters, cb, isPromise);

  let conn;
  try {
    const [sql, params] = parseArguments(query, parameters);
    conn = await acquireConnection();

    const doProfile = shouldProfile();
    let profileStart = 0;

    if (doProfile) {
      profileStart = await profileQuery(conn);
    }

    const startTime = performance.now();
    const [rows] = await conn.query({ sql, typeCast } as any, params);
    const execTime = performance.now() - startTime;

    let serverTime = execTime;
    if (doProfile) {
      serverTime = await getProfileDuration(conn, profileStart);
    }

    releaseConnection(conn);

    const result = parseResponse(type, rows);

    logQuery(resource, sql, serverTime, params as unknown[]);
    logSlowQuery(resource, sql, execTime);

    if (cb) {
      cb(result);
      if (!isPromise) scheduleTick(resource);
    }

    return result;
  } catch (err: any) {
    if (conn) releaseConnection(conn);

    const errorMsg = `[swiftdb] ${err.message}\nQuery: ${query}\nResource: ${resource}`;
    console.log(`^1${errorMsg}^0`);

    emit('oxmysql:error', {
      query,
      message: err.message,
      err: err.code,
      resource,
    });

    if (cb) {
      cb(null, errorMsg);
      if (!isPromise) scheduleTick(resource);
    }

    return null;
  }
}

export async function executeRaw(
  resource: string,
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  isPromise?: boolean,
  unpack?: boolean
): Promise<any> {
  [parameters, cb, isPromise] = setCallback(parameters, cb, isPromise);

  let conn;
  try {
    const params = normalizeExecuteParams(parameters);
    conn = await acquireConnection();

    const startTime = performance.now();
    const response: any[] = [];

    for (let i = 0; i < params.length; i++) {
      const values = params[i];
      const [rows] = await conn.execute({ sql: query } as any, values);
      response.push(rows);
    }

    const execTime = performance.now() - startTime;
    releaseConnection(conn);

    let result: any;

    if (unpack) {
      const queryType = detectQueryType(query);
      if (params.length === 1) {
        result = parseResponse(queryType, response[0]);
      } else {
        result = response.map((r) => parseResponse(queryType, r));
      }
    } else {
      result = params.length === 1 ? response[0] : response;
    }

    logQuery(resource, query, execTime);
    logSlowQuery(resource, query, execTime);

    if (cb) {
      cb(result);
      if (!isPromise) scheduleTick(resource);
    }

    return result;
  } catch (err: any) {
    if (conn) releaseConnection(conn);

    const errorMsg = `[swiftdb] ${err.message}\nQuery: ${query}\nResource: ${resource}`;
    console.log(`^1${errorMsg}^0`);

    emit('oxmysql:error', {
      query,
      message: err.message,
      err: err.code,
      resource,
    });

    if (cb) {
      cb(null, errorMsg);
      if (!isPromise) scheduleTick(resource);
    }

    return null;
  }
}

function detectQueryType(query: string): QueryType {
  let i = 0;
  while (i < query.length && query.charCodeAt(i) <= 32) i++;
  const c = query.charCodeAt(i) | 0x20;
  if (c === 0x69) return 'insert'; // i
  if (c === 0x75 || c === 0x64) return 'update'; // u or d
  return null;
}

function objectValues(obj: Record<string, unknown>): unknown[] {
  const keys = Object.keys(obj);
  const len = keys.length;
  const values = new Array(len);
  for (let i = 0; i < len; i++) {
    values[i] = obj[keys[i]];
  }
  return values;
}

function normalizeExecuteParams(parameters: CFXParameters): unknown[][] {
  if (!parameters || (Array.isArray(parameters) && parameters.length === 0)) {
    return [[]];
  }

  if (Array.isArray(parameters)) {
    if (parameters.length > 0 && Array.isArray(parameters[0])) {
      return parameters as unknown[][];
    }

    if (parameters.length > 0 && typeof parameters[0] === 'object' && parameters[0] !== null) {
      const result = new Array(parameters.length);
      for (let i = 0; i < parameters.length; i++) {
        result[i] = objectValues(parameters[i] as Record<string, unknown>);
      }
      return result;
    }

    return [parameters as unknown[]];
  }

  if (typeof parameters === 'object') {
    return [objectValues(parameters as Record<string, unknown>)];
  }

  return [[]];
}
