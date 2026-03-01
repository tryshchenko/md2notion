'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { uploadPngToNotion } = require('../src/images');
const { createMockNotion } = require('./mock-notion');

describe('uploadPngToNotion', () => {
  it('calls create then send', async () => {
    const { notion, calls } = createMockNotion();
    const buffer = Buffer.from('fake-png-data');

    const id = await uploadPngToNotion(notion, buffer, 'test.png');

    assert.equal(calls.fileUploadsCreate.length, 1);
    assert.equal(calls.fileUploadsCreate[0].filename, 'test.png');
    assert.equal(calls.fileUploadsCreate[0].content_type, 'image/png');
    assert.equal(calls.fileUploadsCreate[0].mode, 'single_part');

    assert.equal(calls.fileUploadsSend.length, 1);
    assert.equal(calls.fileUploadsSend[0].file_upload_id, id);
    assert.equal(calls.fileUploadsSend[0].file.filename, 'test.png');
  });

  it('returns the file upload ID', async () => {
    const { notion } = createMockNotion();
    const buffer = Buffer.from('fake-png-data');

    const id = await uploadPngToNotion(notion, buffer, 'chart.png');
    assert.ok(id.startsWith('file-upload-'));
  });
});
