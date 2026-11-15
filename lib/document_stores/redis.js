import redis from 'redis';
import winston from 'winston';

// For storing in redis
// options[type] = redis
// options[host] - The host to connect to (default localhost)
// options[port] - The port to connect to (default 6379)
// options[db] - The db to use (default 0)
// options[expire] - The time to live for each key set (default never)
// options[password], options[user] - Optional authentication credentials
// options[url] - Optional Redis connection URL

var RedisDocumentStore = function(options, client) {
  this.expire = options.expire;
  if (client) {
    winston.info('using predefined redis client');
    RedisDocumentStore.connect(options, client);
  } else if (!RedisDocumentStore.client) {
    winston.info('configuring redis');
    RedisDocumentStore.connect(options);
  }
  this.client = RedisDocumentStore.client;
  this.ready = RedisDocumentStore.ready;
};

// Create a connection according to config
RedisDocumentStore.connect = function(options, client) {
  var connectionOptions = options.url ? { url: options.url } : {
    socket: {
      host: options.host || '127.0.0.1',
      port: Number(options.port || 6379)
    },
    database: Number(options.db || 0),
    password: options.password || undefined,
    username: options.user || undefined
  };
  client = client || redis.createClient(connectionOptions);
  client.on('error', function(error) {
    winston.error('redis disconnected', { error: error.message });
  });

  RedisDocumentStore.client = client;
  RedisDocumentStore.ready = client.isOpen ? Promise.resolve(client) : client.connect();
  // Handle connection errors even when callers use only the callback API
  RedisDocumentStore.ready.then(function() {
    winston.info('connected to redis');
  }, function(error) {
    winston.error('error connecting to redis', { error: error.message });
  });
  return RedisDocumentStore.ready;
};

// Save file in a key
RedisDocumentStore.prototype.set = function(key, data, callback, skipExpire) {
  var _this = this;
  this.ready.then(function() {
    return _this.client.set(key, data);
  }).then(function() {
    if (!skipExpire) {
      _this.setExpiration(key);
    }
    callback(true);
  }, function() {
    callback(false);
  });
};

// Expire a key in expire time if set
RedisDocumentStore.prototype.setExpiration = function(key) {
  if (this.expire) {
    var _this = this;
    return this.ready.then(function() {
      return _this.client.expire(key, Number(_this.expire));
    }).catch(function() {
      winston.error('failed to set expiry on key: ' + key);
    });
  }
};

// Get a file from a key
RedisDocumentStore.prototype.get = function(key, callback, skipExpire) {
  var _this = this;
  this.ready.then(function() {
    return _this.client.get(key);
  }).then(function(reply) {
    if (!skipExpire) {
      _this.setExpiration(key);
    }
    callback(reply);
  }, function() {
    callback(false);
  });
};

export default RedisDocumentStore;
