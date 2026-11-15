#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import uglify from 'uglify-js';
import winston from 'winston';
import express from 'express';
import connect_st from 'st';
import { rateLimit } from 'express-rate-limit';

import DocumentHandler from './lib/document_handler.js';

// Load the configuration and set some defaults
const configPath = process.argv.length <= 2
  ? path.join(import.meta.dirname, 'config.js')
  : path.resolve(process.argv[2]);
const configDirectory = path.dirname(configPath);
const staticDirectory = path.join(import.meta.dirname, 'static');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.port = process.env.PORT || config.port || 7777;
config.host = process.env.HOST || config.host || 'localhost';

// Set up the logger
const transports = (config.logging || [{ type: 'Console' }]).map(detail => {
  const { type, colorize, json, timestamp, ...options } = detail;
  const formats = [winston.format.errors({ stack: true })];
  if (timestamp) {
    formats.push(winston.format.timestamp({
      format: typeof timestamp === 'function' ? timestamp : undefined
    }));
  }
  if (json === true || (json === undefined && type !== 'Console')) {
    formats.push(winston.format.json());
  } else {
    if (colorize) { formats.push(winston.format.colorize()); }
    formats.push(winston.format.simple());
  }
  return new winston.transports[type]({
    ...options,
    format: winston.format.combine(...formats)
  });
});

winston.configure({ transports, silent: transports.length === 0 });

// build the store from the config on-demand - so that we don't load it
// for statics
if (!config.storage) {
  config.storage = { type: 'file' };
}
if (!config.storage.type) {
  config.storage.type = 'file';
}

var Store, preferredStore;

if (process.env.REDISTOGO_URL && config.storage.type === 'redis') {
  var redisClient = (await import('redis')).createClient({ url: process.env.REDISTOGO_URL });
  Store = (await import('./lib/document_stores/redis.js')).default;
  preferredStore = new Store(config.storage, redisClient);
}
else {
  Store = (await import('./lib/document_stores/' + config.storage.type + '.js')).default;
  preferredStore = new Store(config.storage);
}

// Compress the static javascript assets
if (config.recompressStaticAssets) {
  var list = fs.readdirSync(staticDirectory);
  for (var j = 0; j < list.length; j++) {
    var item = list[j];
    if ((item.indexOf('.js') === item.length - 3) && (item.indexOf('.min.js') === -1)) {
      var dest = item.substring(0, item.length - 3) + '.min' + item.substring(item.length - 3);
      var orig_code = fs.readFileSync(path.join(staticDirectory, item), 'utf8');

      var compressed = uglify.minify(orig_code);
      if (compressed.error) { throw compressed.error; }
      fs.writeFileSync(path.join(staticDirectory, dest), compressed.code, 'utf8');
      winston.info('compressed ' + item + ' into ' + dest);
    }
  }
}

// Send the static documents into the preferred store, skipping expirations
var documentPath, data;
for (var name in config.documents) {
  documentPath = path.resolve(configDirectory, config.documents[name]);
  data = fs.readFileSync(documentPath, 'utf8');
  winston.info('loading static document', { name: name, path: documentPath });
  if (data) {
    preferredStore.set(name, data, function(cb) {
      winston.debug('loaded static document', { success: cb });
    }, true);
  }
  else {
    winston.warn('failed to load static document', { name: name, path: documentPath });
  }
}

// Pick up a key generator
var pwOptions = config.keyGenerator || {};
pwOptions.type = pwOptions.type || 'random';
if (pwOptions.path) {
  pwOptions.path = path.resolve(configDirectory, pwOptions.path);
}
var gen = (await import('./lib/key_generators/' + pwOptions.type + '.js')).default;
var keyGenerator = new gen(pwOptions);

// Configure the document handler
var documentHandler = new DocumentHandler({
  store: preferredStore,
  maxLength: config.maxLength,
  keyLength: config.keyLength,
  keyGenerator: keyGenerator
});

var app = express();
app.set('case sensitive routing', true);

// Rate limit all requests
if (config.rateLimits) {
  const options = config.rateLimits;
  const categories = options.categories || options.catagories || {};
  const defaults = {
    normal: { totalRequests: 500, every: 60 * 60 * 1000 },
    whitelist: { totalRequests: 5000, every: 60 * 60 * 1000 },
    blacklist: { totalRequests: 0, every: 1 }
  };
  const clientName = request => request.headers['x-forwarded-for'] || request.socket.remoteAddress;
  const limiters = {};
  for (const type of Object.keys(defaults)) {
    const category = { ...defaults[type], ...categories[type] };
    limiters[type] = rateLimit({
      windowMs: Math.max(1, category.every),
      limit: category.totalRequests,
      keyGenerator: clientName,
      // A zero limit intentionally blocks every request in this category
      validate: { limit: false },
      handler: (request, response) => {
        response.writeHead(429, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Rate limit exceded.');
      }
    });
  }
  app.use(function(request, response, next) {
    const name = clientName(request);
    const type = (options.whitelist || []).includes(name) ? 'whitelist'
      : (options.blacklist || []).includes(name) ? 'blacklist' : 'normal';
    return limiters[type](request, response, next);
  });
}

// first look at API calls
// get raw documents - support getting with extension

app.get('/raw/:id', function(request, response) {
  return documentHandler.handleRawGet(request, response, config);
});

app.head('/raw/:id', function(request, response) {
  return documentHandler.handleRawGet(request, response, config);
});

// add documents

app.post('/documents', function(request, response) {
  return documentHandler.handlePost(request, response);
});

// get documents
app.get('/documents/:id', function(request, response) {
  return documentHandler.handleGet(request, response, config);
});

app.head('/documents/:id', function(request, response) {
  return documentHandler.handleGet(request, response, config);
});

// Otherwise, try to match static files
app.use(connect_st({
  path: staticDirectory,
  content: { maxAge: config.staticMaxAge },
  passthrough: true,
  index: false
}));

// Then we can loop back - and everything else should be a token,
// so route it back to /
app.get('/:id', function(request, response, next) {
  request.sturl = '/';
  next();
});

// And match index
app.use(connect_st({
  path: staticDirectory,
  content: { maxAge: config.staticMaxAge },
  index: 'index.html'
}));

http.createServer(app).listen(config.port, config.host);

winston.info('listening on ' + config.host + ':' + config.port);
