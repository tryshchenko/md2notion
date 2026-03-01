'use strict';

const fs = require('fs');
const path = require('path');

const MAX_TEXT_LEN = 2000;

/**
 * Push text content split into 2000-char chunks with optional annotations.
 */
function pushTextChunks(parts, content, annotations) {
  for (let i = 0; i < content.length; i += MAX_TEXT_LEN) {
    const chunk = content.slice(i, i + MAX_TEXT_LEN);
    const obj = { type: 'text', text: { content: chunk } };
    if (Object.keys(annotations).length > 0) {
      obj.annotations = annotations;
    }
    parts.push(obj);
  }
}

/**
 * Parse markdown inline formatting (bold, italic) into Notion rich_text array.
 */
function parseRichText(text) {
  if (!text) return [{ type: 'text', text: { content: '' } }];

  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextChunks(parts, text.slice(lastIndex, match.index), {});
    }
    if (match[1] !== undefined) {
      pushTextChunks(parts, match[1], { bold: true });
    } else if (match[2] !== undefined) {
      pushTextChunks(parts, match[2], { italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushTextChunks(parts, text.slice(lastIndex), {});
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', text: { content: '' } });
  }
  return parts;
}

/**
 * Split a markdown table row into cell values.
 */
function splitTableRow(line) {
  return line.split('|').slice(1, -1).map(c => c.trim());
}

/**
 * Parse markdown table lines into a Notion table block.
 */
function parseTableLines(lines) {
  const headerCells = splitTableRow(lines[0]);
  const columnCount = headerCells.length;
  const dataRows = lines.slice(2); // skip separator at index 1

  const children = [
    {
      type: 'table_row',
      table_row: {
        cells: headerCells.map(c => parseRichText(c)),
      },
    },
    ...dataRows.map(line => {
      let cells = splitTableRow(line);
      while (cells.length < columnCount) cells.push('');
      cells = cells.slice(0, columnCount);
      return {
        type: 'table_row',
        table_row: {
          cells: cells.map(c => parseRichText(c)),
        },
      };
    }),
  ];

  return {
    type: 'table',
    table: {
      table_width: columnCount,
      has_column_header: true,
      has_row_header: false,
      children,
    },
  };
}

/**
 * Extract the first # heading from markdown as the title.
 * Returns null if no H1 found.
 */
function extractTitle(markdown) {
  const match = markdown.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Parse a full markdown string into Notion blocks.
 *
 * @param {string} markdown - The markdown content
 * @param {object} options
 * @param {string} options.baseDir - Directory to resolve relative image paths against
 * @param {function} [options.onImage] - async (imagePath, altText) => block | null
 * @returns {Promise<object[]>} Array of Notion blocks
 */
async function parseMarkdownToBlocks(markdown, options = {}) {
  const { baseDir = '.', onImage } = options;
  const lines = markdown.split('\n');
  const blocks = [];
  let tableBuffer = [];
  let inTable = false;

  function flushTable() {
    if (tableBuffer.length >= 3) {
      blocks.push(parseTableLines(tableBuffer));
    }
    tableBuffer = [];
    inTable = false;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Table line
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableBuffer.push(trimmed);
      continue;
    }

    // End of table
    if (inTable) flushTable();

    // Empty line
    if (!trimmed) continue;

    // Horizontal rule
    if (trimmed === '---') {
      blocks.push({ type: 'divider', divider: {} });
      continue;
    }

    // H1 — skip, used as page title
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: parseRichText(trimmed.slice(3)) },
      });
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      blocks.push({
        type: 'heading_3',
        heading_3: { rich_text: parseRichText(trimmed.slice(4)) },
      });
      continue;
    }

    // Image
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const [, altText, imgRef] = imgMatch;
      const imagePath = path.resolve(baseDir, imgRef);

      if (onImage && fs.existsSync(imagePath)) {
        const block = await onImage(imagePath, altText);
        if (block) {
          blocks.push(block);
          continue;
        }
      }

      // Fallback: callout with missing image info
      if (!fs.existsSync(imagePath)) {
        blocks.push({
          type: 'callout',
          callout: {
            icon: { type: 'emoji', emoji: '\u{1f4ca}' },
            rich_text: [{ type: 'text', text: { content: `${altText} (${imgRef}) \u2014 file not found` } }],
            color: 'gray_background',
          },
        });
      } else {
        // Image exists but no handler — add as paragraph reference
        blocks.push({
          type: 'paragraph',
          paragraph: { rich_text: parseRichText(`[Image: ${altText}] (${imgRef})`) },
        });
      }
      continue;
    }

    // Regular paragraph
    blocks.push({
      type: 'paragraph',
      paragraph: { rich_text: parseRichText(trimmed) },
    });
  }

  // Flush remaining table
  if (inTable) flushTable();

  return blocks;
}

module.exports = {
  pushTextChunks,
  parseRichText,
  splitTableRow,
  parseTableLines,
  extractTitle,
  parseMarkdownToBlocks,
};
