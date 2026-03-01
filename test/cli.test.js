'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseArgs } = require('../src/cli');

describe('parseArgs', () => {
  it('parses all flags', () => {
    const opts = parseArgs(['file.md', '--api-key', 'secret', '--page-id', 'abc', '--title', 'My Title']);
    assert.equal(opts.file, 'file.md');
    assert.equal(opts.apiKey, 'secret');
    assert.equal(opts.pageId, 'abc');
    assert.equal(opts.title, 'My Title');
    assert.equal(opts.dryRun, false);
    assert.equal(opts.listPages, false);
  });

  it('parses --dry-run', () => {
    const opts = parseArgs(['file.md', '--api-key', 'k', '--page-id', 'p', '--dry-run']);
    assert.equal(opts.dryRun, true);
  });

  it('parses --list-pages', () => {
    const opts = parseArgs(['--api-key', 'k', '--list-pages']);
    assert.equal(opts.listPages, true);
  });

  it('parses --help', () => {
    const opts = parseArgs(['--help']);
    assert.equal(opts.help, true);
  });

  it('parses -h', () => {
    const opts = parseArgs(['-h']);
    assert.equal(opts.help, true);
  });

  it('returns nulls for missing values', () => {
    const opts = parseArgs([]);
    assert.equal(opts.file, null);
    assert.equal(opts.apiKey, null);
    assert.equal(opts.pageId, null);
    assert.equal(opts.title, null);
  });

  it('file is first positional argument', () => {
    const opts = parseArgs(['--api-key', 'k', 'myfile.md', '--page-id', 'p']);
    assert.equal(opts.file, 'myfile.md');
  });
});

describe('CLI --dry-run integration', () => {
  it('dry run parses sample.md without errors', async () => {
    const { run } = require('../src/cli');
    const samplePath = path.join(__dirname, 'fixtures', 'sample.md');

    // Capture stdout
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await run([samplePath, '--api-key', 'test-key', '--page-id', 'test-page', '--dry-run']);
    } finally {
      console.log = origLog;
    }

    const output = logs.join('\n');
    assert.ok(output.includes('Title: Sample Report'), `Expected title in output, got: ${output}`);
    assert.ok(output.includes('Blocks:'), `Expected block count in output, got: ${output}`);
  });
});

describe('CLI --help', () => {
  it('prints help text', async () => {
    const { run } = require('../src/cli');
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await run(['--help']);
    } finally {
      console.log = origLog;
    }

    const output = logs.join('\n');
    assert.ok(output.includes('Usage: md2notion'));
    assert.ok(output.includes('--api-key'));
    assert.ok(output.includes('--page-id'));
    assert.ok(output.includes('--dry-run'));
  });
});
