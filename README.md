# ScribeSass Parser

Parse SCSS comments and return a JSON object.


## Annotations
This script parses files and finds annotations in comments. These are the supported annotations.

### @name

* **Description:** Provide a custom name for the documented item.
* **Default:** Name of item or file
* **Required:** No
* **Multiple**: No
* **Allowed on items:** Yes
* **Allowed on files:** Yes
* **Notes:** None


### @description

* **Description:** Provide a description for the documented item.
* **Default:** None
* **Required:** No
* **Multiple**: No
* **Allowed on items:** Yes
* **Allowed on files:** Yes
* **Notes:** None


### @group

* **Description:** Group files under a common theme
* **Default:** Ungrouped
* **Required:** No
* **Multiple**: No
* **Allowed on items:** No
* **Allowed on files:** Yes
* **Notes:** None


### @example[language]

* **Description:** Provide an example for the documented item.
* **Default:** None
* **Required:** No
* **Multiple**: Yes
* **Allowed on items:** Yes
* **Allowed on files:** Yes
* **Notes:** None
* **Example:**

  ```sass
  // @example[html] Image that has a standard border around it.
  //   <img src="http://fillmurray.com/100/100" class="img--border">
  ```

## API

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
