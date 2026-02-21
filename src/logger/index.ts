import type { SwiftConfig, QueryLogEntry } from '../types';

let debugEnabled: boolean | string[] = false;
let slowQueryWarning = 200;
let logSize = 100;
const resourceLogs = new Map<string, QueryLogEntry[]>();

let logFn: (resource: string, query: string, time: number, params?: unknown[]) => void = noop;

function noop() {}

function realLog(resource: string, query: string, time: number, params?: unknown[]): void {
  const entry: QueryLogEntry = {
    query,
    executionTime: time,
    resource,
    timestamp: Date.now(),
  };

  let logs = resourceLogs.get(resource);
  if (!logs) {
    logs = [];
    resourceLogs.set(resource, logs);
  }

  if (logs.length >= logSize) logs.shift();
  logs.push(entry);

  if (isDebugResource(resource)) {
    console.log(
      `^3[swiftdb:${resource}] ${query} [${time.toFixed(2)}ms]${params?.length ? ` | ${JSON.stringify(params)}` : ''}^0`
    );
  }
}

function isDebugResource(resource: string): boolean {
  if (debugEnabled === true) return true;
  if (Array.isArray(debugEnabled)) return debugEnabled.includes(resource);
  return false;
}

export function initLogger(config: SwiftConfig): void {
  debugEnabled = config.debug;
  slowQueryWarning = config.slowQueryWarning;
  logSize = config.debug ? Math.max(config.logSize, 10000) : config.logSize;

  if (config.debug || config.ui) {
    logFn = realLog;
  } else {
    logFn = noop;
  }
}

export function refreshDebug(): void {
  const val = GetConvar('swift_debug', GetConvar('mysql_debug', 'false'));
  if (val === 'true') debugEnabled = true;
  else if (val === 'false') debugEnabled = false;
  else {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) debugEnabled = parsed;
    } catch {}
  }
}

export function logQuery(resource: string, query: string, time: number, params?: unknown[]): void {
  logFn(resource, query, time, params);
}

export function logSlowQuery(resource: string, query: string, time: number): void {
  if (time >= slowQueryWarning) {
    console.log(
      `^3[swiftdb] Slow query detected (${time.toFixed(0)}ms) from ${resource}: ${query.slice(0, 200)}^0`
    );
  }
}

export function getResourceLogs(resource: string): QueryLogEntry[] {
  return resourceLogs.get(resource) || [];
}
