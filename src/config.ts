import type { SwiftConfig, PoolOptions } from './types';

function getConvar(name: string, fallback: string, altName?: string): string {
  const val = GetConvar(name, '');
  if (val !== '') return val;
  if (altName) return GetConvar(altName, fallback);
  return fallback;
}

function getConvarInt(name: string, fallback: number, altName?: string): number {
  const val = GetConvarInt(name, -999);
  if (val !== -999) return val;
  if (altName) return GetConvarInt(altName, fallback);
  return fallback;
}

function parseDebug(value: string): boolean | string[] {
  if (value === 'true') return true;
  if (value === 'false') return false;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return false;
}

export function loadConfig(): SwiftConfig {
  return {
    connectionString: getConvar('mysql_connection_string', ''),
    debug: parseDebug(getConvar('swift_debug', 'false', 'mysql_debug')),
    ui: getConvar('swift_ui', 'false', 'mysql_ui') === 'true',
    slowQueryWarning: getConvarInt('swift_slow_query_warning', 200, 'mysql_slow_query_warning'),
    poolSize: getConvarInt('swift_pool_size', 10),
    maxPending: getConvarInt('swift_max_pending', 100),
    cacheSize: getConvarInt('swift_cache_size', 500),
    profilerSampleRate: getConvarInt('swift_profiler_sample_rate', 20),
    transactionIsolation: getConvarInt('swift_transaction_isolation', 2, 'mysql_transaction_isolation_level'),
    logSize: getConvarInt('swift_log_size', 100, 'mysql_log_size'),
  };
}

interface ParsedConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  [key: string]: unknown;
}

const KEY_ALIASES: Record<string, string> = {
  hostname: 'host',
  ip: 'host',
  server: 'host',
  'data source': 'host',
  address: 'host',
  'user id': 'user',
  'user name': 'user',
  uid: 'user',
  pwd: 'password',
  pass: 'password',
  db: 'database',
};

function parseUri(uri: string): ParsedConnection {
  const match = uri.match(
    /^mysql:\/\/([^:]+):([^@]*)@([^/:]+):?(\d+)?\/([^?]+)\??(.*)$/
  );

  if (!match) throw new Error('Invalid MySQL connection URI');

  const params: Record<string, string> = {};
  if (match[6]) {
    for (const pair of match[6].split('&')) {
      const [k, v] = pair.split('=');
      if (k && v) params[k] = decodeURIComponent(v);
    }
  }

  return {
    host: match[1],
    port: match[4] ? parseInt(match[4], 10) : 3306,
    user: decodeURIComponent(match[2] || ''),
    password: decodeURIComponent(match[3] || ''),
    database: match[5],
    ...params,
  };
}

function parseDsn(dsn: string): ParsedConnection {
  const result: Record<string, string> = {};

  for (const part of dsn.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    const normalized = KEY_ALIASES[key] || key;
    result[normalized] = value;
  }

  return {
    host: result.host || 'localhost',
    port: parseInt(result.port || '3306', 10),
    user: result.user || 'root',
    password: result.password || '',
    database: result.database || '',
    ...result,
  };
}

export function parseConnectionString(connStr: string): ParsedConnection {
  if (connStr.startsWith('mysql://')) {
    return parseUri(connStr);
  }
  return parseDsn(connStr);
}

const ISOLATION_LEVELS: Record<number, string> = {
  1: 'REPEATABLE READ',
  2: 'READ COMMITTED',
  3: 'READ UNCOMMITTED',
  4: 'SERIALIZABLE',
};

export function getIsolationLevel(level: number): string {
  return ISOLATION_LEVELS[level] || 'READ COMMITTED';
}

export function buildPoolOptions(config: SwiftConfig): PoolOptions {
  const parsed = parseConnectionString(config.connectionString);
  const hasDb = !!parsed.database;

  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    waitForConnections: true,
    connectionLimit: config.poolSize,
    connectTimeout: 60000,
    supportBigNumbers: true,
    jsonStrings: true,
    namedPlaceholders: false,
    flags: hasDb ? ['CONNECT_WITH_DB'] : ['-CONNECT_WITH_DB'],
    ...(parsed.charset && { charset: parsed.charset as string }),
  } as PoolOptions;
}
