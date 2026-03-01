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
    console.log(`  Appending blocks ${i + 1}..${i + batch.length} of ${blocks.length}`);
    await notion.blocks.children.append({
      block_id: pageId,
      children: batch,
    });
  }
}

/**
 * List pages accessible by the integration.
 */
async function listAccessiblePages(notion) {
  console.log('\nSearching for pages the integration can access...\n');
  const response = await notion.search({
    filter: { property: 'object', value: 'page' },
    page_size: 50,
  });

  if (response.results.length === 0) {
    console.log('  No pages found. The integration has no access to any pages.');
    console.log('  Go to a Notion page \u2192 ... \u2192 Add connections \u2192 select your integration.');
    return;
  }

  console.log(`  Found ${response.results.length} accessible pages:\n`);
  for (const page of response.results) {
    const title = page.properties?.title?.title?.[0]?.plain_text
      || page.properties?.Name?.title?.[0]?.plain_text
      || '(untitled)';
    const id = page.id;
    const url = page.url;
    console.log(`  ${title}`);
    console.log(`    ID:  ${id}`);
    console.log(`    URL: ${url}`);
    console.log();
  }

  // Also search for databases
  const dbResponse = await notion.search({
    filter: { property: 'object', value: 'database' },
    page_size: 20,
  });
  if (dbResponse.results.length > 0) {
    console.log(`\n  Also found ${dbResponse.results.length} accessible databases:\n`);
    for (const db of dbResponse.results) {
      const title = db.title?.[0]?.plain_text || '(untitled)';
      console.log(`  [DB] ${title}`);
      console.log(`    ID:  ${db.id}`);
      console.log();
    }
  }
}

module.exports = {
  BATCH_SIZE,
  createClient,
  createPage,
  batchAppendBlocks,
  listAccessiblePages,
};
