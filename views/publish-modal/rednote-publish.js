// views/publish-modal/rednote-publish.js
//
// 小红书图卡发布准备(AppleStyleView mixin):
//   确保 rednote 预览已挂载 → 渲染当前预览的全部图卡 →
//   落盘 sync-to-rednote/(先清空) → 截取标题/正文 → 组装桥接 article。
// 投递(enqueueSyncArticle)由「发布与分发 → 其他平台」的统一发送流程执行:
// 勾选小红书时总是走本图卡链路,失败则跳过小红书、不阻断其他平台。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import {
  extractRednoteBody,
  extractRednoteTitle,
  syncCardsToRednoteFolder,
  buildRednoteArticle,
} from '../../services/rednote-publish.js';

const { Notice } = obsidianApi;

/**
 * @param {Blob} blob
 * @returns {Promise<{ base64: string, buffer: ArrayBuffer }>}
 */
async function blobToBase64AndBuffer(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { base64: btoa(binary), buffer };
}

export const rednotePublishMixin = {
  /**
   * 准备小红书图卡 article(渲染 + 落盘 + 截取,不投递)。
   * 任何一步不满足直接抛错(调用方决定跳过或报错),不做静默兜底。
   * @returns {Promise<{ article: { title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }, dirPath: string, cardCount: number }>}
   */
  async prepareRednoteCardArticle() {
    const view = /** @type {any} */ (this);

    const activeFile = view.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      throw new Error('请先打开要发布的 markdown 笔记');
    }

    // 1. 截取标题/正文(正文标记缺失=格式不符,直接暴露)
    const markdownSource = await view.app.vault.cachedRead(activeFile);
    const body = extractRednoteBody(markdownSource);
    if (!body) {
      throw new Error('未找到正文标记「> 发布时复制下面这段作为笔记正文：」,请检查笔记格式');
    }
    const title = extractRednoteTitle(markdownSource) || activeFile.basename;

    // 2. 确保 rednote 预览已挂载(没打开过则自动切换到小红书预览完成渲染)
    if (!view.rednoteController) {
      await view.setPreviewMode?.('rednote');
    }
    const previewEl = view.rednoteController?.getPreviewEl();
    if (!previewEl) {
      throw new Error('小红书预览尚未就绪,请先在顶栏切到「小红书」确认图卡');
    }

    // 3. 渲染全部图卡(与预览所见一致)
    const notice = new Notice('正在渲染小红书图卡...', 0);
    try {
      const { DownloadManager } = await import('../../rednote/index.ts');
      const blobs = await DownloadManager.exportAllImageBlobs(previewEl);

      notice.setMessage(`正在处理 ${blobs.length} 张图卡...`);
      const cards = [];
      const buffers = [];
      for (const blob of blobs) {
        const { base64, buffer } = await blobToBase64AndBuffer(blob);
        cards.push({ base64, size: blob.size });
        buffers.push(buffer);
      }

      // 4. 落盘 sync-to-rednote/(先清空,发布后保留)
      notice.setMessage('正在写入 sync-to-rednote 目录...');
      const dirPath = await syncCardsToRednoteFolder(view.app, activeFile, buffers);

      const article = buildRednoteArticle({ title, body, cards, notePath: activeFile.path });
      notice.hide();
      return { article, dirPath, cardCount: blobs.length };
    } catch (error) {
      notice.hide();
      throw error;
    }
  },
};
