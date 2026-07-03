// views/publish-modal/wechat-sync-modal.js
//
// WeChat sync modal UI (failure actions, account prompt, publish-modal shell,
// mode tabs, and the main showSyncModal draft-sync tab), extracted from the
// AppleStyleView god-class (Phase 5) as a prototype mixin (Object.assign onto
// the view prototype) so `this` usage is unchanged.

import { obsidianApi, getObsidianModalClass, createObsidianModal, isMobileClient, getActiveDocumentCompat } from '../../services/obsidian-adapters.js';
import { isRecord } from '../../services/input-utils.js';
import { resolveSyncAccount } from '../../services/sync-context.js';
import { htmlToText, getEventTargetValue } from '../../services/dom-utils.js';
import { MULTI_PLATFORM_TAB_LABEL } from '../../services/settings-defaults.js';
import { WechatAPI } from '../../services/wechat-api.js';
import { getDraftAssociation, clearDraftAssociation } from '../../services/wechat-draft-cache.js';

const { Notice } = obsidianApi;

export const wechatSyncModalMixin = {
  /**
   * @param {string} message
   * @param {SyncModalOptionsLike} [options]
   */
  showSyncFailureActions(message, options = {}) {
    if (typeof getObsidianModalClass() !== 'function') {
      new Notice(`❌ 同步失败: ${message}`);
      return;
    }

    const modal = createObsidianModal(this.app);
    modal.titleEl.setText('同步失败');
    modal.contentEl.addClass('wechat-sync-modal');
    if (isMobileClient(this.app)) {
      modal.contentEl.addClass('wechat-sync-modal-mobile');
      modal.modalEl?.addClass('wechat-sync-shell-mobile');
    }

    const body = modal.contentEl.createDiv({ cls: 'wechat-sync-failure-state' });
    body.createEl('p', { cls: 'wechat-sync-failure-message', text: message });
    
    const isProxyAuth = !!options.isProxyAuth;
    const hasDraftAssociation = !isProxyAuth && !!options.draftAssociation?.mediaId && !!options.draftAssociation?.sourcePath;
    
    let hintText = '可以重试同步，或先检查账号配置。';
    if (isProxyAuth) {
      hintText = '请检查您的 API 代理地址和 Token 配置是否正确。若服务已到期，请联系作者续费。';
    } else if (hasDraftAssociation) {
      hintText = '可以重试同步；如果微信后台草稿已被删除或无法更新，也可以取消关联后新建草稿。';
    }

    body.createEl('p', {
      cls: 'wechat-sync-failure-hint',
      text: hintText
    });

    const btnRow = modal.contentEl.createDiv({ cls: 'wechat-modal-buttons' });
    const closeBtn = btnRow.createEl('button', { text: '关闭' });
    closeBtn.onclick = () => modal.close();

    const settingsBtn = btnRow.createEl('button', { text: '去配置账号' });
    settingsBtn.onclick = () => {
      modal.close();
      if (!this.openPluginSettings()) {
        new Notice('请在设置中打开 Obsidian 发布助手并配置公众号账号');
      }
    };

    if (hasDraftAssociation) {
      const resetDraftBtn = btnRow.createEl('button', { text: '取消关联并新建草稿' });
      resetDraftBtn.onclick = async () => {
        modal.close();
        clearDraftAssociation(this.plugin.settings, options.draftAssociation.sourcePath);
        this.sessionDraftMediaId = '';
        this.sessionDraftIndex = 0;
        await this.plugin.saveSettings();
        await this.onSyncToWechat();
      };
    }

    const retryBtn = btnRow.createEl('button', { text: '重试同步', cls: 'mod-cta' });
    retryBtn.onclick = async () => {
      modal.close();
      await this.onSyncToWechat();
    };

    modal.open();
  },

  /**
   * 提示用户先配置公众号账号（空状态 + 引导操作）
   */
  promptConfigureWechatAccount() {
    this.showAccountSetupEmptyState();
  },

  /**
   * 显示同步选项 Modal
   */
  /**
   * @param {ModalLike} modal
   * @param {{ mode?: string, mobileSync?: boolean }} [options]
   */
  preparePublishModalShell(modal, { mode = 'wechat', mobileSync = false } = {}) {
    modal.titleEl.setText('发布与分发');
    modal.titleEl.removeClass?.('wechat-multiplatform-title');
    if (typeof modal.contentEl.empty === 'function') {
      modal.contentEl.empty();
    } else {
      modal.contentEl.replaceChildren?.();
    }
    modal.contentEl.addClass('wechat-sync-modal');
    modal.contentEl.removeClass?.('wechat-multiplatform-modal');
    modal.contentEl.removeClass?.('wechat-multiplatform-result-modal');
    modal.contentEl.removeClass?.('wechat-feishu-modal-content');
    modal.modalEl?.addClass('wechat-publish-shell');
    modal.modalEl?.removeClass?.('wechat-multiplatform-shell');
    if (mobileSync) {
      modal.contentEl.addClass('wechat-sync-modal-mobile');
      modal.modalEl?.addClass('wechat-sync-shell-mobile');
    }
    if (mode === 'multi') {
      modal.titleEl.addClass?.('wechat-multiplatform-title');
      modal.contentEl.addClass('wechat-multiplatform-modal');
      modal.modalEl?.addClass('wechat-multiplatform-shell');
    }
  },

  /**
   * @param {ModalLike} modal
   * @param {string} [activeMode]
   * @returns {{ wechatTab: ObsidianElementLike, multiPlatformTab: ObsidianElementLike }}
   */
  createPublishModeTabs(modal, activeMode = 'wechat') {
    const publishModeTabs = modal.contentEl.createDiv({ cls: 'wechat-publish-mode-tabs' });
    const wechatTab = publishModeTabs.createEl('button', {
      text: '微信草稿箱',
      cls: `wechat-publish-mode-tab${activeMode === 'wechat' ? ' is-active' : ''}`,
    });

    const feishuTab = publishModeTabs.createEl('button', {
      text: '飞书云文档',
      cls: `wechat-publish-mode-tab${activeMode === 'feishu' ? ' is-active' : ''}`,
    });

    const multiPlatformTab = publishModeTabs.createEl('button', {
      cls: `wechat-publish-mode-tab${activeMode === 'multi' ? ' is-active' : ''}`,
    });
    multiPlatformTab.createEl('span', { text: MULTI_PLATFORM_TAB_LABEL });
    return { wechatTab, feishuTab, multiPlatformTab };
  },

  /**
   * @param {SyncModalOptionsLike} [options]
   */
  showSyncModal(options = {}) {
    if (!this.currentHtml) {
      new Notice(this.getMissingRenderNotice());
      return;
    }

    const accounts = this.plugin.settings.wechatAccounts || [];
    if (accounts.length === 0) {
      if (!options.modal) {
        if (this.plugin.settings.feishuSync?.enabled) {
          this.showFeishuSyncModal();
          return;
        }
        if (this.plugin.settings.multiPlatformSync?.enabled) {
          this.showMultiPlatformSyncModal();
          return;
        }
      }
      const modal = options.modal || createObsidianModal(this.app);
      const mobileSync = isMobileClient(this.app);
      this.preparePublishModalShell(modal, { mode: 'wechat', mobileSync });
      const { feishuTab, multiPlatformTab } = this.createPublishModeTabs(modal, 'wechat');
      if (feishuTab) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- reason: dynamic tab element click handler
        feishuTab.onclick = () => this.showFeishuSyncModal({ modal });
      }
      multiPlatformTab.onclick = () => this.showMultiPlatformSyncModal({ modal });
      const empty = modal.contentEl.createDiv({ cls: 'wechat-sync-empty-state' });
      empty.createEl('h3', { text: '尚未配置微信公众号账号' });
      empty.createEl('p', { text: '微信草稿箱需要先配置公众号 API。其他平台仍可通过浏览器插件发送。' });
      const settingsBtn = empty.createEl('button', { text: '去设置', cls: 'mod-cta' });
      settingsBtn.onclick = () => {
        modal.close();
        this.openPluginSettings();
      };
      if (!options.modal) {
        modal.open();
      }
      return;
    }
    const modal = options.modal || createObsidianModal(this.app);
    const shouldOpenModal = !options.modal;
    const mobileSync = isMobileClient(this.app);
    this.preparePublishModalShell(modal, { mode: 'wechat', mobileSync });

    const { feishuTab, multiPlatformTab } = this.createPublishModeTabs(modal, 'wechat');
    if (feishuTab) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- reason: dynamic tab element click handler
      feishuTab.onclick = () => {
        this.showFeishuSyncModal({ modal });
      };
    }
    multiPlatformTab.onclick = () => {
      this.showMultiPlatformSyncModal({ modal });
    };

    // 获取当前活动文件的路径，用于状态缓存
    const activeFile = this.getPublishContextFile();
    const currentPath = activeFile ? activeFile.path : null;
    const frontmatterMeta = this.getFrontmatterPublishMeta(activeFile);

    // 尝试从缓存读取状态
    /** @type {ArticleSessionStateLike | null} */
    let cachedState = null;
    if (currentPath && this.articleStates.has(currentPath)) {
      cachedState = this.articleStates.get(currentPath);
    }

    const defaultId = this.plugin.settings.defaultAccountId;
    const hasDefault = accounts.some((account) => account.id === defaultId);
    let selectedAccountId = hasDefault ? defaultId : (accounts[0]?.id || '');

    // 封面逻辑：优先使用缓存 -> frontmatter.cover -> 文章第一张图
    let coverBase64 = cachedState?.coverBase64 || frontmatterMeta.coverSrc || this.getFirstImageFromArticle() || '';
    let thumbMediaId = cachedState?.thumbMediaId || '';
    /** @type {WechatMaterialSelectionLike | null} */
    let materialCover = cachedState?.materialCover || null;

    // 更新 sessionCoverBase64 以便 onSyncToWechat 使用
    this.sessionCoverBase64 = coverBase64;
    this.sessionThumbMediaId = thumbMediaId;

    /** @returns {WechatAccountLike | null} */
    const getSelectedAccount = () => {
      const resolvedAccount = /** @type {unknown} */ (resolveSyncAccount({
        accounts: this.plugin.settings.wechatAccounts || [],
        selectedAccountId,
        defaultAccountId: this.plugin.settings.defaultAccountId,
      }));
      return isRecord(resolvedAccount) ? /** @type {WechatAccountLike} */ (resolvedAccount) : null;
    };
    const getSelectedDraftAssociation = () => currentPath
      ? /** @type {DraftAssociationLike | null} */ (getDraftAssociation(this.plugin.settings, currentPath, getSelectedAccount()?.id || selectedAccountId))
      : null;
    /** @type {DraftAssociationLike | null} */
    let draftAssociation = getSelectedDraftAssociation();
    let forceNewDraft = false;

    // 账号选择器
    const accountSection = modal.contentEl.createDiv({ cls: 'wechat-modal-section' });
    accountSection.createEl('label', { text: '账号', cls: 'wechat-modal-label' });
    if (accounts.length === 1) {
      const onlyAccount = accounts[0];
      selectedAccountId = onlyAccount.id;
      accountSection.createEl('div', {
        cls: 'wechat-sync-account-single',
        text: `${onlyAccount.name} (默认)`
      });
    } else {
      const accountSelect = /** @type {ObsidianInputLike} */ (accountSection.createEl('select', { cls: 'wechat-account-select' }));

      for (const account of accounts) {
        const option = /** @type {ObsidianInputLike} */ (accountSelect.createEl('option', {
          value: account.id,
          text: account.id === defaultId ? `${account.name} (默认)` : account.name
        }));
        if (account.id === selectedAccountId) option.selected = true;
      }
      accountSelect.addEventListener('change', (e) => {
        selectedAccountId = getEventTargetValue(e, selectedAccountId);
        draftAssociation = getSelectedDraftAssociation();
        forceNewDraft = false;
        if (typeof updatePreview === 'function') updatePreview();
        if (typeof updateDraftStatusUI === 'function') updateDraftStatusUI();
      });
    }

    if (mobileSync) {
      const hasCoverForModal = !!coverBase64 || !!thumbMediaId;
      modal.contentEl.createEl('p', {
        cls: 'wechat-sync-mobile-quick-hint',
        text: hasCoverForModal
          ? '可直接同步；封面与摘要可在高级选项中调整。'
          : '当前未检测到封面，请在高级选项中上传封面后再同步。'
      });
    }

    const advancedOptions = modal.contentEl.createEl('details', { cls: 'wechat-sync-advanced' });
    const shouldExpandAdvanced = !mobileSync || (!coverBase64 && !thumbMediaId);
    if (shouldExpandAdvanced) advancedOptions.setAttribute('open', '');
    advancedOptions.createEl('summary', {
      cls: 'wechat-sync-advanced-summary',
      text: '高级选项（标题、封面与摘要）'
    });
    const advancedBody = advancedOptions.createDiv({ cls: 'wechat-sync-advanced-body' });

    // 标题设置
    const titleSection = advancedBody.createDiv({ cls: 'wechat-modal-section' });
    titleSection.createEl('label', { text: '文章标题', cls: 'wechat-modal-label' });

    // 标题逻辑：优先使用缓存 -> frontmatter.title -> 文件名
    const initialTitle = cachedState?.title !== undefined
      ? cachedState.title
      : (frontmatterMeta.title || (activeFile ? activeFile.basename : ''));

    const titleInput = /** @type {ObsidianInputLike} */ (titleSection.createEl('input', {
      type: 'text',
      cls: 'wechat-modal-title-input',
      placeholder: '留空则默认使用 frontmatter 中的 title 或文件名'
    }));
    titleInput.value = initialTitle;
    titleInput.setCssStyles({ width: '100%' });
    titleInput.maxLength = 64; // 微信标题最大限制 64 字符

    // 实时更新缓存（标题）
    titleInput.addEventListener('input', () => {
      if (currentPath) {
        const state = this.articleStates.get(currentPath) || {};
        this.articleStates.set(currentPath, { ...state, title: titleInput.value.trim() });
      }
    });

    // 封面设置
    const coverSection = advancedBody.createDiv({ cls: 'wechat-modal-section' });
    coverSection.createEl('label', { text: '封面图', cls: 'wechat-modal-label' });

    const coverContent = coverSection.createDiv({ cls: 'wechat-modal-cover-content' });
    const coverPreview = coverContent.createDiv({ cls: 'wechat-modal-cover-preview' });

    const updatePreview = () => {
      coverPreview.empty();
      coverPreview.removeClass('has-material-cover');
      if (thumbMediaId) {
        coverPreview.addClass('has-material-cover');
        const materialPreview = coverPreview.createDiv({ cls: 'wechat-modal-cover-material-preview' });
        const materialTitle = materialCover?.name || '素材库封面';
        const imageFrame = materialPreview.createDiv({ cls: 'wechat-modal-cover-material-frame' });
        if (coverBase64) {
          const img = imageFrame.createEl('img', {
            attr: { src: coverBase64, alt: materialTitle },
          });
          img.onerror = () => {
            img.remove();
            imageFrame.addClass('has-image-error');
          };
        } else {
          imageFrame.addClass('has-image-error');
        }
        const meta = materialPreview.createDiv({ cls: 'wechat-modal-cover-material-meta' });
        meta.createEl('span', { text: '素材库' });
        meta.createEl('strong', { text: materialTitle });
        syncBtn.disabled = false;
        syncBtn.setText(getSyncButtonText());
        syncBtn.removeClass('apple-btn-disabled');
      } else if (coverBase64) {
        coverPreview.createEl('img', { attr: { src: coverBase64 } });
        // 有封面 -> 启用同步按钮
        syncBtn.disabled = false;
        syncBtn.setText(getSyncButtonText());
        syncBtn.removeClass('apple-btn-disabled');
      } else {
        // UI 优化：去除 emoji，使用纯净的提示样式 (样式在 CSS 中定义)
        coverPreview.createEl('div', {
          text: '暂无封面',
          cls: 'wechat-modal-no-cover'
        });
        // 无封面 -> 禁用同步按钮
        syncBtn.disabled = true;
        syncBtn.setText('请先设置封面');
        syncBtn.addClass('apple-btn-disabled');
      }
    };

    const coverBtns = coverContent.createDiv({ cls: 'wechat-modal-cover-btns' });
    const uploadBtn = coverBtns.createEl('button', { text: '上传' });
    const selectMaterialBtn = coverBtns.createEl('button', {
      text: '从素材库选择',
      cls: 'wechat-cover-select-material-btn',
    });
    const referencedBtn = coverBtns.createEl('button', {
      text: '本篇引用',
      cls: 'wechat-cover-referenced-btn',
    });

    // 摘要设置
    const digestSection = advancedBody.createDiv({ cls: 'wechat-modal-section' });
    digestSection.createEl('label', { text: '文章摘要（可选）', cls: 'wechat-modal-label' });

    // 自动提取文章前 45 字作为默认摘要
    const autoDigest = htmlToText(this.currentHtml || '').replace(/\s+/g, ' ').trim().substring(0, 45);

    // 摘要逻辑：优先使用缓存 -> frontmatter.excerpt -> 自动提取
    const initialDigest = cachedState?.digest !== undefined
      ? cachedState.digest
      : (frontmatterMeta.excerpt || autoDigest);

    const digestInput = /** @type {ObsidianInputLike & { rows: number, maxLength: number }} */ (digestSection.createEl('textarea', {
      cls: 'wechat-modal-digest-input',
      placeholder: '留空则自动提取文章前 45 字'
    }));
    // Explicitly set the value to ensure it renders correctly in the textarea
    digestInput.value = initialDigest;

    digestInput.rows = 3;
    digestInput.setCssStyles({
      width: '100%',
      resize: 'vertical',
    });
    digestInput.maxLength = 120; // 限制最大输入 120 字

    // 字数统计
    const charCount = digestSection.createEl('div', {
      cls: 'wechat-digest-count',
      text: `${digestInput.value.length}/120`,
      style: 'text-align: right; font-size: 11px; color: var(--text-muted); margin-top: 4px; opacity: 0.7;'
    });

    // 实时更新缓存（摘要）
    digestInput.addEventListener('input', () => {
      charCount.setText(`${digestInput.value.length}/120`);
      if (currentPath) {
        const state = this.articleStates.get(currentPath) || {};
        state.digest = digestInput.value.trim(); // 允许为空字符串（代表清空）
        // 如果用户清空了输入框，我们存空字符串，以便下次打开也是空的（还是说回退到 auto?）
        // 逻辑修正：如果用户清空，通常意味着想用默认或不发摘要。这里我们存用户输入的值。
        // 但如果原本逻辑是"空则自动提取"，那这里输入框空的时候，sessionDigest 会变成 autoDigest
        this.articleStates.set(currentPath, { ...state, digest: digestInput.value });
      }
    });

    const draftStatusEl = modal.contentEl.createDiv({ cls: 'wechat-draft-status' });
    const getSyncButtonText = () => (draftAssociation && !forceNewDraft ? '更新草稿' : '开始同步');
    const updateDraftStatusUI = () => {
      if (!draftStatusEl) return;
      draftStatusEl.empty();
      if (!draftAssociation || forceNewDraft) return;

      let confirmUnlink = false;
      const statusText = draftStatusEl.createEl('span', {
        text: '已关联微信草稿，同步将更新该草稿',
      });
      const unlinkBtn = draftStatusEl.createEl('button', {
        text: '取消关联',
        cls: 'wechat-draft-unlink',
      });
      unlinkBtn.onclick = async () => {
        if (!confirmUnlink) {
          confirmUnlink = true;
          draftStatusEl.addClass('is-confirming');
          statusText.setText('再次点击确认取消关联');
          unlinkBtn.setText('确认取消');
          return;
        }
        forceNewDraft = true;
        if (currentPath) {
          clearDraftAssociation(this.plugin.settings, currentPath);
          await this.plugin.saveSettings();
        }
        draftAssociation = null;
        syncBtn.setText(getSyncButtonText());
        updateDraftStatusUI();
      };
    };

    // 操作按钮
    const btnRow = modal.contentEl.createDiv({ cls: 'wechat-modal-buttons' });

    const cancelBtn = btnRow.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const syncBtn = btnRow.createEl('button', { text: getSyncButtonText(), cls: 'mod-cta' });
    // 初始化时就检查状态
    updatePreview();
    updateDraftStatusUI();

    syncBtn.onclick = async () => {
      if (!coverBase64 && !thumbMediaId) {
        new Notice('❌ 请先设置封面图');
        return;
      }
      modal.close();
      this.selectedAccountId = selectedAccountId;
      this.sessionCoverBase64 = coverBase64;
      this.sessionThumbMediaId = thumbMediaId;
      this.sessionDraftMediaId = (!forceNewDraft && draftAssociation?.mediaId) ? draftAssociation.mediaId : '';
      this.sessionDraftIndex = (!forceNewDraft && Number.isInteger(draftAssociation?.index)) ? draftAssociation.index : 0;
      // 传递用户输入的标题，或使用 frontmatter 标题或文件名
      this.sessionTitle = titleInput.value.trim() || frontmatterMeta.title || (activeFile ? activeFile.basename : '无标题文章');
      // 传递用户输入的摘要，或使用自动提取的摘要
      this.sessionDigest = digestInput.value.trim() || autoDigest || '一键同步自 Obsidian';
      await this.onSyncToWechat();
    };

    // 实时更新缓存（封面图） - 需要修改 uploadBtn 的回调逻辑
    uploadBtn.onclick = () => {
      const activeDocument = getActiveDocumentCompat();
      if (!activeDocument) return;
      const input = /** @type {HTMLInputElement} */ (activeDocument.createElement('input'));
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const target = e.target instanceof HTMLInputElement ? e.target : null;
        const file = target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          coverBase64 = typeof event.target?.result === 'string' ? event.target.result : '';
          thumbMediaId = '';
          materialCover = null;
          this.sessionCoverBase64 = coverBase64;
          this.sessionThumbMediaId = '';
          updatePreview();

          // 更新缓存
          if (currentPath) {
            const state = this.articleStates.get(currentPath) || {};
            this.articleStates.set(currentPath, {
              ...state,
              coverBase64: coverBase64,
              thumbMediaId: '',
              materialCover: null,
            });
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    selectMaterialBtn.onclick = async () => {
      const account = getSelectedAccount();
      if (!account) {
        new Notice('请先配置公众号账号');
        return;
      }

      const api = new WechatAPI(account.appId, account.appSecret, this.plugin.settings.proxyUrl, this.plugin.settings.clientId);
      await this.showMaterialPickerModal(api, (material) => {
        thumbMediaId = material.mediaId;
        coverBase64 = material.url || '';
        materialCover = {
          mediaId: material.mediaId,
          url: material.url || '',
          name: material.name || '',
        };
        this.sessionCoverBase64 = coverBase64;
        this.sessionThumbMediaId = thumbMediaId;
        updatePreview();

        if (currentPath) {
          const state = this.articleStates.get(currentPath) || {};
          this.articleStates.set(currentPath, { ...state, coverBase64, thumbMediaId, materialCover });
        }
      });
    };

    referencedBtn.onclick = async () => {
      if (!activeFile) {
        new Notice('未找到当前笔记，无法读取本篇引用的图片');
        return;
      }
      await this.showReferencedImagePickerModal(activeFile, (image) => {
        coverBase64 = image.src;
        thumbMediaId = '';
        materialCover = null;
        this.sessionCoverBase64 = coverBase64;
        this.sessionThumbMediaId = '';
        updatePreview();

        if (currentPath) {
          const state = this.articleStates.get(currentPath) || {};
          this.articleStates.set(currentPath, { ...state, coverBase64, thumbMediaId: '', materialCover: null });
        }
      });
    };

    if (shouldOpenModal) modal.open();
  },
};
