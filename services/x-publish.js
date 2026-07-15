// services/x-publish.js
//
// X(Twitter)草稿发布链路的纯逻辑层,与小红书图卡链路同构:
//   1. 复用小红书的「> 发布正文：」标记块作为推文正文(extractRednoteBody);
//   2. 把渲染好的图卡落盘到笔记目录的 sync-to-x/(发布前清空,发布后保留);
//   3. 构造桥接协议 article(assets = 图卡,markdown = 正文 + asset:// 图片引用)。
// 图卡渲染复用 rednote/downloadManager.exportAllImageBlobs。
// 推文正文不做 280 字截断——由生成端按 X 规则处理,这里原样传。

import { extractRednoteBody, syncCardsToFolder } from './rednote-publish.js';

// 正文标记与小红书一致,直接复用(同一份「> 发布正文：」约定)
export { extractRednoteBody as extractXBody } from './rednote-publish.js';

/**
 * X 图卡文件名:synced-x-card_00.png、synced-x-card_01.png …
 * @param {number} index
 * @returns {string}
 */
export function xCardFilename(index) {
  return `synced-x-card_${String(index).padStart(2, '0')}.png`;
}

/**
 * 在扩展上报的平台列表里找 X 的平台 id(id === 'x' 或名称为 X/Twitter)。
 * @param {Array<{ id?: string, name?: string }>} platforms
 * @returns {string} 找不到返回空串
 */
export function findXPlatformId(platforms) {
  const list = Array.isArray(platforms) ? platforms : [];
  const hit = list.find((platform) => {
    const id = String(platform?.id || '').toLowerCase();
    const name = String(platform?.name || '').toLowerCase();
    return id === 'x' || id === 'twitter' || name === 'x' || name === 'twitter';
  });
  return hit ? String(hit.id) : '';
}

/**
 * 把图卡写入笔记同目录的 sync-to-x/。见 {@link syncCardsToFolder}。
 * @param {Parameters<typeof syncCardsToFolder>[0]} app
 * @param {Parameters<typeof syncCardsToFolder>[1]} noteFile
 * @param {ArrayBuffer[]} buffers
 * @returns {Promise<string>}
 */
export async function syncCardsToXFolder(app, noteFile, buffers) {
  return syncCardsToFolder(app, noteFile, buffers, {
    subdir: 'sync-to-x',
    filenameOf: xCardFilename,
  });
}

/**
 * 构造桥接协议 article:图卡为 assets,正文为 markdown(附 asset:// 图片引用)。
 * markdown = 正文 + 图卡引用,与 rednote 同构;X adapter 从中剥掉图片引用得推文正文,
 * 并把图卡作为附件(media_ids)写入草稿。title 仅用于扩展任务窗口显示。
 * @param {{ title: string, body: string, cards: Array<{ base64: string, size: number }>, notePath?: string }} params
 * @returns {{ title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }}
 */
export function buildXArticle({ title, body, cards, notePath = '' }) {
  const assets = cards.map((card, i) => ({
    id: `image-${i}`,
    filename: xCardFilename(i),
    mimeType: 'image/png',
    size: card.size,
    base64: card.base64,
    source: { kind: 'x-card', notePath },
  }));

  const imageRefs = assets.map((asset) => `![${asset.filename}](asset://${asset.id})`);
  const markdown = [body, '', ...imageRefs].join('\n').trim();
  const contentHtml = [
    ...String(body || '').split('\n').filter(Boolean).map((line) => `<p>${line}</p>`),
    ...assets.map((asset) => `<img src="asset://${asset.id}" alt="${asset.filename}">`),
  ].join('\n');

  return {
    title,
    markdown,
    content: contentHtml,
    cover: assets.length ? `asset://${assets[0].id}` : '',
    assets,
  };
}
