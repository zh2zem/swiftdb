local Await = Citizen.Await
local resource = GetCurrentResourceName()
local db = exports.swiftdb

---@param method string
---@param query string|table
---@param params? table
---@return any result
local function awaitMethod(method, query, params)
    local p = promise.new()

    db[method](nil, query, params, function(result, err)
        if err then return p:reject(err) end
        p:resolve(result)
    end, resource, true)

    return Await(p)
end

---@param query string|table
---@param params any
---@param cb any
---@param isTransaction? boolean
---@return string|table query
---@return table? params
---@return function? cb
local function parseArgs(query, params, cb, isTransaction)
    if isTransaction then
        assert(type(query) == 'table', ('Expected table for transaction, got %s'):format(type(query)))
    else
        assert(type(query) == 'string', ('Expected string for query, got %s'):format(type(query)))
    end

    if type(params) == 'function' or (type(params) == 'table' and params.__cfx_functionReference) then
        cb = params
        params = nil
    end

    return query, params, cb
end

---@param method string
---@param isTransaction? boolean
---@return table
local function createMethod(method, isTransaction)
    return setmetatable({
        await = function(query, params)
            query, params = parseArgs(query, params, nil, isTransaction)
            return awaitMethod(method, query, params)
        end,
    }, {
        __call = function(_, query, params, cb)
            query, params, cb = parseArgs(query, params, cb, isTransaction)
            db[method](nil, query, params, cb, resource)
        end,
    })
end

MySQL = MySQL or {}

MySQL.query       = createMethod('query')
MySQL.single      = createMethod('single')
MySQL.scalar      = createMethod('scalar')
MySQL.insert      = createMethod('insert')
MySQL.update      = createMethod('update')
MySQL.prepare     = createMethod('prepare')
MySQL.rawExecute  = createMethod('rawExecute')
MySQL.transaction = createMethod('transaction', true)

MySQL.Async = {}
MySQL.Sync = {}

local aliases = {
    fetchAll    = 'query',
    fetchScalar = 'scalar',
    fetchSingle = 'single',
    execute     = 'update',
    insert      = 'insert',
    transaction = 'transaction',
    prepare     = 'prepare',
}

for alias, method in pairs(aliases) do
    MySQL.Async[alias] = MySQL[method]
    MySQL.Sync[alias]  = MySQL[method].await
end

local function onReady(cb)
    while GetResourceState('swiftdb') ~= 'started' do
        Wait(50)
    end

    db:awaitConnection()

    if cb then return cb() end
    return true
end

MySQL.ready = setmetatable({
    await = onReady,
}, {
    __call = function(_, cb)
        Citizen.CreateThreadNow(function() onReady(cb) end)
    end,
})

_ENV.MySQL = MySQL
