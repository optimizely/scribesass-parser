var shell = require('shelljs');
var dd = require('./utils').dd;
var mapKeys = require('lodash/mapKeys');
var mapValues = require('lodash/mapValues');

var getFileNameFromPath = function(file) {
  return file.split('/').pop();
}

var getFileDirectoryFromPath = function(file) {
  file = file.split('/');
  file.pop();
  return file.join('/');
}

var getSassMap = function(base) {
  // This creates a requirement for projects that use this repo to have a
  // version of NPM that is at least 3.0.0 becauses it assumes a flat
  // dependency structure. Should be rethought in the future if this project
  // is used in more places. https://docs.npmjs.com/how-npm-works/npm3
  var call = shell.exec('node ./node_modules/sass-mapper/src/main.js ' + base, {
    async: false,
    silent: true,
  });

  return JSON.parse(call.output);
}

var getPrefixedSassMap = function(base) {
  var sassMap = getSassMap(base);
  var prefixedSassMap = mapKeys(sassMap, function(value, key) {
    return base + '/' +  key;
  });

  return prefixedSassMap;
}

var getImportsArray = function(sassMap, base, fileName, imports) {
  var file = base + '/' + fileName;
  var dependencies = sassMap[file];

  imports = imports || [];
  imports.push(file);

  for (var i = 0; i < dependencies.length; i++) {
    getImportsArray(sassMap, base, dependencies[i], imports);
  }

  return imports;
}

// 1. Return an array of the dependencies within the folder of the file that is
//    passed in. Use`joshrp/sass-mapper` to create the object.
// 2. Return an array of files in order that they are imported. This is computed
//    by finding the file that was passed in and then recursively following the
//    imports.
module.exports = function(file, next) {
  var fileName = getFileNameFromPath(file);
  var base = getFileDirectoryFromPath(file);

  var sassMap = getPrefixedSassMap(base);
  var imports = getImportsArray(sassMap, base, fileName);

  return next(null, imports);
};
