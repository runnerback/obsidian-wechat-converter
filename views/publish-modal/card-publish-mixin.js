// views/publish-modal/card-publish-mixin.js
//
// 图卡发布准备的通用实现(小红书 / X 共用)。渲染当前图卡预览 → 落盘
// sync-to-<prefix>/(先清空) → 截取正文(复用「> 发布正文：」标记块)→
// 组装桥接 article。两个平台仅 config(prefix/label/sourceKind/methodName)不同。
// 投递由「发布与分发 → 其他平台」统一发送流程执行。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import {
  extractCardBody,
  extractCardTitle,
  syncCardsToPlatformFolder,
  buildCardArticle,
} from '../../services/card-publish.js';

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

/**
 * 图卡发布准备通用流程。任何一步不满足直接抛错(调用方决定跳过/报错),不兜底。
 * @param {any} view AppleStyleView 实例
 * @param {{ prefix: string, label: string, sourceKind: string }} config
 * @returns {Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>}
 */
export async function prepareCardArticle(view, config) {
  const activeFile = view.app.workspace.getActiveFile();
  if (!activeFile || activeFile.extension !== 'md') {
    throw new Error('请先打开要发布的 markdown 笔记');
  }

  // 1. 截取正文(复用「> 发布正文：」标记块;缺失=格式不符,直接暴露)
  const markdownSource = await view.app.vault.cachedRead(activeFile);
  const body = extractCardBody(markdownSource);
  if (!body) {
    throw new Error('未找到正文标记「> 发布时复制下面这段作为笔记正文：」,请检查笔记格式');
  }
  const title = extractCardTitle(markdownSource) || activeFile.basename;

  // 2. 确保图卡预览已挂载(小红书/X 复用同一图卡渲染)
  if (!view.rednoteController) {
    await view.setPreviewMode?.('rednote');
  }
  const previewEl = view.rednoteController?.getPreviewEl();
  if (!previewEl) {
    throw new Error('图卡预览尚未就绪,请先在顶栏切到「小红书」或「X」确认图卡');
  }

  // 3. 渲染全部图卡(与预览所见一致)
  const notice = new Notice(`正在渲染${config.label}图卡...`, 0);
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

    // 4. 落盘 sync-to-<prefix>/(先清空,发布后保留)
    notice.setMessage(`正在写入 sync-to-${config.prefix} 目录...`);
    const dirPath = await syncCardsToPlatformFolder(view.app, activeFile, buffers, config.prefix);

    const article = buildCardArticle({
      title, body, cards, notePath: activeFile.path,
      prefix: config.prefix, sourceKind: config.sourceKind,
    });
    notice.hide();
    return { article, dirPath, cardCount: blobs.length };
  } catch (error) {
    notice.hide();
    throw error;
  }
}
