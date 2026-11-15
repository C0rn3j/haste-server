/* global describe, it */

import assert from 'node:assert';

import DocumentHandler from '../lib/document_handler.js';
import Generator from '../lib/key_generators/random.js';

describe('document_handler', function() {

  describe('randomKey', function() {

    it('should choose a key of the proper length', function() {
      var gen = new Generator();
      var dh = new DocumentHandler({ keyLength: 6, keyGenerator: gen });
      assert.equal(6, dh.acceptableKey().length);
    });

    it('should choose a default key length', function() {
      var gen = new Generator();
      var dh = new DocumentHandler({ keyGenerator: gen });
      assert.equal(dh.keyLength, DocumentHandler.defaultKeyLength);
    });

  });

});
