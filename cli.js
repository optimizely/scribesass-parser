#!/usr/bin/env node

const commander = require('commander');
const util = require('util');
const fs = require('fs');
const scribesass = require('./index');


commander
  .version(require('./package.json').version)
  .description(require('./package.json').description)
  .usage('[options] <file ...>')
  .option('-o, --out-file [file]', 'Store the output in a file')
  .parse(process.argv);

const input = commander.args[0];

if (!input) {
  console.error(`Please provide a file. Run with \`--help\` for help.`);
  process.exit(2);
}

if (!fs.existsSync(input)) {
  console.error(`${input} does not exist.`);
  process.exit(2);
}

scribesass.create(input, (err, fileArr) => {
  const groups = scribesass.getGroups(fileArr);
  var files;

  for (groupName in groups) {
    files = groups[groupName];

    files.map((file) => {
      file.properties = scribesass.getFileProperties(file.ast);
      delete file.ast;
    });
  }

  if (commander.outFile) {
    fs.writeFileSync(commander.outFile, JSON.stringify(groups));
  } else {
    console.log(util.inspect(groups, { depth: null }));
  }
});
