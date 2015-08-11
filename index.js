var async = require('async');
var glob = require('glob');
var shell = require('shelljs');
var fs = require('fs');
var lexer = require('gonzales-pe');
var fileImporter = require('file-importer');
var sass = require('node-sass');
var util = require('util');

var concatFiles = function(files, base, next) {
  var text = '';

  for (var i = 0; i < files.length; i++) {
    text += fs.readFileSync(files[i], { encoding: 'utf-8' });
  }

  next(null, text, base);
}

var getFiles = function(pattern, options, base, next) {
  glob(base + pattern, options, function(err, files) {
    next(err, files, base);
  });
}

var scssToAST = function(scss, next) {
  var ast = lexer.parse(scss, {
    syntax: 'scss',
  });

  next(null, ast);
}

var isSassValid = function(scss, base, next) {
  sass.render({
    includePaths: [base],
    data: scss,
  }, function(err, result) {
    next(err, scss, base);
  });
}

var followImports = function(scss, base, next) {
  var options = {
    data: scss,
    cwd: base,
  }

  fileImporter.parse(options, function(err, fullSCSS) {
    next(err, fullSCSS);
  });
}

var dd = function(obj) {
  var expandedObj = util.inspect(obj, false, null);
  console.log(expandedObj);
}

module.exports = function(base) {
  var ast = {};
  var globPattern = '**/core.scss';
  var globOptions = {
    cwd: shell.pwd(),
    matchBase: true,
  }

  async.waterfall([
    getFiles.bind(this, globPattern, globOptions, base),
    concatFiles,
    isSassValid,
    followImports,
    scssToAST,
  ], function(err, result) {
    if (err) {
      dd(err);
    }

    dd(result);
  });
}

module.exports('node_modules/optimizely-lego/src/core/');
