var async = require('async');
var dd = require('./lib/utils').dd;
var fs = require('fs');
var glob = require('glob');
var imports = require('./lib/imports');
var isNumber = require('is-number');
var lexer = require('gonzales-pe');
var sass = require('node-sass');
var shell = require('shelljs');

var COMMENT_TYPE = 'singlelineComment';
var SYNTAX = 'scss';

var getFile = function(file) {
  return fs.readFileSync(file, { encoding: 'utf-8' });
}

var getFileLevelCommentNodes = function(ast) {
  var indexes = [];
  var commentStart = null;
  var commentEnd = null;
  var commentNumberOfLines = null;
  var commentNodes = [];
  var properties = {};

  ast.forEach(COMMENT_TYPE, function(node, index) {
    var currentIndex = isFileLevelCommentDelimeter(node, index);

    if (isNumber(currentIndex)) {
      indexes.push(currentIndex);
    }
  });

  commentStart = indexes[indexes.length - 2];
  commentEnd = indexes[indexes.length - 1];
  commentNumberOfLines = commentEnd - commentStart;

  for (var i = commentStart; i < commentEnd + 1; i++) {
    commentNodes.push(ast.get(i));
  }

  return commentNodes;
};

/**
 * @param {Object[]} files - Files that need processing.
 * @param {string} files[].path - Path to the file.
 * @param {string} files[].ast - The file's AST.
 * @param {next} next
 */
var getJSON = function(files, next) {
  for (var i = 0; i < files.length; i++) {
    var ast = files[i].ast;

    files[i].json = getFileLevelJSON(ast);
  }

  next(null, files);
}

var getFileLevelJSON = function(ast) {
  var nodes = getFileLevelCommentNodes(ast);
  var json = parseCommentNodes(nodes);

  return json;
}

var isFileLevelCommentDelimeter = function(node, index) {
  if (node && node.content === '//') {
    return index;
  }
  return false;
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
      syntax: SYNTAX,
    });

    arr.push({
      path: file,
      ast: ast,
      scss: scss,
    });
  }

  next(null, arr);
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
 * Turn an array of AST nodes into JSON.
 */
var parseCommentNodes = function(nodes) {
  var lines = [];

  // Create a parent node
  ast = lexer.createNode({
    type: 'multilineComment',
    content: nodes,
    syntax: SYNTAX,
  });

  ast.forEach(COMMENT_TYPE, function(node) {
    var content = removeInitialSlashes(node.content).trim();

    if (content.length > 0) {
      lines.push(content);
    }
  });

  return parseCommentLines(lines);
};

/**
 * Returns an object of an annotation for a line in an SCSS comment.
 */
var parseCommentLines = function(lines) {
  // Track if an annotation has already been found in the comment nodes. This
  // means that the following lines that don't look like annotations will be
  // treated as new lines in the previous annotation, not part of the
  // description.
  var hasFoundAnnotation = false;
  // Track the most recent annotation for multiline annotations.
  var mostRecentAnnotation = null;
  // Default annotations
  var obj = {
    'description': '',
  };

  for (var i = 0; i < lines.length; i++) {
    var annotation = null;

    if (lines[i].match('^@')) {
      // New annotation is starting
      annotation = parseAnnotation(lines[i]);
      obj[annotation[0]] = annotation[1];

      hasFoundAnnotation = true;
      mostRecentAnnotation = annotation[0];
    } else if (hasFoundAnnotation) {
      // Annotation continues onto a new line
      obj[mostRecentAnnotation] += '\n' + lines[i];
    } else {
      // Annotation is a description
      obj['description'] += lines[i] + '\n';
    }
  }

  return obj;
}

var parseAnnotation = function(string) {
  var arr = [];
  // http://rubular.com/r/WVGkWpFVD9
  var match = /^@(\w+)\s?(.*)?/.exec(string);

  arr.push(match[1]);
  arr.push(match[2]);

  return arr;
}

var removeInitialSlashes = function(str) {
  while(str.match('^/')) {
    str = str.substring(1);
  };

  return str;
};

module.exports = function(file) {
  // 1. Return main Sass file's path and see if it is valid.
  // 2. Return an array of all of the imported files based on source order.
  // 3. Return the an array with the path and AST of each file.
  // 4. Turn that info JSON.
  async.waterfall([
    isSassValid.bind(this, file),
    imports,
    scssToAST,
    getJSON,
  ], function(err, result) {
    if (err) {
      dd(err);
    }

    console.log(result);
  });
}

module.exports('node_modules/optimizely-lego/src/core/core.scss');
