// services/feishu-markdown-processor.js
//
// Pure helpers for processing Obsidian Markdown for Feishu Cloud Documents.
// Handles YAML parsing & stripping, Wikilinks lookup conversion, and image extraction.
// No DOM, no Obsidian API, no side effects.

/**
 * Strips YAML frontmatter block from the beginning of the Markdown content.
 * @param {string} markdown
 * @returns {string}
 */
function stripYamlFrontmatter(markdown) {
  return String(markdown || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

/**
 * Parses the YAML frontmatter and extracts the title if present.
 * @param {string} markdown
 * @returns {string}
 */
function parseYamlTitle(markdown) {
  const match = String(markdown || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return '';
  const yamlText = match[1];
  const lines = yamlText.split('\n');
  for (const line of lines) {
    const index = line.indexOf(':');
    if (index > 0) {
      const key = line.substring(0, index).trim();
      if (key === 'title') {
        const value = line.substring(index + 1).trim();
        return value.replace(/^['"]|['"]$/g, ''); // strip outer quotes
      }
    }
  }
  return '';
}

/**
 * Converts Obsidian wiki links [[Note Name]] or [[Note Name|Alias]] into standard
 * Markdown hyperlinks if they match a previously uploaded document in history.
 * Otherwise, it simplifies them to plain text.
 * @param {string} markdown
 * @param {Array<{ title: string, url: string }>} uploadHistory
 * @returns {string}
 */
function convertWikilinks(markdown, uploadHistory = []) {
  const source = String(markdown || '');
  return source.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, noteName, alias) => {
    const cleanNoteName = noteName.trim();
    const displayName = (alias || noteName).trim();
    
    // Search in the Feishu sync history
    const historyItem = (uploadHistory || []).find((x) => {
      if (!x || !x.title) return false;
      return x.title === cleanNoteName;
    });

    if (historyItem && historyItem.url) {
      return `[${displayName}](${historyItem.url})`;
    }
    return displayName;
  });
}

/**
 * Converts Obsidian wiki image embeds ![[image.png]] or ![[image.png|alt]]
 * into standard Markdown image references.
 * @param {string} markdown
 * @returns {string}
 */
function convertObsidianImageSyntax(markdown) {
  const source = String(markdown || '');
  return source.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, fileName, altText) => {
    if (!fileName) return match;
    const cleanFileName = fileName.trim();
    const alt = (altText || cleanFileName).trim();
    const encodedFileName = encodeURI(cleanFileName);
    return `![${alt}](${encodedFileName})`;
  });
}

/**
 * Extracts all image paths and titles from the Markdown content.
 * Matches standard markdown images and converts wiki image embeds first.
 * @param {string} markdown
 * @returns {Array<{ originalSrc: string, path: string, fileName: string, isRemote: boolean }>}
 */
function extractImagesFromMarkdown(markdown) {
  const converted = convertObsidianImageSyntax(markdown);
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  const images = [];
  let match;

  markdownImageRegex.lastIndex = 0;
  while ((match = markdownImageRegex.exec(converted)) !== null) {
    const originalSrc = match[2];
    if (!originalSrc) continue;

    const decodedPath = decodeURI(originalSrc);
    const fileName = decodedPath.split('/').pop() || decodedPath;
    const isRemote = /^https?:\/\//i.test(decodedPath) || decodedPath.startsWith('data:');

    // Prevent duplicates in the queue
    if (!images.some((x) => x.originalSrc === originalSrc)) {
      images.push({
        originalSrc,
        path: decodedPath,
        fileName,
        isRemote,
      });
    }
  }

  return images;
}

export {
  stripYamlFrontmatter,
  parseYamlTitle,
  convertWikilinks,
  convertObsidianImageSyntax,
  extractImagesFromMarkdown,
};
