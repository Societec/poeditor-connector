#!/usr/bin/env node

var connector = require("./index");
var argv = require('argv');

var args = argv.option({
    name: 'config',
    short: 'c',
    type: 'string',
    description: 'Defines the config file location',
    example: "poeditor-connector --config=config/poeditor.json"
}).option({
    name: 'upload',
    short: 'u',
    type: 'string',
    description: 'Upload translations with the config file',
    example: "poeditor-connector --upload --config=config/poeditor.json"
})
.run();

connector.init(args.options.config);

if (args.options.upload) {
    connector.importMessages()
    .catch(function(exception) {
        console.error(exception);
        console.error('Error happened during Poedior upload task!');
        process.exit(1);
    });
} else {
    connector.exportAllLanguages()
    .catch(function(exception) {
        console.error(exception);
        console.error('Error happened during Poedior export task!');
        process.exit(1);
    });
}

