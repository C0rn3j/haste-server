const { randomInt } = require('crypto');

// Draws inspiration from pwgen and http://tools.arantius.com/password

const randOf = (collection) => {
  return () => {
    return collection[randomInt(collection.length)];
  };
};

// Helper methods to get an random vowel or consonant
const randVowel = randOf('aeiou');
const randConsonant = randOf('bcdfghjklmnpqrstvwxyz');

module.exports = class PhoneticKeyGenerator {

  // Generate a phonetic key of alternating consonant & vowel
  createKey(keyLength) {
    let text = '';
    const start = randomInt(2);

    for (let i = 0; i < keyLength; i++) {
      text += (i % 2 == start) ? randConsonant() : randVowel();
    }

    return text;
  }

};
