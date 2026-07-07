// services/rednote-publish.js
//
// 小红书图卡发布链路的纯逻辑层:
//   1. 从笔记 markdown 截取「发布正文」与标题;
//   2. 把渲染好的图卡落盘到笔记目录的 sync-to-rednote/(每次发布前清空重写,发布后保留);
//   3. 构造桥接协议的 article(assets = 图卡,markdown = 正文 + asset:// 图片引用)。
// 图卡渲染本身在 rednote/downloadManager.exportAllImageBlobs(视图层调用)。

/** 正文起始标记:「> 发布时复制下面这段作为笔记正文：」(全半角冒号均可) */
const BODY_START_RE = /^>\s*发布时复制下面这段作为笔记正文[：:]?\s*$/;

/**
 * 截取小红书笔记正文:第一个标记行之后,到下一个引用行(> 开头)之前,
 * 不含标记行本身。找不到标记时返回空串(调用方据此报错,不做兜底)。
 * @param {string} markdown 笔记原文
 * @returns {string}
 */
export function extractRednoteBody(markdown) {
  const lines = String(markdown || '').split('\n');
  const startIndex = lines.findIndex((line) => BODY_START_RE.test(line.trim()));
  if (startIndex === -1) return '';

  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('>')) break; // 下一个引用块 = 正文结束
    collected.push(lines[i]);
  }
  return collected.join('\n').trim();
}

/**
 * 标题 = 第一个一级标题(# xxx);没有则返回空串(调用方回退文件名)。
 * @param {string} markdown
 * @returns {string}
 */
export function extractRednoteTitle(markdown) {
  const match = String(markdown || '').match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

/**
 * 图卡文件名:card_00.png、card_01.png …(与用户既有命名习惯一致)
 * @param {number} index
 * @returns {string}
 */
export function rednoteCardFilename(index) {
  return `card_${String(index).padStart(2, '0')}.png`;
}

/**
 * 在扩展上报的平台列表里找小红书的平台 id(id 含 xiaohongshu/xhs 或名称含「小红书」)。
 * @param {Array<{ id?: string, name?: string }>} platforms
 * @returns {string} 找不到返回空串
 */
export function findXiaohongshuPlatformId(platforms) {
  const list = Array.isArray(platforms) ? platforms : [];
  const hit = list.find((platform) => {
    const id = String(platform?.id || '').toLowerCase();
    const name = String(platform?.name || '');
    return id.includes('xiaohongshu') || id === 'xhs' || name.includes('小红书');
  });
  return hit ? String(hit.id) : '';
}

/**
 * 把图卡写入笔记同目录的 sync-to-rednote/:已存在则先清空其中文件,再逐张写入。
 * 发布后这些文件保留(留档),不做删除。
 * @param {{ vault: { adapter: { exists: (p: string) => Promise<boolean> }, createFolder: (p: string) => Promise<unknown>, createBinary: (p: string, data: ArrayBuffer) => Promise<unknown>, getAbstractFileByPath: (p: string) => unknown, delete: (f: unknown) => Promise<void>, getFolderByPath?: (p: string) => unknown } }} app Obsidian App
 * @param {{ parent?: { path?: string } | null }} noteFile 当前笔记 TFile
 * @param {ArrayBuffer[]} buffers 图卡二进制(按页序)
 * @returns {Promise<string>} 落盘目录路径
 */
export async function syncCardsToRednoteFolder(app, noteFile, buffers) {
  const parentPath = noteFile?.parent?.path || '';
  const dirPath = parentPath && parentPath !== '/' ? `${parentPath}/sync-to-rednote` : 'sync-to-rednote';

  const existing = app.vault.getAbstractFileByPath(dirPath);
  if (existing) {
    // 清空目录内既有文件(仅一层:该目录只存图卡)
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
    await app.vault.createBinary(`${dirPath}/${rednoteCardFilename(i)}`, buffers[i]);
  }
  return dirPath;
}

/**
 * 构造桥接协议 article:图卡为 assets,正文为 markdown(附 asset:// 图片引用),
 * 封面 = 第一张卡。base64 由调用方从 Blob 转好传入。
 * @param {{ title: string, body: string, cards: Array<{ base64: string, size: number }>, notePath?: string }} params
 * @returns {{ title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }}
 */
export function buildRednoteArticle({ title, body, cards, notePath = '' }) {
  const assets = cards.map((card, i) => ({
    id: `image-${i}`,
    filename: rednoteCardFilename(i),
    mimeType: 'image/png',
    size: card.size,
    base64: card.base64,
    source: { kind: 'rednote-card', notePath },
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
