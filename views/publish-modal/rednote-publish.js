// views/publish-modal/rednote-publish.js
//
// 「发布到小红书」编排(AppleStyleView mixin):
//   渲染当前 rednote 预览的全部图卡 → 落盘 sync-to-rednote/(先清空) →
//   从笔记原文截取标题/正文 → 组装 article → 经浏览器插件桥接投递到小红书。
// 图片即当前预览所见;发布后 sync-to-rednote/ 内文件保留(留档,不删除)。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import { toReadableError } from '../../services/input-utils.js';
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

/**
 * 在扩展上报的平台列表里找小红书的平台 id。
 * @param {Array<{ id?: string, name?: string }>} platforms
 * @returns {string}
 */
function findXiaohongshuPlatformId(platforms) {
  const list = Array.isArray(platforms) ? platforms : [];
  const hit = list.find((platform) => {
    const id = String(platform?.id || '').toLowerCase();
    const name = String(platform?.name || '');
    return id.includes('xiaohongshu') || id === 'xhs' || name.includes('小红书');
  });
  return hit ? String(hit.id) : '';
}

export const rednotePublishMixin = {
  /**
   * 顶栏「发布」按钮统一入口:按当前预览平台分流。
   * 公众号 → 原「发布与分发」窗口;小红书 → 图卡发布链路。
   */
  async handlePublishAction() {
    const view = /** @type {any} */ (this);
    if (view._previewMode === 'rednote') {
      try {
        await view.publishRednoteCards();
      } catch (error) {
        new Notice(`❌ 发布到小红书失败：${toReadableError(error).message}`, 9000);
      }
      return;
    }
    view.showSyncModal();
  },

  /**
   * rednote 预览底部「发布到小红书」的执行体(由 RedPreviewController 回调)。
   * 任何一步失败直接抛错(按钮侧统一 Notice),不做静默兜底。
   */
  async publishRednoteCards() {
    const view = /** @type {any} */ (this);

    // 0. 前置校验
    const multiPlatform = view.plugin.settings.multiPlatformSync || {};
    if (!multiPlatform.enabled) {
      throw new Error('请先在设置 →「其他平台」里开启浏览器插件发布并完成配对');
    }
    const activeFile = view.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      throw new Error('请先打开要发布的 markdown 笔记');
    }
    const previewEl = view.rednoteController?.getPreviewEl();
    if (!previewEl) {
      throw new Error('小红书预览尚未就绪');
    }
    const platformId = findXiaohongshuPlatformId(multiPlatform.supportedPlatforms);
    if (!platformId) {
      throw new Error('平台列表里没找到小红书,请在设置 →「其他平台」点「测试连接」刷新平台列表');
    }

    // 1. 截取标题/正文(正文标记缺失=格式不符,直接暴露)
    const markdownSource = await view.app.vault.cachedRead(activeFile);
    const body = extractRednoteBody(markdownSource);
    if (!body) {
      throw new Error('未找到正文标记「> 发布时复制下面这段作为笔记正文：」,请检查笔记格式');
    }
    const title = extractRednoteTitle(markdownSource) || activeFile.basename;

    // 2. 渲染全部图卡(与预览所见一致)
    const notice = new Notice('正在渲染小红书图卡...', 0);
    try {
      const { DownloadManager } = await import('../../rednote/index.ts');
      const blobs = await DownloadManager.exportAllImageBlobs(previewEl);

      // 3. Blob → base64 + ArrayBuffer
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

      // 5. 组装 article 并经桥接投递
      notice.setMessage('正在发送到浏览器插件...');
      const article = buildRednoteArticle({ title, body, cards, notePath: activeFile.path });
      const bridge = view.plugin.getWechatSyncBridgeService();
      const result = await bridge.enqueueSyncArticle({
        platforms: [platformId],
        title: article.title,
        markdown: article.markdown,
        content: article.content,
        cover: article.cover,
        assets: article.assets,
        source: 'obsidian',
      });

      notice.hide();
      const syncId = result && typeof result === 'object' ? (/** @type {any} */ (result).syncId || '') : '';
      new Notice(
        `✅ 已投递小红书(${blobs.length} 张图卡)${syncId ? `,任务 ${syncId}` : ''}。`
        + `图卡已存至 ${dirPath}/。请到浏览器插件任务窗口或小红书草稿箱查看结果。`,
        10000
      );
    } catch (error) {
      notice.hide();
      throw new Error(toReadableError(error).message);
    }
  },
};
