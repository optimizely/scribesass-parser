var async = require('async');
var dd = require('./lib/utils').dd;
var enums = require('./lib/enums');
var fs = require('fs');
var glob = require('glob');
var lexer = require('gonzales-pe');
var imports = require('./lib/imports');
var parse = require('./lib/parse');
var sass = require('node-sass');
var shell = require('shelljs');

var getFile = function(file) {
  return fs.readFileSync(file, { encoding: 'utf-8' });
}

/**
 * Compile the SCSS to see if there are any errors in the source that
 * could prevent this from working.
 */
var isSassValid = function(file, next) {
  sass.render({
    file: file,
  }, function(err, result) {
    next(err, file);
  });
}

/**
 * Take an array of files and returns an array that contains the file path
 * and an AST.
 */
var scssToAST = function(files, next) {
  var arr = [];

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var scss = getFile(file);
    var ast = lexer.parse(scss, {
      syntax: enums.SYNTAX,
    });

    arr.push({
      path: file,
      ast: ast,
      scss: scss,
    });
  }

  next(null, arr);
}

module.exports = function(file) {
  // 1. Return main Sass file's path and see if it is valid.
  // 2. Return an array of all of the imported files based on source order.
  // 3. Return the an array with the path and AST of each file.
  // 4. Turn that info JSON.
  async.waterfall([
    isSassValid.bind(this, file),
    imports,
    scssToAST,
    parse,
  ], function(err, result) {
    if (err) {
      dd(err);
    }

    console.log(result);
  });
}

module.exports('node_modules/optimizely-lego/src/core/core.scss');
