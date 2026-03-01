# md2notion

Upload Markdown files to Notion as pages. Handles tables, headings, bold/italic formatting, images (SVG→PNG conversion), and large documents (batch upload).

## Usage

```bash
npx md2notion <file.md> --api-key <key> --page-id <id> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--api-key` | Notion API key (required) |
| `--page-id` | Parent page ID in Notion (required) |
| `--title` | Override page title (default: first `#` heading or filename) |
| `--dry-run` | Parse and print block count without uploading |
| `--list-pages` | List pages the integration can access and exit |
| `--help` | Show help |

### Examples

```bash
# Upload a markdown file
npx md2notion report.md --api-key ntn_xxx --page-id abc-123

# Dry run to check parsing
npx md2notion report.md --api-key ntn_xxx --page-id abc-123 --dry-run

# List accessible pages
npx md2notion --api-key ntn_xxx --list-pages
```

## Programmatic API

```js
const { parseMarkdownToBlocks, extractTitle, createClient, createPage } = require('md2notion');

const markdown = fs.readFileSync('report.md', 'utf8');
const blocks = await parseMarkdownToBlocks(markdown, { baseDir: './reports' });
const title = extractTitle(markdown) || 'My Report';

const notion = createClient('ntn_xxx');
const page = await createPage(notion, 'parent-page-id', title, blocks);
```

## Development

```bash
npm install
npm test
```
