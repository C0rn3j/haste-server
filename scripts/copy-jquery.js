const fs = require('fs');
const path = require('path');

const source = path.join(path.dirname(require.resolve('jquery')), 'jquery.min.js');
const destination = path.join(__dirname, '..', 'static', 'jquery.min.js');
fs.copyFileSync(source, destination);
