#!/usr/bin/env node

const commander = require('commander');
const util = require('util');
const fs = require('fs');
const scribesass = require('./index');


commander
  .version('0.0.0')
  .description('')
  .usage('[options] <file ...>')
  .option('-o, --out-file [file]', 'Store the output in a file')
  .parse(process.argv);

const input = commander.args[0];


scribesass.create(input, (err, fileArr) => {
  fileArr.map((file) => {
    file.properties = scribesass.getFileProperties(file.ast);
    delete file.ast;
  });

  if (commander.outFile) {
    fs.writeFileSync(commander.outFile, util.inspect(fileArr, { depth: null }));
  } else {
    console.log(util.inspect(fileArr, { depth: null }));
  }
  // console.log(fileArr);
  // console.log(scribesass.getFileProperties(fileArr[0].ast));
  // console.log(scribesass.getComments(fileArr[0].ast));
  // console.log(util.inspect(fileArr, { depth: null }));
});
