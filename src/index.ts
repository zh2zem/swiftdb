import { loadConfig } from './config';
import { initializePool, isPoolReady } from './core/pool';
import { initCache } from './cache/statementCache';
import { initProfiler } from './profiler';
import { initLogger, refreshDebug } from './logger';
import { executeQuery, executeRaw } from './core/queryEngine';
import { executeTransaction, startTransaction } from './core/transactionManager';
import { scheduleTick } from './utils/scheduleTick';
import { mysqlAsyncAliases } from './compat/mysqlAsync';
import { ghmattimysqlAliases } from './compat/ghmattimysql';
import type { CFXCallback, CFXParameters, TransactionQuery } from './types';

const config = loadConfig();

initCache(config.cacheSize);
initProfiler(config.profilerSampleRate);
initLogger(config);

function provide(resourceName: string, method: string, cb: Function): void {
  on(`__cfx_export_${resourceName}_${method}`, (setCb: (fn: Function) => void) => setCb(cb));
}

const MySQL: Record<string, Function> = {};

MySQL.isReady = () => isPoolReady();

MySQL.awaitConnection = async () => {
  while (!isPoolReady()) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return true;
};

MySQL.query = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeQuery(null, resource, query, parameters, cb, isPromise);
};

MySQL.single = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeQuery('single', resource, query, parameters, cb, isPromise);
};

MySQL.scalar = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeQuery('scalar', resource, query, parameters, cb, isPromise);
};

MySQL.update = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeQuery('update', resource, query, parameters, cb, isPromise);
};

MySQL.insert = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeQuery('insert', resource, query, parameters, cb, isPromise);
};

MySQL.transaction = (
  queries: TransactionQuery,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeTransaction(resource, queries, parameters, cb, isPromise, config.transactionIsolation);
};

MySQL.startTransaction = (
  queryCb: (query: (sql: string, params?: CFXParameters) => Promise<any>) => Promise<boolean | void>,
  invokingResource?: string
) => {
  const resource = invokingResource || GetInvokingResource();
  return startTransaction(resource, queryCb);
};

MySQL.prepare = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeRaw(resource, query, parameters, cb, isPromise, true);
};

MySQL.rawExecute = (
  query: string,
  parameters: CFXParameters,
  cb?: CFXCallback,
  invokingResource?: string,
  isPromise?: boolean
) => {
  const resource = invokingResource || GetInvokingResource();
  executeRaw(resource, query, parameters, cb, isPromise, false);
};

MySQL.store = (query: string, cb: Function) => {
  cb(query);
};

MySQL.execute = MySQL.query;
MySQL.fetch = MySQL.query;

for (const key in MySQL) {
  const exp = MySQL[key];

  const asyncExp = (
    query: string,
    parameters: CFXParameters,
    invokingResource: string = GetInvokingResource()
  ) => {
    return new Promise((resolve, reject) => {
      MySQL[key](
        query,
        parameters,
        (result: unknown, err?: string) => {
          if (err) return reject(new Error(err));
          resolve(result);
        },
        invokingResource,
        true
      );
    });
  };

  global.exports(key, exp);
  global.exports(`${key}_async`, asyncExp);
  global.exports(`${key}Sync`, asyncExp);

  const oxAlias = key;
  provide('oxmysql', oxAlias, exp);
  provide('oxmysql', `${oxAlias}_async`, asyncExp);
  provide('oxmysql', `${oxAlias}Sync`, asyncExp);

  const ghmatti = ghmattimysqlAliases[key];
  if (ghmatti) {
    provide('ghmattimysql', ghmatti, exp);
    provide('ghmattimysql', `${ghmatti}Sync`, asyncExp);
  }

  const mysqlAsync = mysqlAsyncAliases[key];
  if (mysqlAsync) {
    provide('mysql-async', mysqlAsync, exp);
  }
}

setTimeout(async () => {
  if (!config.connectionString) {
    console.log('^1[swiftdb] mysql_connection_string is not set^0');
    return;
  }

  await initializePool(config);

  setInterval(refreshDebug, 1000);
}, 0);
