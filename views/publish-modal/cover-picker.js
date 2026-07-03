// views/publish-modal/cover-picker.js
//
// WeChat material-library + "本篇引用" cover pickers, extracted from the
// AppleStyleView god-class (Phase 5) as a prototype mixin (Object.assign onto
// the view prototype) so method bodies keep using `this` unchanged.

import { createObsidianModal, isMobileClient } from '../../services/obsidian-adapters.js';
import { toReadableError } from '../../services/input-utils.js';
import { collectArticleImageReferences } from '../../services/article-image-assets.js';
import { renderSelectableImageGrid } from './image-grid.js';

export const coverPickerMixin = {
  /**
   * @param {any} api
   * @param {string} type
   * @param {number} offset
   * @param {number} count
   * @returns {string}
   */
  getWechatMaterialCacheKey(api, type, offset, count) {
    return [
      api?.appId || '',
      api?.proxyUrl || '',
      type || 'image',
      Number(offset) || 0,
      Number(count) || 20,
    ].join('::');
  },

  /**
   * @param {any} api
   * @param {string} type
   * @param {number} offset
   * @param {number} count
   * @param {{ forceRefresh?: boolean, ttlMs?: number }} [options]
   * @returns {Promise<any>}
   */
  async loadWechatMaterialPage(api, type, offset, count, options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : 5 * 60 * 1000;
    if (!this.wechatMaterialCache) this.wechatMaterialCache = new Map();

    const key = this.getWechatMaterialCacheKey(api, type, offset, count);
    const cached = this.wechatMaterialCache.get(key);
    const now = Date.now();
    for (const [cacheKey, entry] of this.wechatMaterialCache.entries()) {
      if (!entry || now - entry.cachedAt >= ttlMs) {
        this.wechatMaterialCache.delete(cacheKey);
      }
    }
    if (!forceRefresh && cached && now - cached.cachedAt < ttlMs) {
      return {
        ...cached.data,
        fromCache: true,
      };
    }

    const data = await api.batchGetMaterials(type, offset, count);
    this.wechatMaterialCache.set(key, {
      cachedAt: now,
      data,
    });
    return {
      ...data,
      fromCache: false,
    };
  },

  /**
   * @param {any} api
   * @param {(material: any) => unknown} onSelect
   */
  async showMaterialPickerModal(api, onSelect) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText('从素材库选择封面');
    modal.modalEl?.addClass('wechat-material-picker-modal');
    modal.contentEl.addClass('wechat-material-picker');

    if (isMobileClient(this.app)) {
      modal.modalEl?.addClass('wechat-material-picker-modal-mobile');
      modal.contentEl.addClass('wechat-material-picker-mobile');
    }

    const pageSize = 12;
    let currentPage = 1;
    let totalCount = 0;
    /** @type {any} */
    let selectedItem = null;
    let isLoading = false;

    const toolbar = modal.contentEl.createDiv({ cls: 'wechat-material-toolbar' });
    const refreshBtn = toolbar.createEl('button', { text: '刷新' });
    const toolbarMeta = toolbar.createDiv({ cls: 'wechat-material-toolbar-meta' });
    const countLabel = toolbarMeta.createDiv({ cls: 'wechat-material-count', text: '正在加载素材库...' });
    const cacheLabel = toolbarMeta.createDiv({ cls: 'wechat-material-cache-note' });
    const grid = modal.contentEl.createDiv({ cls: 'wechat-material-grid' });
    const footer = modal.contentEl.createDiv({ cls: 'wechat-material-footer' });
    const pagination = footer.createDiv({ cls: 'wechat-material-pagination' });
    const confirmBtn = footer.createEl('button', { text: '使用这张封面', cls: 'mod-cta wechat-material-confirm' });
    confirmBtn.disabled = true;

    const renderLoadingSkeleton = () => {
      grid.empty();
      grid.addClass('is-loading');
      for (let i = 0; i < pageSize; i += 1) {
        const skeleton = grid.createDiv({ cls: 'wechat-material-skeleton' });
        skeleton.createDiv({ cls: 'wechat-material-skeleton-thumb' });
        skeleton.createDiv({ cls: 'wechat-material-skeleton-name' });
      }
    };

    /**
     * @param {(page: number, options?: { forceRefresh?: boolean }) => Promise<void> | void} loadPage
     */
    const renderPagination = (loadPage) => {
      pagination.empty();
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      if (totalPages <= 1) return;

      const prevBtn = pagination.createEl('button', { text: '上一页', cls: 'wechat-material-page-btn' });
      prevBtn.disabled = currentPage <= 1;
      prevBtn.onclick = () => loadPage(currentPage - 1);

      pagination.createEl('span', {
        text: `第 ${currentPage} / ${totalPages} 页`,
        cls: 'wechat-material-page-label',
      });

      const nextBtn = pagination.createEl('button', { text: '下一页', cls: 'wechat-material-page-btn' });
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.onclick = () => loadPage(currentPage + 1);
    };

    /**
     * @param {any[]} items
     */
    const renderItems = (items) => {
      const mapped = (Array.isArray(items) ? items : [])
        .map((item) => {
          const mediaId = item.media_id || item.mediaId || '';
          if (!mediaId) return null;
          const name = item.name || '未命名图片';
          return {
            key: mediaId,
            thumbUrl: item.url || '',
            name,
            title: name,
            payload: { mediaId, url: item.url || '', name: item.name || '' },
          };
        })
        .filter(Boolean);
      renderSelectableImageGrid({
        grid,
        items: /** @type {any[]} */ (mapped),
        confirmBtn,
        emptyText: '素材库中暂无图片素材',
        onSelect: (payload) => {
          selectedItem = payload;
        },
      });
    };

    /**
     * @param {number} page
     * @param {{ forceRefresh?: boolean }} [options]
     */
    const loadPage = async (page, options = {}) => {
      if (isLoading) return;
      isLoading = true;
      currentPage = Math.max(1, page);
      selectedItem = null;
      confirmBtn.disabled = true;
      pagination.empty();
      countLabel.setText('正在加载素材库...');
      cacheLabel.setText('');
      renderLoadingSkeleton();

      try {
        const offset = (currentPage - 1) * pageSize;
        const data = await this.loadWechatMaterialPage(api, 'image', offset, pageSize, {
          forceRefresh: options.forceRefresh === true,
        });
        totalCount = Number.isFinite(data.total_count) ? data.total_count : 0;
        const items = Array.isArray(data.item) ? data.item : [];
        countLabel.setText(totalCount > 0 ? `共 ${totalCount} 张图片素材` : '暂无图片素材');
        cacheLabel.setText(data.fromCache ? '当前页列表来自缓存' : '');
        renderItems(items);
        renderPagination(loadPage);
      } catch (error) {
        grid.empty();
        grid.removeClass('is-loading');
        countLabel.setText('加载失败');
        grid.createDiv({ cls: 'wechat-material-empty', text: `加载失败：${toReadableError(error).message}` });
      } finally {
        isLoading = false;
      }
    };

    refreshBtn.onclick = () => loadPage(1, { forceRefresh: true });
    confirmBtn.onclick = () => {
      if (!selectedItem) return;
      modal.close();
      onSelect({
        mediaId: selectedItem.mediaId,
        url: selectedItem.url || '',
        name: selectedItem.name || '',
      });
    };

    modal.open();
    modal.modalEl?.addClass('wechat-material-picker-modal');
    await loadPage(1);
  },

  /**
   * 收集当前 md 文档里引用的本地图片（jpg/png/webp），用于"本篇引用"封面选择。
   * @param {any} activeFile
   * @returns {Promise<Array<{ src: string, name: string, path: string, alt: string }>>}
   */
  async getReferencedLocalImages(activeFile) {
    /** @type {Array<{ src: string, name: string, path: string, alt: string }>} */
    const out = [];
    try {
      if (!activeFile || typeof this.app?.vault?.read !== 'function') return out;
      const markdown = await this.app.vault.read(activeFile);
      const references = collectArticleImageReferences(markdown);
      const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
      const seenPaths = new Set();
      const sourcePath = typeof activeFile.path === 'string' ? activeFile.path : '';

      for (const reference of references) {
        let raw = String(reference?.src || '').trim();
        if (!raw) continue;
        if (/^(https?:|data:)/i.test(raw)) continue; // 跳过远程图床/内联数据
        if (raw.startsWith('<') && raw.endsWith('>')) raw = raw.slice(1, -1).trim();

        // 去掉锚点与尺寸标记；对百分号编码的路径解码
        let linkpath = raw.split('#')[0].split('|')[0].trim();
        if (!linkpath) continue;
        try {
          linkpath = decodeURIComponent(linkpath);
        } catch (decodeError) {
          void decodeError; // 非法编码时保留原样
        }

        const resolved = this.app.metadataCache?.getFirstLinkpathDest?.(linkpath, sourcePath);
        const file = resolved && typeof resolved.extension === 'string' ? resolved : null;
        if (!file) continue;
        if (!allowedExtensions.has(file.extension.toLowerCase())) continue;
        if (seenPaths.has(file.path)) continue;
        seenPaths.add(file.path);

        const src = this.app.vault.getResourcePath(file);
        if (!src) continue;
        out.push({
          src,
          name: typeof file.name === 'string' ? file.name : linkpath,
          path: file.path,
          alt: String(reference?.alt || ''),
        });
      }
    } catch (error) {
      console.warn('收集本篇引用图片失败:', error);
    }
    return out;
  },

  /**
   * 弹出"本篇引用图片"网格，供用户选择一张作为封面。
   * @param {any} activeFile
   * @param {(image: { src: string, name: string, path: string, alt: string }) => void} onSelect
   * @returns {Promise<void>}
   */
  async showReferencedImagePickerModal(activeFile, onSelect) {
    const images = await this.getReferencedLocalImages(activeFile);

    const modal = createObsidianModal(this.app);
    modal.titleEl.setText('从本篇引用图片选择封面');
    modal.modalEl?.addClass('wechat-material-picker-modal');
    modal.contentEl.addClass('wechat-material-picker');
    if (isMobileClient(this.app)) {
      modal.modalEl?.addClass('wechat-material-picker-modal-mobile');
      modal.contentEl.addClass('wechat-material-picker-mobile');
    }

    const toolbar = modal.contentEl.createDiv({ cls: 'wechat-material-toolbar' });
    toolbar.createDiv({
      cls: 'wechat-material-count',
      text: images.length > 0 ? `本篇共引用 ${images.length} 张可用图片` : '本篇没有可用作封面的图片',
    });

    const grid = modal.contentEl.createDiv({ cls: 'wechat-material-grid' });
    const footer = modal.contentEl.createDiv({ cls: 'wechat-material-footer' });
    // 与"从素材库选择"弹窗保持一致：footer 左侧占位（对应分页区）+ 右侧确认按钮，
    // 借助 .wechat-material-footer 的 space-between 让按钮靠右。
    footer.createDiv({ cls: 'wechat-material-pagination' });
    const confirmBtn = footer.createEl('button', { text: '使用这张封面', cls: 'mod-cta wechat-material-confirm' });
    confirmBtn.disabled = true;

    /** @type {{ src: string, name: string, path: string, alt: string } | null} */
    let selected = null;

    renderSelectableImageGrid({
      grid,
      items: images.map((image) => ({
        key: image.path,
        thumbUrl: image.src,
        name: image.name,
        title: image.name,
        payload: image,
      })),
      confirmBtn,
      emptyText: '本篇没有可用作封面的图片（仅支持本地 jpg / png / webp）。',
      onSelect: (payload) => {
        selected = /** @type {{ src: string, name: string, path: string, alt: string }} */ (payload);
      },
    });

    confirmBtn.onclick = () => {
      if (!selected) return;
      modal.close();
      if (typeof onSelect === 'function') onSelect(selected);
    };

    modal.open();
    modal.modalEl?.addClass('wechat-material-picker-modal');
  },
};
