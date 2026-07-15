// views/publish-modal/x-publish.js
//
// X(Twitter)草稿发布准备(AppleStyleView mixin):
//   确保 rednote 图卡预览已挂载 → 渲染当前预览的全部图卡 →
//   落盘 sync-to-x/(先清空) → 截取正文(复用小红书标记块) → 组装桥接 article。
// 投递(enqueueSyncArticle)由「发布与分发 → 其他平台」的统一发送流程执行:
// 勾选 X 时走本图卡链路,失败则跳过 X、不阻断其他平台。
// 图卡渲染与小红书完全复用(X 的图片 = 小红书同款图卡)。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import {
  extractXBody,
  syncCardsToXFolder,
  buildXArticle,
} from '../../services/x-publish.js';
import { extractRednoteTitle } from '../../services/rednote-publish.js';

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

export const xPublishMixin = {
  /**
   * 准备 X 图卡 article(渲染 + 落盘 + 截取,不投递)。
   * 任何一步不满足直接抛错(调用方决定跳过或报错),不做静默兜底。
   * @returns {Promise<{ article: { title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }, dirPath: string, cardCount: number }>}
   */
  async prepareXCardArticle() {
    const view = /** @type {any} */ (this);

    const activeFile = view.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      throw new Error('请先打开要发布的 markdown 笔记');
    }

    // 1. 截取正文(复用小红书「> 发布正文：」标记块;缺失=格式不符,直接暴露)
    const markdownSource = await view.app.vault.cachedRead(activeFile);
    const body = extractXBody(markdownSource);
    if (!body) {
      throw new Error('未找到正文标记「> 发布时复制下面这段作为笔记正文：」,请检查笔记格式');
    }
    const title = extractRednoteTitle(markdownSource) || activeFile.basename;

    // 2. 确保图卡预览已挂载(X 复用小红书图卡渲染)
    if (!view.rednoteController) {
      await view.setPreviewMode?.('rednote');
    }
    const previewEl = view.rednoteController?.getPreviewEl();
    if (!previewEl) {
      throw new Error('图卡预览尚未就绪,请先在顶栏切到「小红书」或「X」确认图卡');
    }

    // 3. 渲染全部图卡(与预览所见一致)
    const notice = new Notice('正在渲染 X 图卡...', 0);
    try {
      const { DownloadManager } = await import('../../rednote/index.ts');
      const blobs = await DownloadManager.exportAllImageBlobs(previewEl);

      if (!blobs.length) {
        throw new Error('图卡预览未渲染出任何图卡,请先在顶栏切到图卡预览、确认图卡显示后再发布');
      }

      notice.setMessage(`正在处理 ${blobs.length} 张图卡...`);
      const cards = [];
      const buffers = [];
      for (const blob of blobs) {
        const { base64, buffer } = await blobToBase64AndBuffer(blob);
        cards.push({ base64, size: blob.size });
        buffers.push(buffer);
      }

      // 4. 落盘 sync-to-x/(先清空,发布后保留)
      notice.setMessage('正在写入 sync-to-x 目录...');
      const dirPath = await syncCardsToXFolder(view.app, activeFile, buffers);

      const article = buildXArticle({ title, body, cards, notePath: activeFile.path });
      notice.hide();
      return { article, dirPath, cardCount: blobs.length };
    } catch (error) {
      notice.hide();
      throw error;
    }
  },
};
