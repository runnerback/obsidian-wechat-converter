// views/publish-modal/media-assets.js
//
// 发布用媒体/封面/HTML 资产处理：图片 src→Blob、正文图片/数学公式处理、
// SVG→PNG、草稿 HTML 清理与准备、封面缩略图、本地图片转 dataURL 等，从
// AppleStyleView god-class（Phase 7）抽出为 prototype mixin（Object.assign 到
// view 原型），方法内 `this` 用法保持不变。

import { obsidianApi, getObsidianRequestUrl, getActiveDocumentCompat, createFallbackSvgElement } from '../../services/obsidian-adapters.js';
import { createHtmlContainer } from '../../services/dom-utils.js';
import { toImageElements, dataUrlToBlob, pMap } from '../../services/input-utils.js';
import { rasterizeSvgToPngBlob } from '../../services/svg-rasterizer.js';
import { processAllImages as processAllImagesService, processMathFormulas as processMathFormulasService } from '../../services/wechat-media.js';
import { cleanHtmlForDraft as cleanHtmlForDraftService } from '../../services/wechat-html-cleaner.js';
import { mapAppUrlImagesToAssetUrls } from '../../services/article-image-assets.js';

const { Notice } = obsidianApi;

export const mediaAssetsMixin = {
  /**
   * 将各种形式的 src (Base64, URL, 路径) 转为 Blob
   */
  /**
   * @param {string} src
   * @returns {Promise<Blob>}
   */
  async srcToBlob(src) {
    // Base64/data URL 图片直接本地解析，避免对 data: URL 发起 fetch。
    if (src.startsWith('data:')) {
      return dataUrlToBlob(src);
    }

    // Obsidian 本地资源 (app:// 或 capacitor://) 可以直接 fetch
    if (src.startsWith('app://') || src.startsWith('capacitor://')) {
      const resp = await window.fetch(src);
      return await resp.blob();
    }

    // HTTP/HTTPS 图床链接需要使用 requestUrl 绕过 CORS
    if (src.startsWith('http')) {
      const requestUrl = getObsidianRequestUrl();
      if (typeof requestUrl !== 'function') {
        throw new Error('当前 Obsidian 版本不支持 requestUrl');
      }
      const response = /** @type {{ arrayBuffer?: ArrayBuffer, headers?: Record<string, string> }} */ (await requestUrl({ url: src }));
      // requestUrl 返回 ArrayBuffer，需要转换为 Blob
      const headers = response.headers || {};
      const contentType = headers['content-type'] || headers['Content-Type'] || 'image/jpeg';
      const buffer = response.arrayBuffer instanceof ArrayBuffer ? response.arrayBuffer : new ArrayBuffer(0);
      return new Blob([buffer], { type: contentType });
    }

    throw new Error('不支持的图片来源，请尝试重新上传封面');
  },

  /**
   * 处理 HTML 中的所有图片，上传到微信并替换链接
   * 支持并发上传 (Limit 3) 和进度回调
   */
  /**
   * @param {string} html
   * @param {WechatAPI} api
   * @param {((current: number, total: number) => unknown) | undefined} progressCallback
   * @param {{ accountId?: string, onImageFailure?: (failure: ImageUploadFailureLike) => unknown }} [cacheContext]
   * @returns {Promise<string>}
   */
  async processAllImages(html, api, progressCallback, cacheContext = {}) {
    const accountId = cacheContext?.accountId || '';
    return /** @type {Promise<string>} */ (processAllImagesService({
      html,
      api,
      progressCallback,
      pMap,
      srcToBlob: (src) => this.srcToBlob(String(src || '')),
      imageUploadCache: this.imageUploadCache,
      cacheNamespace: accountId,
      onImageFailure: cacheContext?.onImageFailure,
    }));
  },

  /**
   * 处理 HTML 中的数学公式 (MathJax SVG -> Wechat Image)
   * 解决微信接口内容长度限制问题
   */
  /**
   * @param {string} html
   * @param {WechatAPI} api
   * @param {((current: number, total: number) => unknown) | undefined} progressCallback
   * @returns {Promise<string>}
   */
  async processMathFormulas(html, api, progressCallback) {
    return /** @type {Promise<string>} */ (processMathFormulasService({
      html,
      api,
      progressCallback,
      pMap,
      simpleHash: (value) => this.simpleHash(String(value || '')),
      svgUploadCache: this.svgUploadCache,
      svgToPngBlob: (svgElement, scale) => this.svgToPngBlob(
        svgElement instanceof SVGElement ? svgElement : createFallbackSvgElement(),
        typeof scale === 'number' ? scale : 3
      ),
    }));
  },

  /**
   * 将 SVG 元素转换为高分辨率 PNG Blob
   * 返回: { blob, width, height, style }
   */
  /**
   * @param {SVGElement} svgElement
   * @param {number} [scale]
   * @returns {Promise<{ blob: Blob, width: number, height: number, style?: string }>}
   */
  async svgToPngBlob(svgElement, scale = 3) {
    return rasterizeSvgToPngBlob(svgElement, { scale });
  },

  /**
   * 清理 HTML 以适配微信编辑器
   * 微信编辑器对嵌套列表支持不佳，需要：
   * 1. 处理嵌套列表父级 li 内的段落与行内内容（避免嵌套层级被打散）
   * 2. 将深层嵌套列表转为伪列表（避免微信扁平化）
   * 3. 移除嵌套 ul/ol 的 margin（避免被当成独立块）
   * 4. 移除空的 li 元素和空白文本节点
   */
  /**
   * @param {string} html
   * @returns {string}
   */
  cleanHtmlForDraft(html) {
    return cleanHtmlForDraftService(html);
  },

  /**
   * @param {string} html
   * @returns {Promise<string>}
   */
  async prepareHtmlForWechatDraft(html) {
    const tempDiv = createHtmlContainer('div', html || '');
    if (!tempDiv) return '';
    await this.enhanceHtmlForWechatPublishing(tempDiv);
    return tempDiv.innerHTML;
  },

  /**
   * @param {string} html
   * @returns {Promise<string>}
   */
  async prepareHtmlForWechatsyncArticle(html) {
    const tempDiv = createHtmlContainer('div', html || '');
    if (!tempDiv) return '';
    await this.processImagesToDataURL(tempDiv);
    this.transformCodeBlocksForWechatsync(tempDiv);
    return tempDiv.innerHTML;
  },

  // Bridge publish flow only. Unlike prepareHtmlForWechatsyncArticle (which
  // inlines local images as data: URLs for the legacy WeChat clipboard
  // flow), the bridge protocol carries image bytes via assets[] separately.
  // Inlining base64 here would double-encode every local image: once into
  // assets[] (correct), once into content[] (~33% inflated). The latter
  // also breaks retry, because the extension has to redact base64 before
  // persisting history (storage quota), and a redacted data: URL cannot be
  // re-published. So: rewrite app:// img srcs back to asset://<id> using
  // the assets[] metadata resolveArticleImages already produced. Do NOT
  // call processImagesToDataURL.
  /**
   * @param {string} html
   * @param {unknown[]} [assets]
   * @returns {Promise<string>}
   */
  async prepareHtmlForWechatsyncArticleViaBridge(html, assets = []) {
    const mapped = mapAppUrlImagesToAssetUrls(html || '', assets);
    const tempDiv = createHtmlContainer('div', mapped);
    if (!tempDiv) return '';
    this.transformCodeBlocksForWechatsync(tempDiv);
    return tempDiv.innerHTML;
  },

  // Bridge publish flow: produce a small inline JPEG data URL for the
  // cover asset, suitable for direct <img src> use in the extension's
  // popup History list (which cannot resolve asset:// URLs in plain DOM).
  // Budget: longest edge ≤ COVER_THUMBNAIL_MAX_DIM (256px), JPEG quality
  // tries 0.7 → 0.55 → 0.4 until size ≤ COVER_THUMBNAIL_MAX_BYTES (~8KB).
  // Returns '' on any failure — the extension will fall back to its own
  // local-thumbnail path. Never throws into the publish pipeline.
  /**
   * @param {WechatsyncAssetLike | null | undefined} asset
   * @returns {Promise<string>}
   */
  async generateCoverThumbnailFromAsset(asset) {
    try {
      if (!asset || typeof asset !== 'object') return '';
      const base64 = typeof asset.base64 === 'string' ? asset.base64 : '';
      const mimeType = typeof asset.mimeType === 'string' ? asset.mimeType : '';
      if (!base64 || !mimeType) return '';
      // GIFs would lose animation if we re-encode to JPEG; skip and let
      // the extension fall back to its local-thumbnail path (which can
      // keep the first frame). Plugin keeps the implementation small.
      if (mimeType === 'image/gif') return '';

      const sourceDataUrl = `data:${mimeType};base64,${base64}`;
      const image = /** @type {HTMLImageElement} */ (await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image_decode_failed'));
        img.src = sourceDataUrl;
      }));

      const naturalW = image.naturalWidth || image.width || 0;
      const naturalH = image.naturalHeight || image.height || 0;
      if (!naturalW || !naturalH) return '';

      const MAX_DIM = 256;
      const scale = Math.min(1, MAX_DIM / Math.max(naturalW, naturalH));
      const targetW = Math.max(1, Math.round(naturalW * scale));
      const targetH = Math.max(1, Math.round(naturalH * scale));

      const activeDocument = getActiveDocumentCompat();
      if (!activeDocument) return '';
      const canvas = activeDocument.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(image, 0, 0, targetW, targetH);

      const MAX_BYTES = 8 * 1024;
      // The data URL prefix `data:image/jpeg;base64,` adds ~22 bytes; we
      // compare the whole string length against MAX_BYTES, accepting
      // that the prefix counts toward the budget (negligible).
      for (const quality of [0.7, 0.55, 0.4]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (typeof dataUrl === 'string' && dataUrl.length <= MAX_BYTES) {
          return dataUrl;
        }
      }
      // Even the lowest quality is too big; return empty so the
      // extension does the local fallback instead of carrying a payload
      // that bloats `chrome.storage.local`.
      return '';
    } catch (err) {
      console.warn('[Wechatsync] generateCoverThumbnailFromAsset failed', err);
      return '';
    }
  },

  /**
   * 将 HTML 中的本地图片转换为 Base64 (Canvas Compressed)
   */
  /**
   * @param {Element} container
   * @returns {Promise<boolean>}
   */
  async processImagesToDataURL(container) {
    const images = toImageElements(container.querySelectorAll('img'));
    const localImages = images.filter(img => img.src.startsWith('app://') || img.src.startsWith('capacitor://'));

    if (localImages.length === 0) return false;

    // Start time for minimum duration check (prevents UX flicker)
    const startTime = Date.now();

    // 并发控制：3个一组
    const concurrency = 3;
    for (let i = 0; i < localImages.length; i += concurrency) {
      const chunk = localImages.slice(i, i + concurrency);
      await Promise.all(chunk.map(img => this.convertImageToLocally(img)));
    }

    // Calculate elapsed time and wait if needed
    const elapsed = Date.now() - startTime;
    const minDuration = 800; // 800ms minimum duration
    if (elapsed < minDuration) {
      await new Promise(resolve => window.setTimeout(resolve, minDuration - elapsed));
    }

    return true;
  },


  /**
   * @param {HTMLImageElement} img
   * @returns {Promise<void>}
   */
  async convertImageToLocally(img) {
    try {
      // CRITICAL FIX: app:// 资源在 Electron 中可以直接 fetch！
      // 我们不需要反向查找 TFile，直接 fetch(img.src) 拿 blob 即可！
      const response = await window.fetch(img.src);
      const blob = await response.blob();

      // 检查大小警告
      if (blob.size > 10 * 1024 * 1024) {
        new Notice(`⚠️ 发现大图 (${(blob.size / 1024 / 1024).toFixed(1)}MB)，处理可能较慢`, 5000);
      }

      /** @type {string} */
      let dataUrl;
      // GIF Protection: Bypass compression for GIFs to preserve animation
      if (blob.type === 'image/gif') {
        // Direct read for GIF
        dataUrl = await this.blobToDataUrl(blob);
      } else {
        // Compress others (JPG/PNG) to JPEG 80%
        dataUrl = await this.blobToJpegDataUrl(blob);
      }

      img.src = dataUrl;
      // 清除 Obsidian 特有的 dataset 属性，避免干扰
      delete img.dataset.src;
    } catch (error) {
      console.error('Image processing failed:', error);
      // 保持原样，至少不破图（虽然微信会看不到）
    }
  },

  // Helper: Direct Blob to Base64 (for GIFs)
  /**
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  blobToJpegDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const activeDocument = getActiveDocumentCompat();
        if (!activeDocument) {
          URL.revokeObjectURL(url);
          reject(new Error('Document unavailable'));
          return;
        }
        const canvas = activeDocument.createElement('canvas');
        let width = image.width;
        let height = image.height;

        // Resize slightly if too massive (e.g. > 1920)
        if (width > 1920) {
          height = Math.round(height * (1920 / width));
          width = 1920;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);

        // Compress to JPEG 80%
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      image.src = url;
    });
  },
};
