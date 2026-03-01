'use strict';

const { Client } = require('@notionhq/client');

const BATCH_SIZE = 100;

/**
 * Create a Notion client instance.
 */
function createClient(apiKey) {
  return new Client({ auth: apiKey });
}

/**
 * Create a new Notion page under a parent page.
 * Includes the first batch of blocks (up to BATCH_SIZE).
 */
async function createPage(notion, parentPageId, title, blocks) {
  const firstBatch = blocks.slice(0, BATCH_SIZE);

  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    icon: { type: 'emoji', emoji: '\u{1f4c4}' },
    properties: {
      title: [{ type: 'text', text: { content: title } }],
    },
    children: firstBatch,
  });

  // Append remaining blocks
  if (blocks.length > BATCH_SIZE) {
    await batchAppendBlocks(notion, page.id, blocks.slice(BATCH_SIZE));
  }

  return page;
}

/**
 * Append blocks to a page in batches of BATCH_SIZE.
 */
async function batchAppendBlocks(notion, pageId, blocks) {
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    await notion.blocks.children.append({
      block_id: pageId,
      children: batch,
    });
  }
}

/**
 * List pages and databases accessible by the integration.
 * Returns { pages: [...], databases: [...] }.
 */
async function listAccessiblePages(notion) {
  const response = await notion.search({
    filter: { property: 'object', value: 'page' },
    page_size: 50,
  });

  const pages = response.results.map(page => ({
    title: page.properties?.title?.title?.[0]?.plain_text
      || page.properties?.Name?.title?.[0]?.plain_text
      || '(untitled)',
    id: page.id,
    url: page.url,
  }));

  const dbResponse = await notion.search({
    filter: { property: 'object', value: 'database' },
    page_size: 20,
  });

  const databases = dbResponse.results.map(db => ({
    title: db.title?.[0]?.plain_text || '(untitled)',
    id: db.id,
  }));

  return { pages, databases };
}

module.exports = {
  BATCH_SIZE,
  createClient,
  createPage,
  batchAppendBlocks,
  listAccessiblePages,
};
