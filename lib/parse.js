var dd = require('./utils').dd;
var enums = require('./enums');
var lexer = require('gonzales-pe');
var isNumber = require('is-number');
var indexOf = require('lodash').indexOf;
var startsWith = require('lodash').startsWith;
var cloneDeep = require('lodash').cloneDeep;

var DEFAULT_ANNOTATIONS = {
  'name': '',
  'description': '',
};

var isFileLevelCommentDelimeter = function(node, index) {
  // Really means that the line's content is four slashes.
  if (node && node.content === '//') {
    return index;
  }
  return false;
}

/**
 * Return a node's index if it begins with three slashes.
 */
var isContentCommentDelimeter = function(node, index) {
  if (node && node.content && startsWith(node.content, '/')) {
    return index;
  }
  return false;
}

/**
 * Return true if a node is in an AST.
 */
var isNodeInAST = function(node, ast) {
  return indexOf(ast, node) !== -1;
}

var parseAnnotationLabel = function(string) {
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
  start = ast.first() && ast.first().start;
  end = ast.last() && ast.last().end;

  ast.forEach(enums.COMMENT_TYPE, function(node) {
    var content = removeInitialSlashes(node.content).trim();

    if (content.length > 0) {
      lines.push(content);
    }
  });

  return parseCommentLines(lines, start, end);
};

var parseExampleAnnotation = function(value) {
  var obj = {
    'language': null,
    'description': null,
    'code': null,
  };

  var re = /^(.*?)\s-\s(.*?)\n([^]*)/;
  var result = re.exec(value);

  obj['language'] = result[1];
  obj['description'] = result[2];
  obj['code'] = result[3];

  return obj;
}

/**
 * Returns an object of an annotations for a Sass comment block.
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
  var obj = cloneDeep(DEFAULT_ANNOTATIONS);
  obj['start'] = start;
  obj['end'] = end;

  for (var i = 0; i < lines.length; i++) {
    var annotation = null;

    if (lines[i].match('^@')) {
      // New annotation is starting
      annotation = parseAnnotationLabel(lines[i]);
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

  // Some annotations need to be further parsed. See if they exist then parse
  // them.
  if (obj['example']) {
    obj['example'] = parseExampleAnnotation(obj['example']);
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

/**
 * Return all of the comment nodes that are not file-level.
 */
var getContentCommentNodes = function(ast) {
  var fileLevelCommentNodes = getFileLevelCommentNodes(ast);
  var nodes = [];

  // Loop through all of the comment nodes.
  ast.forEach(enums.COMMENT_TYPE, function(node, index) {
    // Comments that are not part of the file-level comments and follow the
    // formatting guidelines.
    if (!isNodeInAST(node, fileLevelCommentNodes) && isContentCommentDelimeter(node, index)) {
      // TODO: Get the contents for each comment.
      // {
      //   comment: x,
      //   content: y,
      // }
      nodes.push(node);
    }
  });

  return nodes;
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
var getContentsJSON = function(ast) {
  var nodes = getContentCommentNodes(ast);
  var json = parseCommentNodes(nodes);

  return json;
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
    files[i].annotations.content = getContentsJSON(ast);
  }

  next(null, files);
}
