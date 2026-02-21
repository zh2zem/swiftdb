# swiftdb

High-performance MySQL resource for FiveM. Drop-in replacement for oxmysql, mysql-async, and ghmattimysql.

## Features

- Built on mysql2 with connection pooling and prepared statements
- LRU statement cache for named parameter conversion
- Backpressure control to prevent query queue overload
- Sampled MySQL profiler (server-side `SHOW PROFILES`)
- Slow query warnings
- Per-resource query log ring buffer
- Custom type casting (dates to unix ms, tinyint(1) to boolean, bit(1) to boolean)
- Hot-reloadable debug convar

## Requirements

- FiveM server build 12913+
- MySQL or MariaDB
- Node 22 (handled by FiveM)

## Installation

1. Download the [latest release](https://github.com/L1iith/swiftdb/releases)
2. Extract to your `resources/` directory
3. Add your connection string to `server.cfg`:

```cfg
set mysql_connection_string "mysql://root:password@localhost:3306/database"
ensure swiftdb
```

Remove any existing `ensure oxmysql`, `ensure mysql-async`, or `ensure ghmattimysql` — swiftdb provides all three.

## Building from source

```bash
bun install
bun run build
```

## API

Every method is available in three forms:
- `exports.swiftdb:method(query, params, callback)` — callback
- `exports.swiftdb:method_async(query, params)` — promise
- `exports.swiftdb:methodSync(query, params)` — promise (alias)

### Methods

| Method | Returns | Description |
|---|---|---|
| `query` | `table` | Execute query, returns all rows |
| `single` | `row/nil` | Returns first row only |
| `scalar` | `value/nil` | Returns first column of first row |
| `update` | `number` | Returns affected row count |
| `insert` | `number` | Returns last insert ID |
| `prepare` | `any` | True prepared statement via `conn.execute()` |
| `rawExecute` | `any` | Prepared statement, raw result (no type parsing) |
| `transaction` | `boolean` | Atomic multi-query transaction |
| `startTransaction` | `boolean/nil` | Interactive transaction with callback |

`execute` and `fetch` are aliases for `query`.

### Examples

```lua
-- Basic query
local users = exports.swiftdb:query_async('SELECT * FROM users WHERE age > ?', {18})

-- Single row
local user = exports.swiftdb:single_async('SELECT * FROM users WHERE id = ?', {1})

-- Scalar
local count = exports.swiftdb:scalar_async('SELECT COUNT(*) FROM users')

-- Insert
local id = exports.swiftdb:insert_async('INSERT INTO users (name) VALUES (?)', {'john'})

-- Update
local affected = exports.swiftdb:update_async('UPDATE users SET name = ? WHERE id = ?', {'jane', 1})

-- Named parameters
local user = exports.swiftdb:single_async('SELECT * FROM users WHERE id = :id', {id = 1})

-- Transaction
local success = exports.swiftdb:transaction_async({
    {'INSERT INTO users (name) VALUES (?)', {'alice'}},
    {'INSERT INTO users (name) VALUES (?)', {'bob'}},
})

-- Prepared statement with batched params
exports.swiftdb:prepare_async('INSERT INTO users (name) VALUES (?)', {{'alice'}, {'bob'}, {'charlie'}})
```

## Configuration

All convars have legacy aliases for oxmysql/mysql-async compatibility.

| Convar | Default | Description |
|---|---|---|
| `mysql_connection_string` | — | Connection URI or DSN string |
| `swift_debug` | `false` | Enable query logging. `true` for all, or JSON array of resource names |
| `swift_slow_query_warning` | `200` | Slow query threshold in ms |
| `swift_pool_size` | `10` | Max pooled connections |
| `swift_max_pending` | `100` | Max in-flight queries before rejecting |
| `swift_cache_size` | `500` | LRU statement cache capacity |
| `swift_profiler_sample_rate` | `20` | Profile every Nth query |
| `swift_transaction_isolation` | `2` | 1=REPEATABLE READ, 2=READ COMMITTED, 3=READ UNCOMMITTED, 4=SERIALIZABLE |
| `swift_log_size` | `100` | Per-resource log ring buffer size |
| `swift_ui` | `false` | Enable query logging for UI layer |

Legacy aliases: `mysql_debug`, `mysql_slow_query_warning`, `mysql_transaction_isolation_level`, `mysql_log_size`.

## Compatibility

swiftdb provides these resources automatically:

- **oxmysql** — all methods map 1:1
- **mysql-async** — `mysql_fetch_all`, `mysql_fetch_scalar`, `mysql_execute`, `mysql_insert`, `mysql_transaction`, `mysql_store`
- **ghmattimysql** — `execute`, `scalar`, `transaction`, `store`

Existing scripts using any of these libraries work without changes.

## License

[GPL-3.0](LICENSE)
