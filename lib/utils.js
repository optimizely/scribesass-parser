var util = require('util');

module.exports = {
  dd: function(obj) {
    var expandedObj = obj;
    if (obj !== null && typeof obj === 'object') {
      expandedObj = util.inspect(obj, false, null);
    }
    console.log(expandedObj);
  }
}
