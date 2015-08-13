var enums = require('./enums');
var lexer = require('gonzales-pe');
var isNumber = require('is-number');

var isFileLevelCommentDelimeter = function(node, index) {
  if (node && node.content === '//') {
    return index;
  }
  return false;
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

/**
 * Turn an array of AST nodes into JSON.
 */
var parseCommentNodes = function(nodes) {
  var lines = [];
  var start;
  var end;

  // Create a parent node
  ast = lexer.createNode({
    type: 'multilineComment',
    content: nodes,
    syntax: enums.SYNTAX,
  });

  start = ast.first().start;
  end = ast.last().end;

  ast.forEach(enums.COMMENT_TYPE, function(node) {
    var content = removeInitialSlashes(node.content).trim();

    if (content.length > 0) {
      lines.push(content);
    }
  });

  return parseCommentLines(lines, start, end);
};

/**
 * Returns an object of an annotation for a line in an SCSS comment.
 */
var parseCommentLines = function(lines, start, end) {
  // Track if an annotation has already been found in the comment nodes. This
  // means that the following lines that don't look like annotations will be
  // treated as new lines in the previous annotation, not part of the
  // description.
  var hasFoundAnnotation = false;
  // Track the most recent annotation for multiline annotations.
  var mostRecentAnnotation = null;
  // Default annotations
  var obj = {
    'name': '',
    'description': '',
    'start': start,
    'end': end,
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
      // Annotation is a name
      obj['name'] += lines[i] + '\n';
    }
  }

  return obj;
}

var getFileLevelCommentNodes = function(ast) {
  var indexes = [];
  var commentStart = null;
  var commentEnd = null;
  var commentNumberOfLines = null;
  var commentNodes = [];
  var properties = {};

  ast.forEach(enums.COMMENT_TYPE, function(node, index) {
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

var getFileLevelJSON = function(ast) {
  var nodes = getFileLevelCommentNodes(ast);
  var json = parseCommentNodes(nodes);

  return json;
}

/**
 * @param {Object[]} files - Files that need processing.
 * @param {string} files[].path - Path to the file.
 * @param {string} files[].ast - The file's AST.
 * @param {next} next
 */
module.exports = function(files, next) {
  for (var i = 0; i < files.length; i++) {
    var ast = files[i].ast;

    files[i].json = getFileLevelJSON(ast);
  }

  next(null, files);
}
