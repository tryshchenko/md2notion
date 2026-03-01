'use strict';

const fs = require('fs');
const path = require('path');
const { extractTitle, parseMarkdownToBlocks } = require('./parser');
const { createImageHandler } = require('./images');
const { createClient, createPage, listAccessiblePages } = require('./notion-client');

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
 * Main CLI entry point.
 */
async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    console.log(HELP);
    return;
  }

  if (!opts.apiKey) {
    console.error('Error: --api-key is required');
    console.log('\n' + HELP);
    process.exit(1);
  }

  // List pages mode
  if (opts.listPages) {
    const notion = createClient(opts.apiKey);
    await listAccessiblePages(notion);
    return;
  }

  if (!opts.file) {
    console.error('Error: markdown file path is required');
    console.log('\n' + HELP);
    process.exit(1);
  }

  if (!opts.pageId) {
    console.error('Error: --page-id is required');
    console.log('\n' + HELP);
    process.exit(1);
  }

  // Read markdown
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(filePath, 'utf8');
  const baseDir = path.dirname(filePath);

  // Determine title
  const title = opts.title || extractTitle(markdown) || path.basename(filePath, path.extname(filePath));

  if (opts.dryRun) {
    // Dry run: parse without uploading images
    console.log(`Parsing ${opts.file}...`);
    const blocks = await parseMarkdownToBlocks(markdown, { baseDir });
    console.log(`Title: ${title}`);
    console.log(`Blocks: ${blocks.length}`);
    console.log(`Lines: ${markdown.split('\n').length}`);
    return;
  }

  // Full upload
  const notion = createClient(opts.apiKey);

  // Launch browser for SVG conversion
  console.log('Launching browser for image conversion...');
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const onImage = createImageHandler(notion, browser);

  console.log(`Parsing ${opts.file}...`);
  const blocks = await parseMarkdownToBlocks(markdown, { baseDir, onImage });
  console.log(`  ${blocks.length} blocks`);

  await browser.close();

  console.log(`\nCreating page: "${title}"...`);
  const page = await createPage(notion, opts.pageId, title, blocks);
  console.log(`\nDone! ${page.url}`);
}

module.exports = { parseArgs, run, HELP };
