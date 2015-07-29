var glob = require('glob');
var shell = require('shelljs');

module.exports = function(base) {
  console.log('Automatically generate documentation for Sass files.');

  base = base || '';

  options = {
    cwd: shell.pwd(),
    debug: true,
    matchBase: true,
  }

  var files = glob.sync(base + '**/!(_)*.scss', options);
  console.log(files);
}
