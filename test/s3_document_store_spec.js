/* global describe, it, before */
import assert from 'node:assert';
let Store;

describe('S3 document store', function() {
  before(async function() {
    try {
      import.meta.resolve('@aws-sdk/client-s3');
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND') { throw error; }
      this.skip();
    }
    Store = (await import('../lib/document_stores/amazon-s3.js')).default;
  });
  it('decodes SDK v3 streaming bodies', function(done) {
    const store = new Store({bucket: 'test', region: 'eu-central-1'});
    store.client.send = async command => {
      assert.equal(command.input.Key, 'key');
      return {Body: {transformToString: async () => 'paste'}};
    };
    store.get('key', value => { assert.equal(value, 'paste'); done(); });
  });
  it('reports streaming body errors as storage failures', function(done) {
    const store = new Store({bucket: 'test', region: 'eu-central-1'});
    store.client.send = async () => ({Body: {transformToString: async () => { throw Error('read failed'); }}});
    store.get('key', value => { assert.equal(value, false); done(); });
  });
  it('writes text with the expected content type', function(done) {
    const store = new Store({bucket: 'test', region: 'eu-central-1'});
    store.client.send = async command => {
      assert.equal(command.input.Body, 'paste');
      assert.equal(command.input.ContentType, 'text/plain');
    };
    store.set('key', 'paste', success => { assert.equal(success, true); done(); });
  });
});
