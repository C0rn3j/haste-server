/* global it, describe, beforeEach, afterEach */
const assert = require('assert');
const { randomUUID } = require('crypto');
const redis = require('redis');
const winston = require('winston');
const Store = require('../lib/document_stores/redis');

winston.configure({ transports: [], silent: true });

function options(extra = {}) {
  return {
    host: process.env.REDIS_TEST_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_TEST_PORT || 6379),
    password: process.env.REDIS_TEST_PASSWORD,
    ...extra
  };
}

function connectionUrl(database) {
  const config = options();
  const url = new URL('redis://127.0.0.1');
  url.hostname = config.host;
  url.port = String(config.port);
  url.password = config.password || '';
  url.pathname = '/' + database;
  return url.toString();
}

const set = (store, key, value, skipExpire) => new Promise(resolve => store.set(key, value, resolve, skipExpire));
const get = (store, key, skipExpire) => new Promise(resolve => store.get(key, resolve, skipExpire));

describe('redis_document_store', function() {
  this.timeout(10000);
  let keys;
  function key() {
    const value = 'haste-test-' + randomUUID();
    keys.push(value);
    return value;
  }

  beforeEach(function() {
    keys = [];
  });

  afterEach(async function() {
    const client = Store.client;
    try {
      if (Store.ready) { await Store.ready.catch(() => {}); }
      if (client && client.isReady && keys.length) { await client.del(keys); }
    } finally {
      if (client && client.isOpen) { await client.close(); }
      Store.client = undefined;
      Store.ready = undefined;
    }
  });

  it('queues a write until connected, reads UTF-8 data, and applies expiration', async function() {
    const store = new Store(options({ expire: 10 }));
    const id = key();
    assert.strictEqual(await set(store, id, 'paste: café €'), true);
    assert.strictEqual(await get(store, id), 'paste: café €');
    assert.ok(await store.client.ttl(id) > 1);
  });

  it('does not expire static documents', async function() {
    const store = new Store(options({ expire: 10 }));
    const id = key();
    assert.strictEqual(await set(store, id, 'paste', true), true);
    assert.strictEqual(await store.client.ttl(id), -1);
  });

  it('does not expire documents when expiration is disabled', async function() {
    const store = new Store(options({ expire: false }));
    const id = key();
    assert.strictEqual(await set(store, id, 'paste'), true);
    assert.strictEqual(await store.client.ttl(id), -1);
  });

  it('refreshes expiration when reading a document', async function() {
    const store = new Store(options({ expire: 10 }));
    const id = key();
    await set(store, id, 'paste');
    await store.client.expire(id, 2);
    assert.strictEqual(await get(store, id), 'paste');
    assert.ok(await store.client.ttl(id) > 2);
  });

  it('does not refresh expiration while checking a key', async function() {
    const store = new Store(options({ expire: 10 }));
    const id = key();
    await set(store, id, 'paste');
    await store.client.expire(id, 2);
    assert.strictEqual(await get(store, id, true), 'paste');
    const ttl = await store.client.ttl(id);
    assert.ok(ttl > 0 && ttl <= 2);
  });

  it('returns null for a missing key', async function() {
    const store = new Store(options());
    assert.strictEqual(await get(store, key()), null);
  });

  it('accepts numeric settings supplied as strings', async function() {
    const store = new Store(options({ port: String(options().port), db: '2', expire: '10' }));
    const id = key();
    assert.strictEqual(await set(store, id, 'paste'), true);
    assert.ok(await store.client.ttl(id) > 1);
    assert.match(await store.client.sendCommand(['CLIENT', 'INFO']), /\bdb=2\b/);
  });

  it('connects using a native URL and selects its database', async function() {
    const store = new Store({ url: connectionUrl(3) });
    const id = key();
    assert.strictEqual(await set(store, id, 'URL paste'), true);
    assert.strictEqual(await get(store, id), 'URL paste');
    assert.match(await store.client.sendCommand(['CLIENT', 'INFO']), /\bdb=3\b/);
  });

  it('accepts an already connected Redis 6 client', async function() {
    const client = redis.createClient({ url: connectionUrl(5) });
    client.on('error', () => {});
    await client.connect();
    const store = new Store({ expire: false }, client);
    const id = key();
    assert.strictEqual(await set(store, id, 'injected client'), true);
    assert.strictEqual(await get(store, id), 'injected client');
  });

  it('reports command failures through the existing false callbacks', async function() {
    const store = new Store(options());
    await store.ready;
    store.client.destroy();
    assert.strictEqual(await set(store, key(), 'paste'), false);
    assert.strictEqual(await get(store, key()), false);
  });

  it('reports connection failures without unhandled rejections', async function() {
    const url = new URL(connectionUrl(0));
    url.password = 'incorrect-' + randomUUID();
    const client = redis.createClient({ url: url.toString(), socket: { reconnectStrategy: false } });
    const store = new Store({}, client);
    await assert.rejects(store.ready, /AUTH|password/i);
    assert.strictEqual(await set(store, key(), 'paste'), false);
    assert.strictEqual(await get(store, key()), false);
  });
});
