#!/usr/bin/env node
"use strict";

const fs = require("fs").promises;
const path = require("path");
const { program } = require('commander');
const {Translate} = require('@google-cloud/translate').v2;
const pino = require('pino');
const logger = pino({
    transport: {
      target: 'pino-pretty',
      options: {
        timestampKey: false,
        ignore: 'pid,hostname'
      }
    }
  });

program
    .option('-m, --missing-translation-place-holder <place holder>', 'missing translation place holder', "!!MISSING_TRANSLATION")
    .option('-p, --messages-base-path <path>', 'folder path of messages base', "./i18n")
    .option('-t, --translate', 'translate with google translator')
    .option('-g, --google-api-key <key>', 'google api key for Cloud Translation API')
    .option('-e, --env-file <path>', 'read in a file of environment variables');

program.parse(process.argv);
const options = program.opts();

let dotEnvOptions = {};
if(options.envFile) dotEnvOptions.path = options.envFile;
require('dotenv').config(dotEnvOptions);

const messagesBaseName = "messages.json";
const messagesBasePath = options.messagesBasePath;
const missingTranslationPlaceHolder = options.missingTranslationPlaceHolder;
const googleApiKey = options.googleApiKey || process.env.GOOGLE_TRANSLATE_CREDENTIALS;

const translate = new Translate({key: googleApiKey});

async function main() {
  try {
    logger.info("checking ",messagesBasePath);
    const messagesBase = await readFileMessages(messagesBaseName);
    await validateMessageJSONFormat(messagesBaseName, messagesBase);

    const messageFiles = await fs.readdir(messagesBasePath);

    for(const languageFileMessages of messageFiles){
        if (languageFileMessages !== messagesBaseName){
            await generateMessages(messagesBase, languageFileMessages);
        }
    }
    logger.info("All done.");
  } catch (error) {
    logger.error(error);
  }
}

async function generateMessages(messagesBase, languageFileMessages){
    try {
        let hasMissings = false;
        const messages = await readFileMessages(languageFileMessages);
        await validateMessageJSONFormat(languageFileMessages, messages);
       
        for(const messageBaseKey in messagesBase.translations){
            if(!messages.translations[messageBaseKey]){
                hasMissings = true;
                let translation;
                if(options.translate) translation = await translateText(messagesBase.translations[messageBaseKey], messages.locale);
                messages.translations[messageBaseKey] = translation || `${missingTranslationPlaceHolder}${missingTranslationPlaceHolder?':':''}${messagesBase.translations[messageBaseKey]}`;
            }
        }

        if(hasMissings){
            writeFileMessages(languageFileMessages, messages);
        }

        // CHECK MESSAGES INTO LANGUAGE FILE THAT NOT EXISTS INTO BASE:
        for(const messageLanguageKey in messages.translations){
            if(!messagesBase.translations[messageLanguageKey]){
                logger.warn(`Message "${messageLanguageKey}" found in ${languageFileMessages} file that does not exist in messages base file.`);
            }
        }

    } catch (error) {
        logger.error(`Error into ${languageFileMessages}: ${error}`);
    }
}

async function writeFileMessages(file, messages){
    const filePath = path.join(messagesBasePath, file)
    const data = JSON.stringify(messages, null, 2);
    await fs.writeFile(filePath, data);
}

async function readFileMessages(file){
    const filePath = path.join(messagesBasePath, file);
    const messagesBaseRaw = await fs.readFile(filePath);
    return JSON.parse(messagesBaseRaw);
}

async function validateMessageJSONFormat(id, message){
    if(!message.hasOwnProperty('locale')) throw new Error(`Missing locale into ${id}`);
    if(!message.hasOwnProperty('translations')) throw new Error(`Missing translations into ${id}`);
    if(typeof message['locale'] !== 'string') throw new Error(`locale value is not valid into ${id}`);
    if(typeof message['translations'] !== 'object') throw new Error(`translations value is not valid into ${id}`);
}

async function translateText(text, languaje) {
    try {
        const [translations] = await translate.translate(text, languaje);
        return Array.isArray(translations) ? translations[0] : translations;
    } catch (error) {
        logger.error(`Error in translation: ${languaje}/${text}: ${error}`);
    }
}

main();
