'use strict';

/**
 * Mock Notion client that records API calls and returns realistic responses.
 */
function createMockNotion() {
  const calls = {
    pagesCreate: [],
    blocksChildrenAppend: [],
    fileUploadsCreate: [],
    fileUploadsSend: [],
    search: [],
  };

  let fileUploadCounter = 0;
  let pageCounter = 0;

  const notion = {
    pages: {
      create: async (params) => {
        calls.pagesCreate.push(params);
        pageCounter++;
        return {
          id: `page-${pageCounter}`,
          url: `https://notion.so/page-${pageCounter}`,
          properties: params.properties,
        };
      },
    },
    blocks: {
      children: {
        append: async (params) => {
          calls.blocksChildrenAppend.push(params);
          return {
            results: params.children.map((_, i) => ({
              id: `block-${i}`,
              type: params.children[i].type,
            })),
          };
        },
      },
    },
    fileUploads: {
      create: async (params) => {
        calls.fileUploadsCreate.push(params);
        fileUploadCounter++;
        return {
          id: `file-upload-${fileUploadCounter}`,
          status: 'uploaded',
        };
      },
      send: async (params) => {
        calls.fileUploadsSend.push(params);
        return { id: params.file_upload_id, status: 'uploaded' };
      },
    },
    search: async (params) => {
      calls.search.push(params);
      if (params.filter?.value === 'page') {
        return {
          results: [
            {
              id: 'page-abc-123',
              object: 'page',
              url: 'https://notion.so/Test-Page-abc123',
              properties: {
                title: { title: [{ plain_text: 'Test Page' }] },
              },
            },
            {
              id: 'page-def-456',
              object: 'page',
              url: 'https://notion.so/Another-Page-def456',
              properties: {
                Name: { title: [{ plain_text: 'Another Page' }] },
              },
            },
          ],
        };
      }
      if (params.filter?.value === 'database') {
        return {
          results: [
            {
              id: 'db-xyz-789',
              object: 'database',
              title: [{ plain_text: 'Test Database' }],
            },
          ],
        };
      }
      return { results: [] };
    },
  };

  return { notion, calls };
}

module.exports = { createMockNotion };
