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

var COMMENT_CONTENT_END = '---';

// Only support annotated comments in nodes that are `2` levels deep in the
// AST. Level `1` is the stylesheet node.
var DESIRED_LEVEL = 2;


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
 * Return a node's index if it begins with three slashes, a space, and three
 * dashes.
 */
var isEndOfContentDelimiter = function(node, index) {
  if (node && node.content && startsWith(node.content, '/ ' + COMMENT_CONTENT_END)) {
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
 * Check to see if an annotation is valid.
 */
var isValidAnnotation = function(line) {
  return line.match(/^@(?:name|description|group|example)/);
}

/**
 * Turn an array of AST nodes into JSON.
 */
var parseCommentNodes = function(nodes) {
  var lines = [];
  var start;
  var end;

  if (nodes.length > 0) {
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
      var obj = {
        content: removeInitialSlashes(node.content).trim(),
        ast: node.ast,
      };

      if (obj.content.length > 0) {
        lines.push(obj);
      }
    });

    return parseCommentLines(lines, start, end);
  }

  return nodes;
};

var parseExampleAnnotation = function(value) {
  var obj = {};

  // http://regexr.com/3caao
  var re = /(?:\[(.*)\])?[ \t]?(.*?)\n([\s\S]+)/;
  var result = re.exec(value);

  obj['language'] = result[1] || null;
  obj['description'] = result[2] || null;
  obj['code'] = result[3] || null;

  return obj;
}

/**
 * Returns an object of annotations for a Sass comment block.
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

  lines.map(function(lineObj) {
    var annotation = null;

    if (isValidAnnotation(lineObj.content)) {
      // New annotation is starting
      annotation = parseAnnotationLabel(lineObj['content']);
      obj[annotation[0]] = annotation[1];

      hasFoundAnnotation = true;
      mostRecentAnnotation = annotation[0];
    } else if (hasFoundAnnotation) {
      // Annotation continues onto a new line
      obj[mostRecentAnnotation] += '\n' + lineObj['content'];
    } else {
      // Annotation is a name
      obj['name'] += lineObj['content'] + '\n';
    }
  });

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

var isNextLineAValidComment = function(ast, index) {
  // `index` is the current index. `index + 1` is the newline character, so
  // `index + 2` is the next line.
  var nextLineIndex = index + 2;
  var nextLine = ast.get(nextLineIndex);

  return isContentCommentDelimeter(nextLine, nextLineIndex);
};

/**
 * Start at a comment, and traverse until finding another comment.
 */
var getCommentNodeContent = function(ast, node, index) {
  var contentNodes = [];
  // Exists because we can't break or return ourselves out of the traverse
  // function.
  var foundComment = false;
  // Tracks when a non-space node is found to trim the top of the AST.
  var contentBegan = false;

  ast.traverse(function(n, i, parent, level) {
    // Only care about nodes that start after the comment. We check the level
    // of the node to prevent them from being added twice due to the recursive
    // nature of the `ast.traverse` function. We also check to see if the
    // content has begun or if the `node` is not a space (content is beginning)
    // to trim the top of the AST.
    if (i > index && !foundComment && level === DESIRED_LEVEL && (contentBegan || !n.is('space'))) {
      if (isContentCommentDelimeter(n, i)) {
        // Ignore the following nodes from now on.
        foundComment = true;
      } else {
        // Node is part of the comment's content.
        contentNodes.push(n);
        contentBegan = true;
      }
    }
  });

  return lexer.createNode({
    type: 'stylesheet',
    content: contentNodes,
    syntax: enums.SYNTAX,
  });
};

var isValidContentCommentNode = function(node, index, fileLevelCommentNodes) {
  // Comments that are not part of the file-level comments and follow the
  // formatting guidelines.
  return !isNodeInAST(node, fileLevelCommentNodes)
          && isContentCommentDelimeter(node, index)
          && !isEndOfContentDelimiter(node, index);
};

/**
 * Return all of the comment nodes that are not file-level.
 */
var getCommentNodesAndAST = function(ast) {
  var fileLevelCommentNodes = getFileLevelCommentNodes(ast);
  var nodes = [];
  var commentBlockIndex = 0;

  // Loop through all of the comment nodes.
  ast.forEach(enums.COMMENT_TYPE, function(node, index) {
    // Comment should be parsed.
    if (isValidContentCommentNode(node, index, fileLevelCommentNodes)) {
      // A temporary object that will be added to the array of nodes.
      var n = cloneDeep(node);

      // Get the AST of the SCSS that relates to the comment.
      n.ast = getCommentNodeContent(ast, node, index);

      // Prep the array of arrays.
      if (!nodes[commentBlockIndex]) {
        nodes[commentBlockIndex] = [];
      }

      nodes[commentBlockIndex].push(n);

      // Increment the counter if the current comment block has ended.
      if (!isNextLineAValidComment(ast, index)) {
        commentBlockIndex++;
      }
    }
  });

  return nodes;
};

/**
 * Call functions that get the JSON for the file-level comments.
 */
var getFileProperties = function(ast) {
  var nodes = getFileLevelCommentNodes(ast);
  var json = parseCommentNodes(nodes);

  return json;
}

/**
 * Call functions that get the JSON for the file comments.
 */
var getComments = function(ast) {
  var nodes = getCommentNodesAndAST(ast);
  var jsonArray = [];

  // Look through the array of comment blocks.
  for (var i = 0; i < nodes.length; i++) {
    var properties = parseCommentNodes(nodes[i]);
    var ast = lexer.createNode({
      type: 'stylesheet',
      content: [],
      syntax: enums.SYNTAX,
    });

    // Loop through the ASTs for the nodes.
    for (var j = 0; j < nodes[i].length; j++) {
      ast.insert(j, nodes[i][j].ast);
    }

    jsonArray.push({
      properties: properties,
      ast: ast,
    });
  }

  return jsonArray;
}

module.exports = {
  getFileProperties: getFileProperties,
  getComments: getComments,
}
