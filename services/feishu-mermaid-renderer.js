import {
  convertRenderedMermaidDiagramsToImages,
  renderMermaidCodeBlocks,
} from './rendered-mermaid.js';
import { getActiveDocument } from './dom-utils.js';

/**
 * @typedef {{ start: number, end: number, raw: string, source: string }} MermaidFence
 * @typedef {{ id: string, filename: string, mimeType: string, size: number, base64: string, source: Record<string, unknown> }} FeishuMermaidAsset
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeMarkdownAlt(value) {
  return String(value || 'Mermaid diagram').replace(/\]/g, '\\]');
}

/**
 * @param {unknown} markdown
 * @returns {MermaidFence[]}
 */
function collectMermaidFences(markdown) {
  const source = String(markdown || '');
  /** @type {MermaidFence[]} */
  const fences = [];
  const openerPattern = /^( {0,3})(`{3,}|~{3,})[ \t]*mermaid\b[^\n]*(?:\n|$)/gim;
  let match;

  while ((match = openerPattern.exec(source)) !== null) {
    const marker = match[2][0];
    const markerLength = match[2].length;
    const contentStart = openerPattern.lastIndex;
    const closerPattern = new RegExp(`^( {0,3})\\${marker}{${markerLength},}[ \\t]*(?:\\n|$)`, 'gm');
    closerPattern.lastIndex = contentStart;
    const closeMatch = closerPattern.exec(source);
    if (!closeMatch) continue;

    const contentEnd = closeMatch.index;
    const blockEnd = closerPattern.lastIndex;
    fences.push({
      start: match.index,
      end: blockEnd,
      raw: source.slice(match.index, blockEnd),
      source: source.slice(contentStart, contentEnd).replace(/\s+$/g, ''),
    });
    openerPattern.lastIndex = blockEnd;
  }

  return fences;
}

/**
 * @param {unknown} dataUrl
 * @returns {{ mimeType: string, base64: string, size: number } | null}
 */
function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const base64 = String(match[2] || '').replace(/\s+/g, '');
  if (!base64) return null;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return {
    mimeType: String(match[1] || 'image/png').toLowerCase(),
    base64,
    size: Math.max(0, Math.floor((base64.length * 3) / 4) - padding),
  };
}

/**
 * @param {string} mimeType
 * @returns {string}
 */
function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  return 'png';
}

/**
 * @param {string} source
 * @param {object} options
 * @param {unknown} [options.mermaidApi]
 * @param {unknown} [options.rasterizeSvg]
 * @param {unknown} [options.simpleHash]
 * @param {unknown} [options.mermaidImageCache]
 * @returns {Promise<string>}
 */
async function renderMermaidFenceToDataUrl(source, options = {}) {
  const activeDocument = getActiveDocument();
  if (!activeDocument) return '';

  const host = activeDocument.createElement('div');
  const pre = activeDocument.createElement('pre');
  const code = activeDocument.createElement('code');
  code.className = 'language-mermaid';
  code.textContent = String(source || '').trim();
  pre.appendChild(code);
  host.appendChild(pre);

  const renderedCount = await renderMermaidCodeBlocks(host, {
    mermaidApi: options.mermaidApi,
  });
  if (renderedCount <= 0) return '';

  const convertedCount = await convertRenderedMermaidDiagramsToImages(host, {
    rasterizeSvg: typeof options.rasterizeSvg === 'function' ? options.rasterizeSvg : undefined,
    simpleHash: typeof options.simpleHash === 'function' ? options.simpleHash : null,
    mermaidImageCache: options.mermaidImageCache instanceof Map ? options.mermaidImageCache : null,
  });
  if (convertedCount <= 0) return '';

  const img = host.querySelector?.('img.mermaid-diagram-image');
  return String(img?.getAttribute?.('src') || '');
}

/**
 * Converts Mermaid fenced blocks into Feishu image placeholders. Feishu OpenAPI
 * does not render Mermaid directly, so we rasterize locally and then reuse the
 * existing image replacement pipeline.
 *
 * @param {unknown} markdown
 * @param {object} [options]
 * @param {(asset: FeishuMermaidAsset) => string} [options.localImageSrcFactory]
 * @param {unknown} [options.mermaidApi]
 * @param {unknown} [options.rasterizeSvg]
 * @param {unknown} [options.simpleHash]
 * @param {unknown} [options.mermaidImageCache]
 * @param {unknown} [options.notePath]
 * @returns {Promise<{ markdown: string, assets: FeishuMermaidAsset[], warnings: Array<{ code: string, message: string, severity: string, src: string, filename: string, size: number }> }>}
 */
async function prepareMermaidDiagramsForFeishu(markdown, options = {}) {
  const source = String(markdown || '');
  const fences = collectMermaidFences(source);
  if (!fences.length) {
    return { markdown: source, assets: [], warnings: [] };
  }

  /** @type {FeishuMermaidAsset[]} */
  const assets = [];
  const warnings = [];
  const replacements = [];

  for (let index = 0; index < fences.length; index += 1) {
    const fence = fences[index];
    const ordinal = index + 1;
    if (!fence.source.trim()) continue;

    try {
      const dataUrl = await renderMermaidFenceToDataUrl(fence.source, options);
      const image = parseImageDataUrl(dataUrl);
      if (!image) {
        warnings.push({
          code: 'feishu_mermaid_render_unavailable',
          message: 'Mermaid 图表暂未渲染为图片，已保留原始代码块',
          severity: 'info',
          src: `mermaid-${ordinal}`,
          filename: `mermaid-diagram-${ordinal}.png`,
          size: 0,
        });
        continue;
      }

      const extension = extensionFromMimeType(image.mimeType);
      const asset = {
        id: `feishu-mermaid-${ordinal}`,
        filename: `mermaid-diagram-${ordinal}.${extension}`,
        mimeType: image.mimeType,
        size: image.size,
        base64: image.base64,
        source: {
          kind: 'feishu-mermaid',
          originalSrc: `mermaid:${ordinal}`,
          notePath: String(options.notePath || ''),
          vaultRelativePath: '',
        },
      };
      const placeholder = typeof options.localImageSrcFactory === 'function'
        ? options.localImageSrcFactory(asset)
        : `asset://${asset.id}`;
      asset.source.placeholderSrc = placeholder;
      assets.push(asset);
      replacements.push({
        start: fence.start,
        end: fence.end,
        value: `![${escapeMarkdownAlt(`Mermaid diagram ${ordinal}`)}](${placeholder})\n`,
      });
    } catch (error) {
      warnings.push({
        code: 'feishu_mermaid_render_failed',
        message: `Mermaid 图表渲染失败，已保留原始代码块：${error?.message || String(error || 'unknown_error')}`,
        severity: 'warning',
        src: `mermaid-${ordinal}`,
        filename: `mermaid-diagram-${ordinal}.png`,
        size: 0,
      });
    }
  }

  const markdownWithImages = replacements
    .slice()
    .sort((a, b) => b.start - a.start)
    .reduce((output, replacement) => (
      output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end)
    ), source);

  return {
    markdown: markdownWithImages,
    assets,
    warnings,
  };
}

export {
  collectMermaidFences,
  prepareMermaidDiagramsForFeishu,
};
