# ScribeSass

Parse SCSS comments and return a JSON object.

## Usage

Require `scribesass-parser` and provide it a path to a `.scss` file.

```js
var scribeSass = require('scribesass-parser');

// Provide path to a file and receive an array of files containing `path` and `ast` properties.
scribeSass.create('main.scss', function(err, files) {
  // Get an object of group objects containing file objects.
  var groups = scribeSass.getGroups(files);

  // Loop through the files.
  for (var i = 0; i < files.length; i++) {
    // Path to the file.
    var path = files[i].path;

    // Get SCSS from an AST.
    var scss = scribeSass.getScss(files[i].ast);

    // Get object of file properties from AST.
    var fileProperties = scribeSass.getFileProperties(files[i].ast);

    // Get array of parsed comment objects and ASTs from AST.
    // ```js
    // comments = [{
    //   properties = {...},
    //   ast = {...},
    // }]
    // ```
    var comments = scribeSass.getComments(files[i].ast);
  }
});
```
