var parse = require('./parse');

var getGroups = function(files) {
  var groups = {};

  for (var i = 0; i < files.length; i++) {
    var fileProperties = parse.getFileProperties(files[i].ast);
    var fileGroup = fileProperties.group;

    if (groups.hasOwnProperty(fileGroup)) {
      // See if the group's array exists before pushing to it.
      groups[fileGroup].push(files[i]);
    } else if(fileGroup !== undefined) {
      // TODO: Provide a way to group the undefined files.
      // Create a new array and ignore items that aren't grouped.
      groups[fileGroup] = [files[i]];
    }
  }

  return groups;
}

module.exports = {
  getGroups: getGroups,
};
