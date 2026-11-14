const fs = require('fs');
const path = require('path');
const uglify = require('uglify-js');

const directory = path.join(__dirname, '..', 'static');
const jquery = path.join(path.dirname(require.resolve('jquery')), 'jquery.min.js');
fs.copyFileSync(jquery, path.join(directory, 'jquery.min.js'));

for (const file of fs.readdirSync(directory)) {
  if (!file.endsWith('.js') || file.endsWith('.min.js')) { continue; }
  const result = uglify.minify(fs.readFileSync(path.join(directory, file), 'utf8'));
  if (result.error) { throw result.error; }
  fs.writeFileSync(path.join(directory, file.replace(/\.js$/, '.min.js')), result.code);
}
