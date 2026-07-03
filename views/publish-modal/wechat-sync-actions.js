// views/publish-modal/wechat-sync-actions.js
//
// WeChat draft sync orchestration + task/feishu/multi-platform entry wrappers,
// extracted from the AppleStyleView god-class (Phase 5) as a prototype mixin
// (Object.assign onto the view prototype) so `this` usage is unchanged.

import { obsidianApi, createObsidianModal, isMobileClient } from '../../services/obsidian-adapters.js';
import { normalizeMultiPlatformSyncSettings, hasWechatSyncCapability } from '../../services/wechatsync-settings.js';
import { toReadableError, isRecord, toRecord } from '../../services/input-utils.js';
import { isUnsupportedBridgeMethodError as isWechatSyncUnsupportedMethodError } from '../../services/wechatsync-bridge.js';
import { showMultiPlatformPublishModal } from './multi-platform.js';
import { renderFeishuPublishTab } from './feishu.js';
import { updatePublishFrontmatter } from '../../services/publish-status.js';
import { resolveSyncAccount, toSyncFriendlyMessage } from '../../services/sync-context.js';
import { createWechatSyncService } from '../../services/wechat-sync.js';
import { WechatAPI } from '../../services/wechat-api.js';
import { setDraftAssociation } from '../../services/wechat-draft-cache.js';

const { Notice } = obsidianApi;

