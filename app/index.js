var request = require('request');
var fs = require('fs');
var Promise = require('require-promise');
var rimraf = require('rimraf');

var poeditorBaseUrl = 'https://api.poeditor.com/v2';

var poeditorApiToken;
var poeditorProjectId;

var importFile;
var importUpdating;
var importLanguage;
var importOverwrite;
var importSyncTerms;
var importTags;
var exportDir;
var exportFiles;
var exportFilters;
var exportTags;
var exportType;
var importFuzzyTrigger;

// https://poeditor.com/api_reference/


function parseResponse(error, response, body) {
    if (error || response.statusCode != 200) {
        throw error || response.statusCode;
    }

    try {
        return JSON.parse(body);
    } catch (e) {
        throw 'JSON parse exception error. body is: '+ body;
    }
}

module.exports = {

    init: function(configFilePath) {

        if (configFilePath == undefined) {
            throw Error('must initialize with a configFilePath');
        }

        var confString = fs.readFileSync(configFilePath, 'utf8');
        var confObj = JSON.parse(confString);

        poeditorApiToken = process.env.POEDITOR_API_TOKEN || confObj.apiToken;
        if (poeditorApiToken == undefined) {
            console.error('poeditorApiToken');
            throw Error(configFilePath + ' must contain an api_token value entry \'apiToken\'');
        }

        poeditorProjectId = confObj.projectId;
        if (poeditorProjectId == undefined) {
            console.error('poeditorProjectId');
            throw Error(configFilePath + ' must contain an id value entry \'projectId\'');
        }

        importFile = confObj.importFile;
        if (importFile == undefined || !fs.existsSync(importFile)) {
            console.error('importFile');
            throw Error(configFilePath + ' must contain an existing import file entry \'importFile\'');
        }

        importUpdating = confObj.importUpdating;
        if (importUpdating == undefined) {
            importUpdating = 'terms_translations';
        }

        importLanguage = confObj.importLanguage;
        if (importLanguage == undefined) {
            importLanguage = 'en';
        }

        importOverwrite = confObj.importOverwrite;
        if (importOverwrite == undefined) {
            importOverwrite = 0;
        }

        importSyncTerms = confObj.importSyncTerms;
        if (importSyncTerms == undefined) {
            importSyncTerms = 0;
        }

        importFuzzyTrigger = confObj.importFuzzyTrigger;
        if (importFuzzyTrigger == undefined) {
            importFuzzyTrigger = 0;
        }

        importTags = confObj.importTags;
        if (importTags == undefined) {
            importTags = 'all';
        }

        exportDir = confObj.exportDir;
        if (exportDir == undefined) {
            console.error('exportDir');
            throw Error(configFilePath + ' must contain an existing export directory \'exportDir\'');
        }

        if (!fs.existsSync(exportDir)) {
            console.log('creating ' + exportDir);
            fs.mkdirSync(exportDir);
        }

        exportFiles = confObj.exportFiles;

        exportFilters = confObj.exportFilters;
        if (exportFilters == undefined) {
            exportFilters = 'all';
        }

        exportTags = confObj.exportTags;
        if (exportTags == undefined) {
            exportTags = 'all';
        }
        
        exportType = confObj.exportType;
        if (exportType == undefined) {
            exportType = 'xtb';
        }
    },

    /**
     * Updates terms / translations - No more than one request every 30 seconds!
     * @returns 
     */
    importMessages: function() {

        return new Promise(function(resolve, reject) {

            request.post({
                    url: `${poeditorBaseUrl}/projects/upload`,
                    formData: {
                        api_token: poeditorApiToken,
                        id: poeditorProjectId,
                        updating: importUpdating,
                        language: importLanguage,
                        overwrite: importOverwrite,
                        sync_terms: importSyncTerms,
                        file: fs.createReadStream(importFile),
                        fuzzy_trigger: importFuzzyTrigger,
                        tags: importTags
                    }
                },
                function(error, response, body) {
                    if (error) {
                        console.error(error);
                        reject(error);
                        return;
                    }

                    console.log('Code: ', response.statusCode, 'body: ', body);

                    try {
                        var responseData = parseResponse(error, response, body);
                    } catch (e) {
                        reject(e);
                        return;
                    }

                    if (responseData && !responseData.result) {
                        reject('Missing result details');
                        return;
                    }

                    console.log('Uploaded terms:');
                    console.table(responseData.result.terms);
                    console.log('Uploaded translations:');
                    console.table(responseData.result.translations);

                    resolve();
                });
        })
    },

    /**
     * return an array of languages that exist for this project
     *
     * example: [ 'zh-CN', 'en', 'ja', 'ko', 'pt', 'ru', 'es', 'tr', 'vi' ]
     */
    listProjectLanguages: function() {
        return new Promise(function(resolve, reject) {

            request.post({
                    url: `${poeditorBaseUrl}/languages/list`,
                    form: {
                        api_token: poeditorApiToken,
                        id: poeditorProjectId
                    }
                },
                function(error, response, body) {
                    try {
                        var result = parseResponse(error, response, body).result;
                        console.log('Languages data:');
                        console.table(result.languages);
                    } catch (e) {
                        reject(e);
                    }

                    if (!result.languages || !result.languages.length) {
                        resolve([]);
                    }

                    resolve(result.languages.map(function(language) {
                        return language.code;
                    }));
                });
        })
    },

    /**
     * Returns the link of the file (expires after 10 minutes).
     * The settings inherited from the project will be the ones at the time of the download.
     */
    exportProjectLanguage: function(lang) {
        console.log('Started downloading ' + lang, 'language ...');

        var exportFile = exportFiles[lang];
        if (exportFile == undefined) {
            throw Error('No exportFile defined for language ' + lang);
        }
        var target = exportDir + '/' + exportFile;

        return new Promise(function(resolve, reject) {

            request.post({
                    url: `${poeditorBaseUrl}/projects/export`,
                    form: {
                        api_token: poeditorApiToken,
                        id: poeditorProjectId,
                        language: lang,
                        type: exportType,
                        filters: exportFilters,
                        tags: exportTags
                    }
                },
                function(error, response, body) {
                    try {
                        var result = parseResponse(error, response, body).result;
                    } catch (e) {
                        reject(e);
                    }

                    if (!result.url) {
                        reject('Missing \'item\' in ' + body);
                    }

                    var url = decodeURI(result.url);
                    console.log('Language file at ' + url);
                    request.get(url).pipe(fs.createWriteStream(target));
                    console.log('Downloaded: ' + target);
                    console.log('----------------------')
                    resolve(target);
                });
        })
    },

    exportAllLanguages: function() {

        rimraf.sync(exportDir);
        fs.mkdirSync(exportDir);

        return module.exports.listProjectLanguages()
            .then(function(languages) {
                if (!languages.length) {
                    return Promise.reject('No languages list available!');
                }

                var languagePromises = languages.map(function(language) {
                    return module.exports.exportProjectLanguage(language);
                });

                return Promise.all(languagePromises);
            })
            .catch(function(exception) {
                console.error(exception);
            });
    }

};
