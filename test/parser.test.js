'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseRichText, parseTableLines, parseMarkdownToBlocks, extractTitle } = require('../src/parser');

describe('parseRichText', () => {
  it('parses plain text', () => {
    const result = parseRichText('hello world');
    assert.equal(result.length, 1);
    assert.equal(result[0].text.content, 'hello world');
    assert.equal(result[0].annotations, undefined);
  });

  it('parses bold text', () => {
    const result = parseRichText('**bold**');
    assert.equal(result.length, 1);
    assert.equal(result[0].text.content, 'bold');
    assert.deepEqual(result[0].annotations, { bold: true });
  });

  it('parses italic text', () => {
    const result = parseRichText('*italic*');
    assert.equal(result.length, 1);
    assert.equal(result[0].text.content, 'italic');
    assert.deepEqual(result[0].annotations, { italic: true });
  });

  it('parses mixed formatting', () => {
    const result = parseRichText('hello **bold** and *italic* world');
    assert.equal(result.length, 5);
    assert.equal(result[0].text.content, 'hello ');
    assert.equal(result[1].text.content, 'bold');
    assert.deepEqual(result[1].annotations, { bold: true });
    assert.equal(result[2].text.content, ' and ');
    assert.equal(result[3].text.content, 'italic');
    assert.deepEqual(result[3].annotations, { italic: true });
    assert.equal(result[4].text.content, ' world');
  });

  it('handles empty text', () => {
    const result = parseRichText('');
    assert.equal(result.length, 1);
    assert.equal(result[0].text.content, '');
  });

  it('handles null text', () => {
    const result = parseRichText(null);
    assert.equal(result.length, 1);
    assert.equal(result[0].text.content, '');
  });

  it('chunks long text at 2000 chars', () => {
    const longText = 'a'.repeat(4500);
    const result = parseRichText(longText);
    assert.equal(result.length, 3);
    assert.equal(result[0].text.content.length, 2000);
    assert.equal(result[1].text.content.length, 2000);
    assert.equal(result[2].text.content.length, 500);
  });
});

describe('parseTableLines', () => {
  it('parses a basic table', () => {
    const lines = [
      '| Name | Age |',
      '|------|-----|',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ];
    const block = parseTableLines(lines);
    assert.equal(block.type, 'table');
    assert.equal(block.table.table_width, 2);
    assert.equal(block.table.has_column_header, true);
    assert.equal(block.table.children.length, 3); // header + 2 data rows
  });

  it('handles bold cells', () => {
    const lines = [
      '| Name | Score |',
      '|------|-------|',
      '| Alice | **95** |',
    ];
    const block = parseTableLines(lines);
    const dataRow = block.table.children[1];
    const scoreCell = dataRow.table_row.cells[1];
    assert.equal(scoreCell[0].text.content, '95');
    assert.deepEqual(scoreCell[0].annotations, { bold: true });
  });

  it('normalizes column count', () => {
    const lines = [
      '| A | B | C |',
      '|---|---|---|',
      '| 1 |',  // too few columns
    ];
    const block = parseTableLines(lines);
    const dataRow = block.table.children[1];
    assert.equal(dataRow.table_row.cells.length, 3);
  });
});

describe('extractTitle', () => {
  it('extracts H1 heading', () => {
    assert.equal(extractTitle('# My Title\n\nSome content'), 'My Title');
  });

  it('returns null when no H1', () => {
    assert.equal(extractTitle('## Not H1\n\nContent'), null);
  });

  it('extracts first H1 only', () => {
    assert.equal(extractTitle('# First\n# Second'), 'First');
  });
});

describe('parseMarkdownToBlocks', () => {
  it('parses headings', async () => {
    const md = '## Heading Two\n### Heading Three';
    const blocks = await parseMarkdownToBlocks(md);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].type, 'heading_2');
    assert.equal(blocks[0].heading_2.rich_text[0].text.content, 'Heading Two');
    assert.equal(blocks[1].type, 'heading_3');
    assert.equal(blocks[1].heading_3.rich_text[0].text.content, 'Heading Three');
  });

  it('skips H1 (used as title)', async () => {
    const md = '# Title\n\nParagraph';
    const blocks = await parseMarkdownToBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'paragraph');
  });

  it('parses dividers', async () => {
    const md = 'Before\n---\nAfter';
    const blocks = await parseMarkdownToBlocks(md);
    assert.equal(blocks[1].type, 'divider');
  });

  it('parses tables', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const blocks = await parseMarkdownToBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'table');
    assert.equal(blocks[0].table.table_width, 2);
  });

  it('parses paragraphs', async () => {
    const md = 'Hello world';
    const blocks = await parseMarkdownToBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'paragraph');
    assert.equal(blocks[0].paragraph.rich_text[0].text.content, 'Hello world');
  });

  it('handles missing images with callout', async () => {
    const md = '![Chart](./missing.png)';
    const blocks = await parseMarkdownToBlocks(md, { baseDir: '/nonexistent' });
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'callout');
  });

  it('calls onImage handler for existing images', async () => {
    // Use sample.md fixture directory as baseDir, create a temp file scenario
    const called = [];
    const onImage = async (imagePath, altText) => {
      called.push({ imagePath, altText });
      return { type: 'image', image: { type: 'test' } };
    };

    // We need an image that actually exists — use the test fixture dir itself
    const fixturesDir = path.join(__dirname, 'fixtures');
    // Create test by referencing the sample.md file as if it were an image
    const md = `![Alt](./sample.md)`;
    const blocks = await parseMarkdownToBlocks(md, { baseDir: fixturesDir, onImage });
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'image');
    assert.equal(called.length, 1);
    assert.equal(called[0].altText, 'Alt');
  });

  it('parses full document', async () => {
    const fs = require('fs');
    const samplePath = path.join(__dirname, 'fixtures', 'sample.md');
    const md = fs.readFileSync(samplePath, 'utf8');
    const blocks = await parseMarkdownToBlocks(md, { baseDir: path.join(__dirname, 'fixtures') });

    // Should have: paragraph, heading_2, 2 paragraphs, heading_3, paragraph, divider,
    // heading_2, table, heading_2, 2 callouts (missing images), heading_2, paragraph
    assert.ok(blocks.length >= 10, `Expected at least 10 blocks, got ${blocks.length}`);

    const types = blocks.map(b => b.type);
    assert.ok(types.includes('heading_2'));
    assert.ok(types.includes('heading_3'));
    assert.ok(types.includes('paragraph'));
    assert.ok(types.includes('divider'));
    assert.ok(types.includes('table'));
    assert.ok(types.includes('callout')); // missing images
  });
});
