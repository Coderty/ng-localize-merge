#!/usr/bin/env node
"use strict";

const fs = require("fs").promises;
const path = require("path");
const { program } = require('commander');
const pino = require('pino');
const logger = pino({
    transport: {
      target: 'pino-pretty',
      options: {
        timestampKey: false,
        ignore: 'pid,hostname'
      }
    }
  })

const messagesBaseName = "messages.json";

program
    .option('-m, --missing-translation-place-holder <place holder>', 'Missing translation place holder', "!!MISSING_TRANSLATION")
    .option('-p, --messages-base-path <path>', 'Folder path of messages base', "./i18n");

program.parse(process.argv);
const options = program.opts();

const messagesBasePath = options.messagesBasePath;
const missingTranslationPlaceHolder = options.missingTranslationPlaceHolder;

logger.info("checking ",messagesBasePath);

async function main() {
  try {
    const messagesBase = await readFileMessages(messagesBaseName);
    await validateMessageJSONFormat(messagesBaseName, messagesBase);

    const messageFiles = await fs.readdir(messagesBasePath);

    for(const languageFileMessages of messageFiles){
        if (languageFileMessages !== messagesBaseName){
            await generateMessages(messagesBase, languageFileMessages);
        }
    }
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
                messages.translations[messageBaseKey] = `${missingTranslationPlaceHolder}${missingTranslationPlaceHolder?':':''}${messagesBase.translations[messageBaseKey]}`;
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
        logger.error(`Error into ${languageFileMessages}:`, error);
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

main();
