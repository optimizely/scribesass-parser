var async = require('async');
var dd = require('./lib/utils').dd;
var enums = require('./lib/enums');
var fs = require('fs');
var glob = require('glob');
var lexer = require('gonzales-pe');
var imports = require('./lib/imports');
var parse = require('./lib/parse');
var files = require('./lib/files');
var sass = require('node-sass');
var shell = require('shelljs');

var getFile = function(file) {
  return fs.readFileSync(file, { encoding: 'utf-8' });
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
    });
  }

  next(null, arr);
}

module.exports = {
  create: function(file, next) {
    // 1. Return main Sass file's path and see if it is valid.
    // 2. Return an array of all of the imported files based on source order.
    // 3. Return an array with the path and AST of each file.
    async.waterfall([
      imports.bind(this, file),
      scssToAST,
    ], next);
  },
  getScss: function(ast, removeAnnotations) {
    if (removeAnnotations) {
      ast = parse.removeASTAnnotations(ast);
    }
    return ast.toString();
  },
  getComments: function(ast) {
    return parse.getComments(ast);
  },
  getGroups: function(filesArray) {
    return files.getGroups(filesArray);
  },
  getFileProperties: function(ast) {
    return parse.getFileProperties(ast);
  },
}

// // For debugging purposes:
// module.exports.create('test/test.scss', function(err, files) {
//   console.log(files);
//   dd(files[0].path);
//   dd(module.exports.getScss(files[0].ast));
//   dd(module.exports.getScss(files[0].ast, true));
//   dd(module.exports.getComments(files[0].ast));
//   dd(module.exports.getFileProperties(files[0].ast));
//   dd(module.exports.getGroups(files));
// });