export const wechatSyncActionsMixin = {
  /**
   * @param {unknown} syncId
   * @returns {Promise<boolean>}
   */
  async openWechatsyncTask(syncId) {
    const taskId = String(syncId || '').trim();
    if (!taskId) {
      new Notice('当前任务没有 syncId，请在浏览器插件历史记录中查看最近任务');
      return false;
    }

    const settings = normalizeMultiPlatformSyncSettings(this.plugin.settings.multiPlatformSync);
    const bridge = this.plugin.getWechatSyncBridgeService();
    try {
      await bridge.start();
      if (typeof bridge.waitForConnection === 'function') {
        await bridge.waitForConnection(8000);
      }
      const capabilities = settings.connection.capabilities || {};

      if (capabilities.openSyncTask !== false) {
        try {
          const result = typeof bridge.openSyncTask === 'function'
            ? toRecord(await bridge.openSyncTask(taskId, { timeoutMs: 8000 }))
            : {};
          if (result?.opened !== false) {
            new Notice('已打开浏览器插件任务窗口');
            return true;
          }
        } catch (error) {
          if (!isWechatSyncUnsupportedMethodError(error)) throw error;
          const readableError = toReadableError(error);
          const errorRecord = toRecord(error);
          console.warn('[Wechatsync] openSyncTask failed, falling back to task link', {
            code: errorRecord.code,
            message: readableError.message,
          });
        }
      }

      if (capabilities.getSyncTaskLink !== false) {
        try {
          const linkResult = typeof bridge.getSyncTaskLink === 'function'
            ? toRecord(await bridge.getSyncTaskLink(taskId, { timeoutMs: 5000 }))
            : {};
          const url = String(linkResult?.url || '').trim();
          if (linkResult?.canOpen !== false && url) {
            return this.openExternalUrl(url, { allowExtensionUrls: true });
          }
          if (typeof linkResult?.message === 'string' && linkResult.message) {
            new Notice(linkResult.message, 8000);
            return false;
          }
        } catch (error) {
          if (!isWechatSyncUnsupportedMethodError(error)) throw error;
          const readableError = toReadableError(error);
          const errorRecord = toRecord(error);
          console.warn('[Wechatsync] getSyncTaskLink failed', {
            code: errorRecord.code,
            message: readableError.message,
          });
        }
      }

      new Notice(`请在浏览器插件历史记录中查看任务：${taskId}`, 10000);
      return false;
    } catch (error) {
      const readableError = toReadableError(error);
      const errorRecord = toRecord(error);
      console.error('[Wechatsync] open task failed', {
        syncId: taskId,
        code: errorRecord.code,
        message: readableError.message,
      });
      new Notice(`无法打开浏览器插件任务：${readableError.message}`, 10000);
      return false;
    }
  },

  /**
   * @param {any} bridge
   * @param {unknown} syncId
   * @returns {Promise<any>}
   */
  async getWechatsyncTaskSnapshot(bridge, syncId) {
    const taskId = String(syncId || '').trim();
    if (!taskId) return null;
    const settings = normalizeMultiPlatformSyncSettings(this.plugin.settings.multiPlatformSync);
    if (!hasWechatSyncCapability(settings, 'getSyncTask')) return null;

    try {
      const task = typeof bridge.getSyncTask === 'function'
        ? toRecord(await bridge.getSyncTask(taskId, { timeoutMs: 5000 }))
        : {};
      if (task?.found === false) return task;
      return Object.keys(task).length ? /** @type {any} */ (task) : null;
    } catch (error) {
      if (isWechatSyncUnsupportedMethodError(error)) return null;
      const readableError = toReadableError(error);
      const errorRecord = toRecord(error);
      console.warn('[Wechatsync] getSyncTask failed after enqueue', {
        syncId: taskId,
        code: errorRecord.code,
        message: readableError.message,
      });
      return null;
    }
  },

  /**
   * @param {Record<string, unknown>} [options]
   * @returns {Promise<unknown>}
   */
  async showMultiPlatformSyncModal(options = {}) {
    return /** @type {Promise<unknown>} */ (showMultiPlatformPublishModal(this, { ...options, obsidianApi }));
  },

  /**
   * @param {{ modal?: any }} [options]
   */
  showFeishuSyncModal(options = {}) {
    const modal = options.modal || createObsidianModal(this.app);
    const mobileSync = isMobileClient(this.app);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- reason: dynamic modal parameter
    this.preparePublishModalShell(modal, { mode: 'feishu', mobileSync });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- reason: dynamic modal parameter
    const { wechatTab, multiPlatformTab } = this.createPublishModeTabs(modal, 'feishu');
    if (wechatTab) {
      wechatTab.onclick = () => {
        this.showSyncModal({ modal });
      };
    }
    if (multiPlatformTab) {
      multiPlatformTab.onclick = () => {
        this.showMultiPlatformSyncModal({ modal });
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- reason: dynamic modal element
    renderFeishuPublishTab(this, modal, modal.contentEl, { obsidianApi });

    if (!options.modal) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- reason: dynamic modal API call
      modal.open();
    }
  },

  /**
   * 发布/分发成功后，把"已同步"状态写入源笔记的 frontmatter（英文 key）。
   * 仅记录成功的平台；累加去重；不改文件名/文件夹。
   * @param {any} file
   * @param {{ successfulTargets: Array<{ platform: string, kind?: string, account?: string, url?: string }>, requestedCount?: number }} payload
   * @returns {Promise<void>}
   */
  async recordPublishStatus(file, payload) {
    try {
      const targets = payload && Array.isArray(payload.successfulTargets) ? payload.successfulTargets : [];
      if (!file || targets.length === 0) return;
      const fileManager = this.app?.fileManager;
      if (!fileManager || typeof fileManager.processFrontMatter !== 'function') return;
      const now = new Date();
      await fileManager.processFrontMatter(file, (frontmatter) => {
        updatePublishFrontmatter(frontmatter, {
          targets,
          requestedCount: typeof payload.requestedCount === 'number' ? payload.requestedCount : targets.length,
          date: now,
        });
      });
    } catch (error) {
      console.warn('记录发布状态到 frontmatter 失败:', error);
    }
  },

  /**
   * 处理同步到微信逻辑
   */
  async onSyncToWechat() {
    const accountRecord = /** @type {unknown} */ (resolveSyncAccount({
      accounts: this.plugin.settings.wechatAccounts || [],
      selectedAccountId: this.selectedAccountId,
      defaultAccountId: this.plugin.settings.defaultAccountId,
    }));
    const account = isRecord(accountRecord) ? /** @type {any} */ (accountRecord) : null;

    if (!account) {
      this.promptConfigureWechatAccount();
      return;
    }

    if (!this.currentHtml) {
      new Notice(this.getMissingRenderNotice());
      return;
    }

    const notice = new Notice(`🚀 正在使用 ${account.name} 同步...`, 0);
    const activeFile = this.getPublishContextFile();
    const publishMeta = this.getFrontmatterPublishMeta(activeFile);

    try {
      const syncService = /** @type {any} */ (createWechatSyncService({
        createApi: (appId, appSecret, proxyUrl) => new WechatAPI(appId, appSecret, proxyUrl, this.plugin.settings.clientId),
        srcToBlob: (src) => this.srcToBlob(String(src || '')),
        coverUploadCache: this.coverUploadCache,
        processAllImages: (html, api, progressCallback, options) => this.processAllImages(String(html || ''), api, progressCallback, options),
        processMathFormulas: (html, api, progressCallback) => this.processMathFormulas(String(html || ''), api, progressCallback),
        prepareHtmlForDraft: (html) => this.prepareHtmlForWechatDraft(String(html || '')),
        cleanHtmlForDraft: (html) => this.cleanHtmlForDraft(String(html || '')),
        cleanupConfiguredDirectory: (file) => this.cleanupConfiguredDirectory(isRecord(file) ? /** @type {any} */ (file) : null),
        getFirstImageFromArticle: () => this.getFirstImageFromArticle(),
      }));

      const result = await syncService.syncToDraft({
        account,
        proxyUrl: this.plugin.settings.proxyUrl,
        currentHtml: this.getCurrentExportHtml() || '',
        activeFile,
        publishMeta,
        sessionTitle: this.sessionTitle,
        sessionCoverBase64: this.sessionCoverBase64 || '',
        sessionThumbMediaId: this.sessionThumbMediaId || '',
        sessionDigest: this.sessionDigest,
        draftMediaId: this.sessionDraftMediaId || '',
        draftIndex: this.sessionDraftIndex || 0,
        onStatus: (stage) => {
          if (stage === 'cover') notice.setMessage('正在处理封面图...');
          if (stage === 'images') notice.setMessage('正在同步正文图片...');
          if (stage === 'math') notice.setMessage('正在转换矢量图/数学公式...');
          if (stage === 'draft') notice.setMessage(this.sessionDraftMediaId ? '正在更新微信草稿...' : '正在发送到微信草稿箱...');
        },
        onImageProgress: (current, total) => {
          notice.setMessage(`正在同步正文图片 (${current}/${total})...`);
        },
        onMathProgress: (current, total) => {
          notice.setMessage(`正在转换矢量图/数学公式 (${current}/${total})...`);
        },
      });

      const { cleanupResult, imageUploadFailures, placeholderImageSources, mediaId, isUpdate, draftIndex } = result;
      if (activeFile && mediaId) {
        setDraftAssociation(this.plugin.settings, {
          sourcePath: activeFile.path,
          mediaId,
          accountId: account.id || '',
          title: publishMeta.title || activeFile.basename,
          index: draftIndex || 0,
          updatedAt: Date.now(),
        });
        await this.plugin.saveSettings();
      }

      notice.hide();
      new Notice(isUpdate ? '✅ 更新成功！微信草稿已更新' : '✅ 同步成功！请前往微信公众号后台草稿箱查看');
      if (activeFile) {
        await this.recordPublishStatus(activeFile, {
          successfulTargets: [{ platform: 'wechat', kind: 'draft', account: account.name || account.id || '' }],
          requestedCount: 1,
        });
      }
      const failedImageSources = Array.from(new Set([
        ...(Array.isArray(imageUploadFailures) ? imageUploadFailures.map(item => item?.src).filter(Boolean) : []),
        ...(Array.isArray(placeholderImageSources) ? placeholderImageSources.filter(Boolean) : []),
      ]));
      if (failedImageSources.length > 0) {
        const preview = failedImageSources.slice(0, 3).join('、');
        const suffix = failedImageSources.length > 3 ? ` 等 ${failedImageSources.length} 张` : '';
        new Notice(`⚠️ 草稿已创建，但有 ${failedImageSources.length} 张正文图片未同步：${preview}${suffix}。请在微信后台手动补传。`, 10000);
      }
      if (cleanupResult?.warning) {
        new Notice(`⚠️ 资源清理失败：${cleanupResult.warning}`, 7000);
      }
    } catch (error) {
      notice.hide();
      console.error('Wechat Sync Error:', error);
      const readableError = toReadableError(error);
      const isProxyAuth = readableError.isProxyAuth || /token|服务已于|安全警报/i.test(readableError.message);
      const friendlyMsg = toSyncFriendlyMessage(readableError.message);
      this.showSyncFailureActions(friendlyMsg, {
        isProxyAuth,
        draftAssociation: (this.sessionDraftMediaId && activeFile) ? {
          sourcePath: activeFile.path,
          mediaId: this.sessionDraftMediaId,
          accountId: account.id || '',
        } : null
      });
    }
  },
};
