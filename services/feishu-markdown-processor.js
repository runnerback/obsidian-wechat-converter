// services/feishu-markdown-processor.js
//
// Pure helpers for processing Obsidian Markdown for Feishu Cloud Documents.
// Handles YAML parsing & stripping, Wikilinks lookup conversion, and image extraction.
// No DOM, no Obsidian API, no side effects.

/**
 * @typedef {{ title: string, url: string }} FeishuHistoryLinkLike
 * @typedef {{ originalSrc: string, path: string, fileName: string, isRemote: boolean, sizeHint?: { width: number, height: number | null } | null }} FeishuMarkdownImageLike
 */

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
  return source.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, noteName = '', alias = '', offset = 0) => {
    if (offset > 0 && source[offset - 1] === '!') return match;
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
  return source.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, fileName = '', altText = '') => {
    if (!fileName) return match;
    const cleanFileName = fileName.trim();
    const alt = getWikiImageAltText(altText, cleanFileName);
    const encodedFileName = encodeURI(cleanFileName);
    return `![${alt}](${encodedFileName})`;
  });
}

/**
 * @param {unknown} rawAltText
 * @param {string} fallback
 * @returns {string}
 */
function getWikiImageAltText(rawAltText, fallback) {
  const raw = String(rawAltText || '').trim();
  if (!raw) return fallback;
  let parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && isLikelyWikiImageSizeHint(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  return parts.join('|').trim() || fallback;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isLikelyWikiImageSizeHint(value) {
  return /^\d+(?:\s*x\s*\d+)?$/i.test(String(value || '').trim());
}

/**
 * @param {unknown} value
 * @returns {{ width: number, height: number | null } | null}
 */
function parseImageSizeHint(value) {
  const match = String(value || '').trim().match(/^(\d+)(?:\s*x\s*(\d+))?$/i);
  if (!match) return null;
  const width = Number(match[1] || 0);
  const height = match[2] ? Number(match[2]) : null;
  if (!Number.isFinite(width) || width <= 0) return null;
  if (height !== null && (!Number.isFinite(height) || height <= 0)) return null;
  return { width, height };
}

/**
 * @param {unknown} altText
 * @returns {{ width: number, height: number | null } | null}
 */
function extractSizeHintFromAltText(altText) {
  const raw = String(altText || '').trim();
  if (!raw) return null;
  if (!raw.includes('|')) return parseImageSizeHint(raw);
  const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  return parseImageSizeHint(parts[parts.length - 1]);
}

/**
 * @param {string} src
 * @returns {string}
 */
function getImageFileNameFromSrc(src) {
  const value = String(src || '');
  const dataMatch = value.match(/^data:image\/([a-z0-9.+-]+);base64,/i);
  if (dataMatch) {
    const ext = dataMatch[1].replace(/^jpeg$/i, 'jpg').toLowerCase();
    return `image.${ext}`;
  }
  return value.split('/').pop() || value;
}

/**
 * @param {unknown} rawDestination
 * @returns {string}
 */
function stripMarkdownDestination(rawDestination) {
  const raw = String(rawDestination || '').trim();
  if (raw.startsWith('<')) {
    const end = raw.indexOf('>');
    if (end > 0) return raw.slice(1, end).trim();
  }
  return raw.replace(/\\([()])/g, '$1').trim();
}

/**
 * Extracts all image paths and titles from the Markdown content.
 * Matches standard markdown images and converts wiki image embeds first.
 * @param {string} markdown
 * @returns {Array<{ originalSrc: string, path: string, fileName: string, isRemote: boolean }>}
 */
function extractImagesFromMarkdown(markdown) {
  const converted = convertObsidianImageSyntax(markdown);
  /** @type {FeishuMarkdownImageLike[]} */
  const images = [];

  let index = 0;
  while (index < converted.length) {
    const start = converted.indexOf('![', index);
    if (start < 0) break;

    let cursor = start + 2;
    let escaped = false;
    let altEnd = -1;
    while (cursor < converted.length) {
      const char = converted[cursor];
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === ']') {
        altEnd = cursor;
        break;
      }
      cursor += 1;
    }

    if (altEnd < 0 || converted[altEnd + 1] !== '(') {
      index = start + 2;
      continue;
    }

    const destinationStart = altEnd + 2;
    cursor = destinationStart;
    let depth = 0;
    escaped = false;
    let destinationEnd = -1;
    while (cursor < converted.length) {
      const char = converted[cursor];
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        if (depth === 0) {
          destinationEnd = cursor;
          break;
        }
        depth -= 1;
      }
      cursor += 1;
    }

    if (destinationEnd < 0) {
      index = start + 2;
      continue;
    }

    const alt = converted.slice(start + 2, altEnd);
    const originalSrc = stripMarkdownDestination(converted.slice(destinationStart, destinationEnd)).split(/\s+(?=["'])/)[0];
    if (!originalSrc) continue;

    const decodedPath = decodeURI(originalSrc);
    const isRemote = /^https?:\/\//i.test(decodedPath) || decodedPath.startsWith('data:');
    const fileName = getImageFileNameFromSrc(decodedPath);
    const sizeHint = extractSizeHintFromAltText(alt);

    // Prevent duplicates in the queue
    if (!images.some((x) => x.originalSrc === originalSrc)) {
      images.push({
        originalSrc,
        path: decodedPath,
        fileName,
        isRemote,
        sizeHint,
      });
    }

    index = destinationEnd + 1;
  }

  return images;
}

export {
  stripYamlFrontmatter,
  parseYamlTitle,
  convertWikilinks,
  convertObsidianImageSyntax,
  extractImagesFromMarkdown,
  getImageFileNameFromSrc,
  stripMarkdownDestination,
};
