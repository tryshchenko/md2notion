'use strict';

const parser = require('./parser');
const images = require('./images');
const notionClient = require('./notion-client');

module.exports = {
  // Parser
  parseRichText: parser.parseRichText,
  parseTableLines: parser.parseTableLines,
  parseMarkdownToBlocks: parser.parseMarkdownToBlocks,
  extractTitle: parser.extractTitle,

  // Images
  convertSvgToPng: images.convertSvgToPng,
  uploadPngToNotion: images.uploadPngToNotion,
  createImageHandler: images.createImageHandler,

  // Notion client
  createClient: notionClient.createClient,
  createPage: notionClient.createPage,
  batchAppendBlocks: notionClient.batchAppendBlocks,
  listAccessiblePages: notionClient.listAccessiblePages,
  BATCH_SIZE: notionClient.BATCH_SIZE,
};
