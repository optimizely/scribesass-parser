var async = require('async');
var fileImporter = require('file-importer');
var fs = require('fs');
var glob = require('glob');
var isNumber = require('is-number');
var lexer = require('gonzales-pe');
var sass = require('node-sass');
var shell = require('shelljs');
var util = require('util');

var COMMENT_TYPE = 'singlelineComment';
var SYNTAX = 'scss';

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

var getJSON = function(ast, next) {
  var fileLevelJSON = getFileLevelJSON(ast);

  next(null, fileLevelJSON);
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

var scssToAST = function(scss, next) {
  var ast = lexer.parse(scss, {
    syntax: SYNTAX,
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

var followImports = function(scss, base, next) {
  var options = {
    data: scss,
    cwd: base,
  }

  fileImporter.parse(options, function(err, fullSCSS) {
    next(err, fullSCSS);
  });
}

var removeInitialSlashes = function(str) {
  while(str.match('^/')) {
    str = str.substring(1);
  };

  return str;
};

var dd = function(obj) {
  var expandedObj = obj;
  if (obj !== null && typeof obj === 'object') {
    expandedObj = util.inspect(obj, false, null);
  }
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
    getJSON,
  ], function(err, result) {
    if (err) {
      dd(err);
    }

    dd(result);
  });
}

module.exports('node_modules/optimizely-lego/src/core/');
