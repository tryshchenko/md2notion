'use strict';

const fs = require('fs');
const path = require('path');
const { extractTitle, parseMarkdownToBlocks } = require('./parser');
const { createImageHandler } = require('./images');
const { createClient, createPage, listAccessiblePages } = require('./notion-client');
const log = require('./log');

const HELP = `
Usage: md2notion <file.md> --api-key <key> --page-id <id> [options]

Arguments:
  file           Path to markdown file (required, positional)

Options:
  --api-key      Notion API key (required)
  --page-id      Parent page ID in Notion (required)
  --title        Override page title (default: first # heading or filename)
  --dry-run      Parse and print block count without uploading
  --list-pages   List pages the integration can access and exit
  --help         Show help
`.trim();

/**
 * Parse CLI arguments into an options object.
 */
function parseArgs(argv) {
  const opts = { file: null, apiKey: null, pageId: null, title: null, dryRun: false, listPages: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--list-pages') {
      opts.listPages = true;
    } else if (arg === '--api-key' && i + 1 < argv.length) {
      opts.apiKey = argv[++i];
    } else if (arg === '--page-id' && i + 1 < argv.length) {
      opts.pageId = argv[++i];
    } else if (arg === '--title' && i + 1 < argv.length) {
      opts.title = argv[++i];
    } else if (!arg.startsWith('--') && opts.file === null) {
      opts.file = arg;
    }
  }

  return opts;
}

/**
 * Format and print list-pages results.
 */
function printAccessiblePages({ pages, databases }) {
  if (pages.length === 0) {
    log.info('No accessible pages found.');
    log.info('Ensure the integration is connected: open a Notion page > ... > Add connections.');
    return;
  }

  log.info(`Found ${pages.length} accessible page(s):\n`);
  for (const page of pages) {
    console.log(`  ${page.title}`);
    console.log(`    ID:  ${page.id}`);
    console.log(`    URL: ${page.url}\n`);
  }

  if (databases.length > 0) {
    log.info(`Found ${databases.length} accessible database(s):\n`);
    for (const db of databases) {
      console.log(`  ${db.title}`);
      console.log(`    ID:  ${db.id}\n`);
    }
  }
}

/**
 * Main CLI entry point.
 */
async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    console.log(HELP);
    return;
  }

  if (!opts.apiKey) {
    log.error('--api-key is required');
    console.log('\n' + HELP);
    process.exit(1);
  }

  // List pages mode
  if (opts.listPages) {
    const notion = createClient(opts.apiKey);
    const result = await listAccessiblePages(notion);
    printAccessiblePages(result);
    return;
  }

  if (!opts.file) {
    log.error('Markdown file path is required');
    console.log('\n' + HELP);
    process.exit(1);
  }

  if (!opts.pageId) {
    log.error('--page-id is required');
    console.log('\n' + HELP);
    process.exit(1);
  }

  // Read markdown
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    log.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(filePath, 'utf8');
  const baseDir = path.dirname(filePath);

  // Determine title
  const title = opts.title || extractTitle(markdown) || path.basename(filePath, path.extname(filePath));

  if (opts.dryRun) {
    const blocks = await parseMarkdownToBlocks(markdown, { baseDir });
    log.info(`Title:  ${title}`);
    log.info(`Blocks: ${blocks.length}`);
    log.info(`Lines:  ${markdown.split('\n').length}`);
    return;
  }

  // Full upload
  const notion = createClient(opts.apiKey);

  log.info('Starting browser for image conversion...');
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const onImage = createImageHandler(notion, browser);

  log.info(`Parsing ${path.basename(filePath)}...`);
  const blocks = await parseMarkdownToBlocks(markdown, { baseDir, onImage });
  log.info(`Parsed ${blocks.length} blocks`);

  await browser.close();

  log.info(`Creating page: "${title}"...`);
  const page = await createPage(notion, opts.pageId, title, blocks);
  log.info(`Page created: ${page.url}`);
}

module.exports = { parseArgs, run, HELP };
