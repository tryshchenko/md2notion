'use strict';

const fs = require('fs');

/**
 * Convert an SVG file to a PNG buffer using Puppeteer.
 */
async function convertSvgToPng(svgPath, browser) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const wMatch = svg.match(/width="(\d+)"/);
  const hMatch = svg.match(/height="(\d+)"/);
  const width = wMatch ? parseInt(wMatch[1]) + 80 : 1100;
  const height = hMatch ? parseInt(hMatch[1]) + 80 : 600;

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  const html = `<!DOCTYPE html><html><body style="margin:20px;background:white">${svg}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pngBuffer = await page.screenshot({ type: 'png', fullPage: true });
  await page.close();
  return pngBuffer;
}

/**
 * Upload a PNG buffer to Notion via the file upload API.
 * Returns the file upload ID.
 */
async function uploadPngToNotion(notion, pngBuffer, filename) {
  const fileUpload = await notion.fileUploads.create({
    mode: 'single_part',
    filename,
    content_type: 'image/png',
  });

  await notion.fileUploads.send({
    file_upload_id: fileUpload.id,
    file: {
      filename,
      data: new Blob([pngBuffer], { type: 'image/png' }),
    },
  });

  return fileUpload.id;
}

/**
 * Create an image block handler for use with parseMarkdownToBlocks.
 * Returns an async function (imagePath, altText) => Notion block.
 */
function createImageHandler(notion, browser) {
  return async function handleImage(imagePath, altText) {
    const filename = require('path').basename(imagePath);
    const isSvg = imagePath.endsWith('.svg');

    let pngBuffer;
    if (isSvg) {
      const pngFilename = filename.replace(/\.svg$/, '.png');
      console.log(`  Converting ${filename} → ${pngFilename}...`);
      pngBuffer = await convertSvgToPng(imagePath, browser);
      console.log(`  Uploading ${pngFilename} to Notion...`);
      const fileUploadId = await uploadPngToNotion(notion, pngBuffer, pngFilename);
      return {
        type: 'image',
        image: {
          type: 'file_upload',
          file_upload: { id: fileUploadId },
          caption: require('./parser').parseRichText(altText),
        },
      };
    }

    // PNG/JPG — read and upload directly
    const ext = require('path').extname(filename).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      console.log(`  Uploading ${filename} to Notion...`);
      const buffer = fs.readFileSync(imagePath);
      const contentType = ext === '.png' ? 'image/png'
        : ext === '.gif' ? 'image/gif'
        : ext === '.webp' ? 'image/webp'
        : 'image/jpeg';
      const fileUpload = await notion.fileUploads.create({
        mode: 'single_part',
        filename,
        content_type: contentType,
      });
      await notion.fileUploads.send({
        file_upload_id: fileUpload.id,
        file: {
          filename,
          data: new Blob([buffer], { type: contentType }),
        },
      });
      return {
        type: 'image',
        image: {
          type: 'file_upload',
          file_upload: { id: fileUpload.id },
          caption: require('./parser').parseRichText(altText),
        },
      };
    }

    return null;
  };
}

module.exports = {
  convertSvgToPng,
  uploadPngToNotion,
  createImageHandler,
};
