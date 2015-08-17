var dd = require('./utils').dd;
var enums = require('./enums');
var lexer = require('gonzales-pe');
var isNumber = require('is-number');
var indexOf = require('lodash').indexOf;

var isFileLevelCommentDelimeter = function(node, index) {
  // Really means that the line's content is four slashes.
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

  // Track the line information.
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

/**
 * Returns the nodes between the last file level delimiters in a file.
 */
var getFileLevelCommentNodes = function(ast) {
  // The node indexes for the file level comment delimiters.
  var indexes = [];

  // Tracks the number of lines of a comment.
  var commentStart = null;
  var commentEnd = null;
  var commentNumberOfLines = null;

  // The nodes between the file level delimiters.
  var commentNodes = [];

  // Loop through all of the comment nodes to see which ones
  // are file level delimiters.
  ast.forEach(enums.COMMENT_TYPE, function(node, index) {
    var currentIndex = isFileLevelCommentDelimeter(node, index);

    if (isNumber(currentIndex)) {
      indexes.push(currentIndex);
    }
  });

  // Grabs the last file-level delimiters.
  commentStart = indexes[indexes.length - 2];
  commentEnd = indexes[indexes.length - 1];
  commentNumberOfLines = commentEnd - commentStart;

  // Grab the relevant comments from the AST.
  for (var i = commentStart; i < commentEnd + 1; i++) {
    commentNodes.push(ast.get(i));
  }

  return commentNodes;
};

var getFileContentCommentNodes = function(ast) {
  var fileLevelCommentNodes = getFileLevelCommentNodes(ast);

  // Loop through all of the comment nodes.
  ast.forEach(enums.COMMENT_TYPE, function(node, index) {
    // Comments that are not part of the file-level comments.
    if (indexOf(fileLevelCommentNodes, node) === -1) {

    }
  });
};

/**
 * Call functions that get the JSON for the file-level comments.
 */
var getFileLevelJSON = function(ast) {
  var nodes = getFileLevelCommentNodes(ast);
  var json = parseCommentNodes(nodes);

  return json;
}

/**
 * Call functions that get the JSON for the file contents.
 */
var getFileContentsJSON = function(ast) {
  var nodes = getFileContentCommentNodes(ast);
  // var json = parseCommentNodes(nodes);

  return undefined;
}

/**
 * @param {Object[]} files - Files that need processing.
 * @param {string} files[].path - Path to the file.
 * @param {string} files[].ast - The file's AST.
 * @param {string} files[].scss - The file's SCSS.
 * @param {next} next
 */
module.exports = function(files, next) {
  for (var i = 0; i < files.length; i++) {
    var ast = files[i].ast;

    files[i].annotations = getFileLevelJSON(ast);
    files[i].annotations.content = getFileContentsJSON(ast);
  }

  next(null, files);
}
