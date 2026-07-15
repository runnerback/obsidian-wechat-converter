// services/card-publish.js
//
// 图卡发布链路的通用纯逻辑层(小红书 / X 共用)。两个平台除了「子目录名 /
// 文件名前缀 / 平台文案 / asset source kind」不同,其余完全一致,故抽到这里:
//   - extractCardBody:复用「> 发布正文：」标记块截取正文;
//   - cardFilename:synced-<prefix>-card_NN.png;
//   - syncCardsToFolder:落盘到笔记同目录 sync-to-<subdir>/(见 rednote-publish);
//   - buildCardArticle:组装桥接协议 article(assets=图卡,markdown=正文+图片引用);
//   - findPlatformId:在扩展平台列表里按别名匹配平台 id。
// 具体平台(rednote-publish.js / x-publish.js)只提供一份 config 调用这里。
// 本模块自包含,不反向依赖任何平台模块(避免循环引用)。

/** 正文起始标记:「> 发布时复制下面这段作为笔记正文：」(全半角冒号均可) */
const BODY_START_RE = /^>\s*发布时复制下面这段作为笔记正文[：:]?\s*$/;

/**
 * 截取图卡笔记正文:第一个标记行之后,到下一个引用行(> 开头)之前,不含标记行。
 * 找不到标记时返回空串(调用方据此报错,不做兜底)。
 * @param {string} markdown
 * @returns {string}
 */
export function extractCardBody(markdown) {
  const lines = String(markdown || '').split('\n');
  const startIndex = lines.findIndex((line) => BODY_START_RE.test(line.trim()));
  if (startIndex === -1) return '';
  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('>')) break;
    collected.push(lines[i]);
  }
  return collected.join('\n').trim();
}

/**
 * 标题 = 第一个一级标题(# xxx);没有则返回空串(调用方回退文件名)。
 * @param {string} markdown
 * @returns {string}
 */
export function extractCardTitle(markdown) {
  const match = String(markdown || '').match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

/**
 * 图卡文件名:synced-<prefix>-card_00.png、synced-<prefix>-card_01.png …
 * @param {string} prefix 平台前缀(rednote / x)
 * @param {number} index
 * @returns {string}
 */
export function cardFilename(prefix, index) {
  return `synced-${prefix}-card_${String(index).padStart(2, '0')}.png`;
}

/**
 * 在扩展上报的平台列表里按别名匹配平台 id。
 * @param {Array<{ id?: string, name?: string }>} platforms
 * @param {(id: string, name: string) => boolean} matches 归一化后的匹配器
 * @returns {string} 找不到返回空串
 */
export function findPlatformId(platforms, matches) {
  const list = Array.isArray(platforms) ? platforms : [];
  const hit = list.find((platform) => matches(
    String(platform?.id || '').toLowerCase(),
    String(platform?.name || '').toLowerCase(),
  ));
  return hit ? String(hit.id) : '';
}

/**
 * 通用图卡落盘:写入笔记同目录的 <subdir>/,已存在则先清空其中文件再逐张写入。
 * 发布后保留(留档),不做删除。
 * @param {{ vault: { createFolder: (p: string) => Promise<unknown>, createBinary: (p: string, data: ArrayBuffer) => Promise<unknown>, getAbstractFileByPath: (p: string) => unknown, delete: (f: unknown) => Promise<void> } }} app
 * @param {{ parent?: { path?: string } | null }} noteFile
 * @param {ArrayBuffer[]} buffers
 * @param {{ subdir: string, filenameOf: (index: number) => string }} options
 * @returns {Promise<string>}
 */
export async function syncCardsToFolder(app, noteFile, buffers, { subdir, filenameOf }) {
  const parentPath = noteFile?.parent?.path || '';
  const dirPath = parentPath && parentPath !== '/' ? `${parentPath}/${subdir}` : subdir;

  const existing = app.vault.getAbstractFileByPath(dirPath);
  if (existing) {
    const children = Array.isArray(/** @type {{ children?: unknown[] }} */ (existing).children)
      ? [...(/** @type {{ children: unknown[] }} */ (existing).children)]
      : [];
    for (const child of children) {
      await app.vault.delete(child);
    }
  } else {
    await app.vault.createFolder(dirPath);
  }

  for (let i = 0; i < buffers.length; i++) {
    await app.vault.createBinary(`${dirPath}/${filenameOf(i)}`, buffers[i]);
  }
  return dirPath;
}

/**
 * 把图卡写入笔记同目录的 sync-to-<prefix>/。见 {@link syncCardsToFolder}。
 * @param {Parameters<typeof syncCardsToFolder>[0]} app
 * @param {Parameters<typeof syncCardsToFolder>[1]} noteFile
 * @param {ArrayBuffer[]} buffers
 * @param {string} prefix 平台前缀(rednote / x),用于子目录名与文件名
 * @returns {Promise<string>}
 */
export async function syncCardsToPlatformFolder(app, noteFile, buffers, prefix) {
  return syncCardsToFolder(app, noteFile, buffers, {
    subdir: `sync-to-${prefix}`,
    filenameOf: (i) => cardFilename(prefix, i),
  });
}

/**
 * 构造桥接协议 article:图卡为 assets,正文为 markdown(附 asset:// 图片引用)。
 * @param {{ title: string, body: string, cards: Array<{ base64: string, size: number }>, notePath?: string, prefix: string, sourceKind: string }} params
 * @returns {{ title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }}
 */
export function buildCardArticle({ title, body, cards, notePath = '', prefix, sourceKind }) {
  const assets = cards.map((card, i) => ({
    id: `image-${i}`,
    filename: cardFilename(prefix, i),
    mimeType: 'image/png',
    size: card.size,
    base64: card.base64,
    source: { kind: sourceKind, notePath },
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
