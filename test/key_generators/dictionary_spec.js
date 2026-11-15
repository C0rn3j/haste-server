/* global describe, it */

import assert from 'node:assert';

import fs from 'node:fs';

import Generator from '../../lib/key_generators/dictionary.js';

describe('DictionaryGenerator', function() {
  describe('options', function() {
    it('should throw an error if given no options', () => {
      assert.throws(() => {
        new Generator();
      }, Error);
    });

    it('should throw an error if given no path', () => {
      assert.throws(() => {
        new Generator({});
      }, Error);
    });
  });
  describe('generation', function() {
    it('should return a key of the proper number of words from the given dictionary', () => {
      const path = '/tmp/haste-server-test-dictionary';
      const words = ['cat'];
      fs.writeFileSync(path, words.join('\n'));

      const gen = new Generator({path}, () => {
        assert.equal('catcatcat', gen.createKey(3));
      });
    });
  });
});
