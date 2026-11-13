/*global require,module,process*/

var { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
var winston = require('winston');

var AmazonS3DocumentStore = function(options) {
  this.expire = options.expire;
  this.bucket = options.bucket;
  this.client = new S3Client({region: options.region});
};

AmazonS3DocumentStore.prototype.get = function(key, callback, skipExpire) {
  var _this = this;

  var req = {
    Bucket: _this.bucket,
    Key: key
  };

  _this.client.send(new GetObjectCommand(req)).then(function(data) {
    return data.Body.transformToString('utf-8');
  }).then(function(value) {
    callback(value);
    if (_this.expire && !skipExpire) {
      winston.warn('amazon s3 store cannot set expirations on keys');
    }
  }, function() { callback(false); });
}

AmazonS3DocumentStore.prototype.set = function(key, data, callback, skipExpire) {
  var _this = this;

  var req = {
    Bucket: _this.bucket,
    Key: key,
    Body: data,
    ContentType: 'text/plain'
  };

  _this.client.send(new PutObjectCommand(req)).then(function() {
    callback(true);
    if (_this.expire && !skipExpire) {
      winston.warn('amazon s3 store cannot set expirations on keys');
    }
  }, function() { callback(false); });
}

module.exports = AmazonS3DocumentStore;
