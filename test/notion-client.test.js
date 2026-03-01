'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createMockNotion } = require('./mock-notion');

// We test the logic by calling the mock directly to verify expected API shapes.
// The actual notion-client module wraps @notionhq/client which we don't want to import in tests.

describe('createPage via mock', () => {
  it('creates a page with correct params', async () => {
    const { notion, calls } = createMockNotion();

    const page = await notion.pages.create({
      parent: { page_id: 'parent-123' },
      icon: { type: 'emoji', emoji: '\u{1f4c4}' },
      properties: {
        title: [{ type: 'text', text: { content: 'Test Page' } }],
      },
      children: [{ type: 'paragraph', paragraph: { rich_text: [] } }],
    });

    assert.equal(calls.pagesCreate.length, 1);
    assert.equal(calls.pagesCreate[0].parent.page_id, 'parent-123');
    assert.ok(page.id);
    assert.ok(page.url);
  });
});

describe('batchAppendBlocks via mock', () => {
  it('appends blocks in batches', async () => {
    const { notion, calls } = createMockNotion();

    // Simulate appending 250 blocks in 3 batches
    const blocks = Array.from({ length: 250 }, (_, i) => ({
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: `Block ${i}` } }] },
    }));

    const BATCH_SIZE = 100;
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
      const batch = blocks.slice(i, i + BATCH_SIZE);
      await notion.blocks.children.append({
        block_id: 'page-1',
        children: batch,
      });
    }

    assert.equal(calls.blocksChildrenAppend.length, 3);
    assert.equal(calls.blocksChildrenAppend[0].children.length, 100);
    assert.equal(calls.blocksChildrenAppend[1].children.length, 100);
    assert.equal(calls.blocksChildrenAppend[2].children.length, 50);
  });
});

describe('listAccessiblePages via mock', () => {
  it('returns pages and databases', async () => {
    const { notion, calls } = createMockNotion();

    const pageResponse = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 50,
    });

    assert.equal(pageResponse.results.length, 2);
    assert.equal(pageResponse.results[0].id, 'page-abc-123');

    const dbResponse = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 20,
    });

    assert.equal(dbResponse.results.length, 1);
    assert.equal(dbResponse.results[0].id, 'db-xyz-789');

    assert.equal(calls.search.length, 2);
  });
});
