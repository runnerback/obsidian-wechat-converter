// views/ai-layout/ai-layout-panel.js
//
// AI 排版（AI 编排）面板 UI + 状态/缓存/预览/调试逻辑，从 AppleStyleView
// god-class（Phase 6）抽出为 prototype mixin（Object.assign 到 view 原型），
// 方法内 `this` 用法保持不变。

import { obsidianApi, getObsidianRequestUrl, getObsidianRequest } from '../../services/obsidian-adapters.js';
import { normalizeVaultPath } from '../../services/path-utils.js';
import { getEventTargetValue, setElementHtml } from '../../services/dom-utils.js';
import { createObsidianFetchAdapter } from '../../services/obsidian-fetch-adapter.js';
import {
  AI_LAYOUT_SCHEMA_VERSION,
  AI_LAYOUT_SELECTION_AUTO,
  createDefaultAiSettings,
  getLayoutFamilyList,
  getLayoutFamilyById,
  getColorPaletteList,
  getColorPaletteById,
  resolveColorPaletteForRender,
  normalizeHexColor,
  normalizeLayoutSelection,
  resolveAiProvider,
  normalizeArticleLayoutCacheEntry,
  extractImageRefsFromHtml,
  extractRenderedSectionFragments,
  generateArticleLayout,
  renderArticleLayoutHtml,
  deriveArticleLayoutStateForSelection,
} from '../../services/ai-layout.js';
import {
  toReadableError,
  toAiLayoutState,
  toAiLayoutBlock,
  toAiLayoutJson,
  toAiLayoutGenerationMeta,
  toRecord,
} from '../../services/input-utils.js';

const { Notice } = obsidianApi;

// 源切换后短暂抑制 stale 提示的时长（ms）；随 markAiLayoutSourceSwitch 一并从 input.js 迁入。
const AI_LAYOUT_SOURCE_SWITCH_STALE_SUPPRESS_MS = 700;

export const aiLayoutPanelMixin = {
  /**
   * @returns {AiLayoutStateLike | null}
   */
  getCurrentArticleAnyLayoutState() {
    const { sourcePath } = this.getCurrentLayoutContext();
    if (!sourcePath) return null;

    if (typeof this.plugin?.getArticleLayoutState === 'function') {
      return toAiLayoutState(this.plugin.getArticleLayoutState(sourcePath, {}) || null);
    }

    const normalizedPath = normalizeVaultPath(sourcePath);
    const entry = this.plugin?.settings?.ai?.articleLayoutsByPath?.[normalizedPath] || null;
    const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
    if (!normalizedEntry) return null;
    return toAiLayoutState(normalizedEntry.familyStates?.[normalizedEntry.lastLayoutFamily] || null);
  },

  hasCurrentArticleAiLayoutCache() {
    const state = this.getCurrentArticleAnyLayoutState();
    return !!(state?.status === 'ready' && Array.isArray(state.layoutJson?.blocks) && state.layoutJson.blocks.length);
  },

  updateAiToolbarState() {
    if (!this.aiLayoutBtn) return;
    const aiSettings = this.plugin.settings?.ai || createDefaultAiSettings();
    const enabled = aiSettings.enabled === true;
    const hasProvider = !!resolveAiProvider(aiSettings);
    const hasCachedLayout = this.hasCurrentArticleAiLayoutCache();
    const shouldShow = enabled && (hasProvider || hasCachedLayout);

    this.aiLayoutBtn.classList.toggle('is-disabled', !shouldShow);
    this.aiLayoutBtn.setAttribute(
      'title',
      !enabled
        ? 'AI 编排已关闭，请先在插件设置中启用'
        : (shouldShow ? 'AI 编排' : '配置可用 AI Provider 后显示 AI 编排入口')
    );
    this.aiLayoutBtn.hidden = !shouldShow;
    if (!shouldShow) {
      if (this.aiLayoutOverlay) this.aiLayoutOverlay.classList.remove('visible');
      this.aiLayoutBtn.classList.remove('active');
    }
  },

  onAiLayoutButtonClick() {
    if (this.plugin.settings?.ai?.enabled !== true) {
      this.closeTransientPanels();
      this.updateAiToolbarState();
      new Notice('AI 编排当前已关闭，请先在插件设置中启用');
      return;
    }
    this.togglePanel(this.aiLayoutOverlay, this.aiLayoutBtn, () => {
      this.resetAiLayoutPanelViewState();
      this.refreshAiLayoutPanel();
    });
  },

  /**
   * @param {ObsidianElementLike} parent
   */
  createAiLayoutPanel(parent) {
    this.attachOverlayScrollGuard(parent, ['.apple-ai-layout-debug-body']);

    const area = parent.createDiv({ cls: 'apple-ai-layout-area' });
    this.aiLayoutArea = area;

    const header = area.createDiv({ cls: 'apple-ai-layout-header' });
    header.createEl('div', { cls: 'apple-ai-layout-title', text: 'AI 编排' });
    header.createEl('div', {
      cls: 'apple-ai-layout-subtitle',
      text: '按当前文章内容生成区块化排版建议',
    });

    this.aiLayoutStatus = area.createDiv({ cls: 'apple-ai-layout-status' });
    this.aiLayoutStatusBadge = this.aiLayoutStatus.createEl('span', { cls: 'apple-ai-layout-badge', text: '未生成' });
    this.aiLayoutStatusBody = this.aiLayoutStatus.createDiv({ cls: 'apple-ai-layout-status-body' });
    this.aiLayoutStatusText = this.aiLayoutStatusBody.createEl('span', {
      cls: 'apple-ai-layout-status-text',
      text: '尚未生成当前文章的 AI 编排结果。',
    });
    this.aiCachedLayoutList = this.aiLayoutStatusBody.createDiv({ cls: 'apple-ai-layout-cache-list' });
    this.aiLayoutSummary = this.aiLayoutStatusBody.createDiv({
      cls: 'apple-ai-layout-summary',
      text: '生成后会在这里展示当前结果的简要说明。',
    });

    const controlSection = area.createDiv({ cls: 'apple-ai-layout-section apple-ai-layout-controls-section' });
    const layoutControl = controlSection.createDiv({ cls: 'apple-ai-layout-control' });
    layoutControl.createEl('label', { cls: 'apple-setting-label', text: '布局' });
    this.aiLayoutFamilySelect = /** @type {ObsidianInputLike} */ (layoutControl.createEl('select', { cls: 'apple-select' }));
    getLayoutFamilyList({ includeAuto: true, includeReserved: false }).forEach((family) => {
      const option = /** @type {ObsidianInputLike} */ (this.aiLayoutFamilySelect.createEl('option', {
        value: family.value,
        text: this.getAiLayoutFamilyLabel(family.value),
      }));
      if ((this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO) === family.value) {
        option.selected = true;
      }
    });

    const paletteControl = controlSection.createDiv({ cls: 'apple-ai-layout-control' });
    paletteControl.createEl('label', { cls: 'apple-setting-label', text: '颜色' });
    this.aiColorPaletteSelect = /** @type {ObsidianInputLike} */ (paletteControl.createEl('select', { cls: 'apple-select apple-ai-layout-color-select' }));
    getColorPaletteList({ includeAuto: true }).forEach((palette) => {
      const option = /** @type {ObsidianInputLike} */ (this.aiColorPaletteSelect.createEl('option', {
        value: palette.value,
        text: palette.label,
      }));
      if ((this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO) === palette.value) {
        option.selected = true;
      }
    });

    this.pendingAiLayoutFamily = this.pendingAiLayoutFamily || this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO;
    this.pendingAiColorPalette = this.pendingAiColorPalette || this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO;
    this.pendingAiStylePack = this.pendingAiColorPalette;
    this.aiLayoutFamilySelect.value = this.pendingAiLayoutFamily;
    this.aiColorPaletteSelect.value = this.pendingAiColorPalette;
    this.aiStylePackSelect = this.aiColorPaletteSelect;
    this.aiColorPaletteControls = paletteControl.createDiv({ cls: 'apple-ai-color-controls' });
    const autoPaletteRow = this.aiColorPaletteControls.createDiv({ cls: 'apple-ai-color-mode-row' });
    this.aiColorPaletteGrid = this.aiColorPaletteControls.createDiv({ cls: 'apple-ai-color-grid' });
    const customPaletteRow = this.aiColorPaletteControls.createDiv({ cls: 'apple-ai-color-custom-row' });
    getColorPaletteList({ includeAuto: true }).forEach((palette) => {
      const isAuto = palette.value === AI_LAYOUT_SELECTION_AUTO;
      const isCustom = palette.value === 'custom';
      const target = isAuto ? autoPaletteRow : (isCustom ? customPaletteRow : this.aiColorPaletteGrid);
      const button = target.createEl('button', {
        cls: isCustom ? 'apple-btn-custom-text apple-ai-color-custom' : (isAuto ? 'apple-ai-color-pill' : 'apple-btn-color apple-ai-color-btn'),
        text: isAuto ? '自动' : (isCustom ? '自定义' : ''),
        title: palette.label,
      });
      button.dataset.value = palette.value;
      if (!isAuto && !isCustom) {
        const pack = getColorPaletteById(palette.value);
        button.style.setProperty('--btn-color', pack?.tokens?.accent || '#7c3aed');
      }
      button.addEventListener('click', async () => {
        await this.onAiColorPaletteChange(palette.value);
        if (isCustom) this.aiCustomColorInput?.click();
      });
    });
    this.aiCustomColorInput = /** @type {ObsidianInputLike} */ (paletteControl.createEl('input', {
      type: 'color',
      cls: 'apple-color-picker-hidden apple-ai-custom-color-input',
    }));
    this.aiCustomColorInput.value = this.getAiCustomColor();
    this.aiCustomColorInput.addEventListener('input', (event) => {
      const nextColor = normalizeHexColor(getEventTargetValue(event, this.getAiCustomColor()), this.getAiCustomColor());
      this.plugin.settings.ai.customColor = nextColor;
    });
    this.aiCustomColorInput.addEventListener('change', async (event) => {
      const nextColor = normalizeHexColor(getEventTargetValue(event, this.getAiCustomColor()), this.getAiCustomColor());
      this.plugin.settings.ai.customColor = nextColor;
      await this.plugin.saveSettings();
      await this.onAiColorPaletteChange('custom', { skipSave: true });
    });
    this.updateAiColorPaletteControls();
    this.aiLayoutFamilySelect.addEventListener('change', () => {
      this.onAiLayoutFamilyChange(this.aiLayoutFamilySelect.value || this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO);
    });
    this.aiColorPaletteSelect.addEventListener('change', () => {
      this.onAiColorPaletteChange(this.aiColorPaletteSelect.value || this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO);
    });

    const actionRow = area.createDiv({ cls: 'apple-ai-layout-actions' });
    this.aiGenerateBtn = actionRow.createEl('button', { cls: 'apple-btn-primary', text: '生成并应用' });
    this.aiGenerateBtn.addEventListener('click', () => this.handleAiPrimaryAction());

    this.aiRegenerateBtn = actionRow.createEl('button', { cls: 'apple-btn-secondary', text: '重新生成并应用' });
    this.aiRegenerateBtn.addEventListener('click', () => this.generateAiLayoutForCurrentArticle({ applyAfterGenerate: true }));

    this.aiResetBtn = actionRow.createEl('button', { cls: 'apple-btn-secondary', text: '恢复普通预览' });
    this.aiResetBtn.addEventListener('click', () => this.restoreBasePreview());

    this.aiRestoreBlocksBtn = actionRow.createEl('button', { cls: 'apple-btn-secondary', text: '恢复已移除' });
    this.aiRestoreBlocksBtn.addEventListener('click', () => this.restoreRemovedAiLayoutBlocks());

    this.aiResultSection = area.createDiv({ cls: 'apple-ai-layout-section apple-ai-layout-result-section' });
    this.aiResultSection.createEl('label', { cls: 'apple-setting-label', text: '区块' });
    this.aiLayoutMetaNote = this.aiResultSection.createDiv({ cls: 'apple-ai-layout-mini-note' });
    this.aiBlockList = this.aiResultSection.createDiv({ cls: 'apple-ai-layout-block-list' });

    const advancedSection = area.createDiv({ cls: 'apple-ai-layout-section apple-ai-layout-advanced' });
    this.aiAdvancedToggleBtn = advancedSection.createEl('button', {
      cls: 'apple-ai-layout-advanced-toggle',
      text: '高级 / 调试',
      attr: { 'aria-expanded': 'false' },
    });
    this.aiAdvancedToggleBtn.addEventListener('click', () => {
      this.aiAdvancedOpen = !this.aiAdvancedOpen;
      if (!this.aiAdvancedOpen) this.aiLayoutDebugMode = '';
      this.refreshAiLayoutPanel();
    });
    this.aiAdvancedBody = advancedSection.createDiv({ cls: 'apple-ai-layout-advanced-body' });

    this.aiLayoutMetaChips = this.aiAdvancedBody.createDiv({ cls: 'apple-ai-layout-meta-chips' });
    this.aiSchemaIssuePanel = this.aiAdvancedBody.createDiv({ cls: 'apple-ai-layout-issues' });

    const debugRow = this.aiAdvancedBody.createDiv({ cls: 'apple-ai-layout-debug-actions' });
    this.aiViewJsonBtn = debugRow.createEl('button', { cls: 'apple-btn-secondary apple-ai-layout-debug-btn', text: '查看布局 JSON' });
    this.aiViewJsonBtn.addEventListener('click', () => this.toggleAiLayoutDebugMode('json'));

    this.aiViewErrorBtn = debugRow.createEl('button', { cls: 'apple-btn-secondary apple-ai-layout-debug-btn', text: '查看错误详情' });
    this.aiViewErrorBtn.addEventListener('click', () => this.toggleAiLayoutDebugMode('error'));

    this.aiDebugPanel = this.aiAdvancedBody.createDiv({ cls: 'apple-ai-layout-debug-panel' });
    const debugHeader = this.aiDebugPanel.createDiv({ cls: 'apple-ai-layout-debug-header' });
    this.aiDebugPanelTitle = debugHeader.createDiv({ cls: 'apple-ai-layout-debug-title', text: '调试输出' });
    const debugTools = debugHeader.createDiv({ cls: 'apple-ai-layout-debug-tools' });
    this.aiCopyPromptBtn = debugTools.createEl('button', {
      cls: 'apple-ai-layout-debug-copy',
      text: '复制给 AI',
      title: '复制一份包含文章摘录、布局摘要和调试信息的排查 Prompt',
    });
    this.aiCopyPromptBtn.addEventListener('click', () => this.copyAiLayoutPromptContext());
    this.aiCopyDebugBtn = debugTools.createEl('button', {
      cls: 'apple-ai-layout-debug-copy',
      text: '复制当前内容',
      title: '复制当前调试面板内容',
    });
    this.aiCopyDebugBtn.addEventListener('click', () => this.copyAiLayoutDebugSnapshot());
    this.aiDebugPanelBody = this.aiDebugPanel.createEl('pre', { cls: 'apple-ai-layout-debug-body' });

    this.aiLayoutLoadingMask = parent.createDiv({ cls: 'apple-ai-layout-loading-mask' });
    const loadingBar = this.aiLayoutLoadingMask.createDiv({ cls: 'apple-ai-layout-loading-bar' });
    loadingBar.createDiv({ cls: 'apple-ai-layout-loading-bar-fill' });
    this.aiLayoutLoadingSpinner = this.aiLayoutLoadingMask.createDiv({ cls: 'apple-ai-layout-loading-spinner' });
    this.aiLayoutLoadingMaskText = this.aiLayoutLoadingMask.createDiv({
      cls: 'apple-ai-layout-loading-text',
      text: '正在生成 AI 编排...',
    });

    this.refreshAiLayoutPanel();
  },

  /**
   * @returns {string}
   */
  getAiCustomColor() {
    return normalizeHexColor(this.plugin.settings?.ai?.customColor, '#7c3aed');
  },

  /**
   * @param {string} [colorPaletteId]
   * @returns {{ customColor: string } | null}
   */
  getAiColorPaletteOverride(colorPaletteId = '') {
    const targetPalette = colorPaletteId || this.getCurrentAiLayoutSelection().colorPalette;
    if (targetPalette !== 'custom') return null;
    return { customColor: this.getAiCustomColor() };
  },

  /**
   * @param {string} [colorPaletteId]
   * @returns {Record<string, unknown>}
   */
  getAiRenderColorPalette(colorPaletteId = '') {
    const targetPalette = colorPaletteId || this.getCurrentAiLayoutSelection().colorPalette || 'tech-green';
    return /** @type {Record<string, unknown>} */ (resolveColorPaletteForRender(targetPalette, this.getAiColorPaletteOverride(targetPalette)));
  },

  updateAiColorPaletteControls() {
    const selectedValue = this.pendingAiColorPalette || this.aiColorPaletteSelect?.value || this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO;
    if (this.aiColorPaletteSelect && this.aiColorPaletteSelect.value !== selectedValue) {
      this.aiColorPaletteSelect.value = selectedValue;
    }
    if (this.aiCustomColorInput) {
      this.aiCustomColorInput.value = this.getAiCustomColor();
    }
    this.aiColorPaletteControls?.querySelectorAll?.('button[data-value]')?.forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      button.classList.toggle('active', button.dataset.value === selectedValue);
    });
  },

  /**
   * @param {AiLayoutJsonLike | null} [layoutJson]
   * @param {string} [colorPaletteId]
   * @returns {AiLayoutJsonLike | null}
   */
  getAiRenderLayoutJson(layoutJson = null, colorPaletteId = '') {
    const layoutRecord = toAiLayoutJson(layoutJson);
    if (!layoutRecord) return layoutRecord;
    const selectedPalette = colorPaletteId || this.getCurrentAiLayoutSelection().colorPalette;
    if (!selectedPalette || selectedPalette === AI_LAYOUT_SELECTION_AUTO) return layoutRecord;
    return {
      ...layoutRecord,
      selection: {
        ...(layoutRecord.selection || {}),
        colorPalette: selectedPalette,
      },
      resolved: {
        ...(layoutRecord.resolved || {}),
        colorPalette: selectedPalette,
      },
      stylePack: selectedPalette,
    };
  },

  /**
   * @param {string} value
   * @param {{ skipSave?: boolean }} [options]
   */
  async onAiColorPaletteChange(value, { skipSave = false } = {}) {
    const nextValue = value || this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO;
    const previousState = this.getCurrentArticleLayoutState();
    this.pendingAiColorPalette = nextValue;
    this.pendingAiStylePack = this.pendingAiColorPalette;
    if (this.aiColorPaletteSelect) this.aiColorPaletteSelect.value = nextValue;
    this.updateAiColorPaletteControls();

    if (!skipSave && nextValue === 'custom') {
      this.plugin.settings.ai.customColor = this.getAiCustomColor();
      await this.plugin.saveSettings();
    }

    await this.ensureAiLayoutSelectionState(previousState, {
      layoutFamily: this.pendingAiLayoutFamily || this.aiLayoutFamilySelect?.value || previousState?.selection?.layoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: this.pendingAiColorPalette,
    });
    if (this.aiPreviewApplied) {
      this.applyAiLayoutToPreview();
      return;
    }
    this.refreshAiLayoutPanel();
  },

  /**
   * @param {string} value
   */
  async onAiLayoutFamilyChange(value) {
    const nextValue = value || this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO;
    this.pendingAiLayoutFamily = nextValue;
    if (this.aiLayoutFamilySelect && this.aiLayoutFamilySelect.value !== nextValue) {
      this.aiLayoutFamilySelect.value = nextValue;
    }

    if (this.aiPreviewApplied) {
      const state = this.getCurrentArticleLayoutState();
      if (state?.layoutJson?.blocks?.length) {
        this.applyAiLayoutToPreview({ stateOverride: state, allowStale: true });
        return;
      }
    }

    this.refreshAiLayoutPanel();
  },

  /**
   * @param {string} colorPaletteId
   */
  applyAiLayoutPanelStylePack(colorPaletteId) {
    if (!this.aiLayoutOverlay) return;
    const pack = this.getAiRenderColorPalette(colorPaletteId || 'tech-green');
    const tokens = toRecord(pack.tokens);
    this.aiLayoutOverlay.style.setProperty('--ai-layout-accent', tokens.accent || '#0a84ff');
    this.aiLayoutOverlay.style.setProperty('--ai-layout-accent-deep', tokens.accentDeep || tokens.accent || '#0a84ff');
    this.aiLayoutOverlay.style.setProperty('--ai-layout-accent-soft', tokens.accentSoft || 'rgba(0, 122, 255, 0.08)');
    this.aiLayoutOverlay.style.setProperty('--ai-layout-accent-border', tokens.accent || '#0a84ff');
  },

  /**
   * @param {AiLayoutBlockLike | unknown} [block]
   * @param {number} [index]
   * @returns {string}
   */
  getAiLayoutBlockStateKey(block = {}, index = 0) {
    const blockRecord = toAiLayoutBlock(block);
    const type = String(blockRecord.type || '').trim();
    const sectionIndex = Number.isInteger(blockRecord.sectionIndex) ? String(blockRecord.sectionIndex) : '';
    const label = String(
      blockRecord.title
      || blockRecord.caseLabel
      || blockRecord.text
      || blockRecord.caption
      || blockRecord.buttonText
      || blockRecord.imageId
      || type
    ).trim();
    return [type, sectionIndex, label, String(index)].join('::');
  },

  /**
   * @param {AiLayoutStateLike | null} state
   * @returns {VisibleAiLayoutSnapshotLike}
   */
  getVisibleAiLayoutSnapshot(state) {
    if (!state?.layoutJson?.blocks?.length) {
      return {
        layoutJson: state?.layoutJson || null,
        blockOrigins: [],
        hiddenCount: 0,
      };
    }

    const dismissedKeys = new Set(Array.isArray(state.dismissedBlockKeys) ? state.dismissedBlockKeys : []);
    /** @type {AiLayoutBlockLike[]} */
    const visibleBlocks = [];
    /** @type {AiLayoutBlockOriginLike[]} */
    const visibleOrigins = [];
    let hiddenCount = 0;

    state.layoutJson.blocks.forEach((block, index) => {
      const blockRecord = toAiLayoutBlock(block);
      const blockKey = this.getAiLayoutBlockStateKey(blockRecord, index);
      if (dismissedKeys.has(blockKey)) {
        hiddenCount += 1;
        return;
      }
      visibleBlocks.push(blockRecord);
      const origin = state.generationMeta?.blockOrigins?.[index];
      if (origin) {
        visibleOrigins.push({
          ...origin,
          originalIndex: index,
          blockKey,
        });
      } else {
        visibleOrigins.push({
          index: visibleBlocks.length - 1,
          type: blockRecord.type || '',
          source: 'ai',
          label: this.getAiLayoutBlockLabel(blockRecord),
          originalIndex: index,
          blockKey,
        });
      }
    });

    return {
      layoutJson: {
        ...state.layoutJson,
        blocks: visibleBlocks,
      },
      blockOrigins: visibleOrigins,
      hiddenCount,
    };
  },

  /**
   * @param {number} originalIndex
   * @param {HTMLElement | ObsidianElementLike | null} [itemEl]
   */
  queueAiLayoutRemovalAnchor(originalIndex, itemEl = null) {
    const state = this.getCurrentArticleLayoutState();
    const visibleSnapshot = this.getVisibleAiLayoutSnapshot(state);
    const visibleOrigins = Array.isArray(visibleSnapshot.blockOrigins) ? visibleSnapshot.blockOrigins : [];
    const removedVisibleIndex = visibleOrigins.findIndex((origin) => origin.originalIndex === originalIndex);
    const nextOrigin = removedVisibleIndex >= 0
      ? (visibleOrigins[removedVisibleIndex + 1] || visibleOrigins[removedVisibleIndex - 1] || null)
      : null;
    const overlay = this.aiLayoutOverlay;
    const relativeTop = overlay && itemEl ? Math.max(0, itemEl.offsetTop - overlay.scrollTop) : 0;
    this.aiLayoutPendingAnchor = {
      blockKey: nextOrigin?.blockKey || '',
      relativeTop,
      fallbackScrollTop: overlay?.scrollTop || 0,
    };
  },

  restoreAiLayoutPendingAnchor() {
    const pendingAnchor = this.aiLayoutPendingAnchor;
    if (!pendingAnchor || !this.aiLayoutOverlay) return;
    const items = Array.from(this.aiBlockList?.querySelectorAll?.('.apple-ai-layout-block-item') || []);
    const targetItem = pendingAnchor.blockKey
      ? items.find((item) => item instanceof HTMLElement && item.dataset.blockKey === pendingAnchor.blockKey)
      : null;
    if (targetItem) {
      this.aiLayoutOverlay.scrollTop = Math.max(0, targetItem.offsetTop - (pendingAnchor.relativeTop || 0));
    } else {
      this.aiLayoutOverlay.scrollTop = Math.max(0, pendingAnchor.fallbackScrollTop || 0);
    }
    this.aiLayoutPendingAnchor = null;
  },

  /**
   * @param {number} originalIndex
   * @param {HTMLElement | ObsidianElementLike | null} [itemEl]
   */
  async removeAiLayoutBlock(originalIndex, itemEl = null) {
    const context = this.getCurrentLayoutContext();
    const state = this.getCurrentArticleLayoutState();
    if (!context.sourcePath || !state?.layoutJson?.blocks?.length) return;
    const block = toAiLayoutBlock(state.layoutJson.blocks[originalIndex]);
    if (!block) return;
    this.queueAiLayoutRemovalAnchor(originalIndex, itemEl);
    const blockKey = this.getAiLayoutBlockStateKey(block, originalIndex);
    const nextDismissedBlockKeys = Array.from(new Set([
      ...(Array.isArray(state.dismissedBlockKeys) ? state.dismissedBlockKeys : []),
      blockKey,
    ]));

    await this.plugin.saveArticleLayoutState(context.sourcePath, {
      ...state,
      dismissedBlockKeys: nextDismissedBlockKeys,
    });

    if (this.aiPreviewApplied) {
      this.applyAiLayoutToPreview();
      return;
    }
    this.refreshAiLayoutPanel();
  },

  async restoreRemovedAiLayoutBlocks() {
    const context = this.getCurrentLayoutContext();
    const state = this.getCurrentArticleLayoutState();
    if (!context.sourcePath || !state) return;
    if (!Array.isArray(state.dismissedBlockKeys) || !state.dismissedBlockKeys.length) return;

    await this.plugin.saveArticleLayoutState(context.sourcePath, {
      ...state,
      dismissedBlockKeys: [],
    });

    if (this.aiPreviewApplied) {
      this.applyAiLayoutToPreview();
      return;
    }
    this.refreshAiLayoutPanel();
  },

  async handleAiPrimaryAction() {
    const mode = this.aiPrimaryActionMode || 'generate-apply';
    if (mode === 'apply') {
      this.applyAiLayoutToPreview();
      return;
    }
    if (mode === 'apply-stale') {
      this.applyAiLayoutToPreview({ allowStale: true });
      return;
    }
    await this.generateAiLayoutForCurrentArticle({ applyAfterGenerate: true });
  },

  /**
   * @param {string} mode
   */
  toggleAiLayoutDebugMode(mode) {
    this.aiAdvancedOpen = true;
    this.aiLayoutDebugMode = this.aiLayoutDebugMode === mode ? '' : mode;
    this.refreshAiLayoutPanel();
  },

  /**
   * @returns {AiLayoutContextLike}
   */
  getCurrentLayoutContext() {
    const activeFile = this.app?.workspace?.getActiveFile?.() || this.lastActiveFile || null;
    const activePath = activeFile?.path || '';
    const resolvedPath = this.lastResolvedSourcePath || '';
    const canUseResolvedSource = !activePath || !resolvedPath || activePath === resolvedPath;
    const sourcePath = canUseResolvedSource ? (resolvedPath || activePath) : activePath;
    const markdown = canUseResolvedSource ? (this.lastResolvedMarkdown || '') : '';
    const sourceHash = markdown ? String(this.simpleHash(markdown)) : '';
    const isSourcePending = !!(activePath && resolvedPath && activePath !== resolvedPath);
    const isSourceSwitching = !!(
      isSourcePending
      && this.aiLayoutSourceSwitchPath
      && this.aiLayoutSourceSwitchPath === activePath
    );
    const isStaleSuppressed = this.isAiLayoutStaleSuppressedForPath(sourcePath);
    const activeFileForTitle = activeFile || this.getPublishContextFile();
    const publishMeta = this.getFrontmatterPublishMeta(activeFileForTitle);
    const title = publishMeta?.title || activeFileForTitle?.basename || '未命名文章';
    return {
      sourcePath,
      markdown,
      sourceHash,
      isSourcePending,
      isSourceSwitching,
      isStaleSuppressed,
      title,
    };
  },

  /**
   * @returns {AiLayoutSelectionLike}
   */
  getCurrentAiLayoutSelection() {
    const aiSettings = this.plugin?.settings?.ai || createDefaultAiSettings();
    return normalizeLayoutSelection({
      layoutFamily: this.pendingAiLayoutFamily || this.aiLayoutFamilySelect?.value || aiSettings.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: this.pendingAiStylePack || this.pendingAiColorPalette || this.aiColorPaletteSelect?.value || this.aiStylePackSelect?.value || aiSettings.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    }, {
      layoutFamily: aiSettings.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: aiSettings.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
  },

  /**
   * @returns {AiLayoutStateLike | null}
   */
  getCurrentArticleLayoutState() {
    const { sourcePath, sourceHash } = this.getCurrentLayoutContext();
    if (!sourcePath) return null;
    const selection = this.getCurrentAiLayoutSelection();
    if (typeof this.plugin?.getArticleLayoutState === 'function') {
      const state = toAiLayoutState(this.plugin.getArticleLayoutState(sourcePath, selection));
      if (state) {
        return this.preferFreshAiLayoutState(sourcePath, selection, state, sourceHash);
      }
    }
    return null;
  },

  /**
   * @param {string} [sourcePath]
   * @param {AiLayoutSelectionLike | Record<string, unknown>} [selection]
   * @param {AiLayoutStateLike | null} [candidateState]
   * @param {string} [sourceHash]
   * @returns {AiLayoutStateLike | null}
   */
  preferFreshAiLayoutState(sourcePath = '', selection = {}, candidateState = null, sourceHash = '') {
    if (!candidateState || !sourceHash || !candidateState.sourceHash || candidateState.sourceHash === sourceHash) {
      return candidateState;
    }

    const normalizedSelection = normalizeLayoutSelection(selection || {}, {
      layoutFamily: this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
    const canUseAnyColor = normalizedSelection.colorPalette === AI_LAYOUT_SELECTION_AUTO;
    if (!canUseAnyColor) return candidateState;

    const normalizedPath = normalizeVaultPath(sourcePath || '');
    const entry = normalizeArticleLayoutCacheEntry(this.plugin?.settings?.ai?.articleLayoutsByPath?.[normalizedPath]);
    const statesByFamily = entry?.familyStates || {};
    const requestedFamily = normalizedSelection.layoutFamily === AI_LAYOUT_SELECTION_AUTO
      ? ''
      : normalizedSelection.layoutFamily;
    const exactState = requestedFamily ? toAiLayoutState(statesByFamily[requestedFamily]) : null;
    if (exactState?.sourceHash === sourceHash && exactState.layoutJson?.blocks?.length) return exactState;

    const lastState = toAiLayoutState(statesByFamily[entry?.lastLayoutFamily]);
    if (lastState?.sourceHash === sourceHash && lastState.layoutJson?.blocks?.length) return lastState;

    return Object.values(statesByFamily).map(toAiLayoutState).find((state) => (
      state?.sourceHash === sourceHash
      && state.layoutJson?.blocks?.length
    )) || candidateState;
  },

  /**
   * @param {AiLayoutStateLike | null} [currentState]
   * @param {AiLayoutSelectionLike | null} [selection]
   * @param {AiLayoutContextLike | null} [context]
   * @returns {Promise<AiLayoutJsonLike | null>}
   */
  async recoverSourceFirstLayoutState(currentState = null, selection = null, context = null) {
    const requestedSelection = normalizeLayoutSelection(selection || this.getCurrentAiLayoutSelection(), {
      layoutFamily: this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
    if (requestedSelection.layoutFamily !== 'source-first') return null;

    const sourceContext = context?.sourcePath ? context : await this.ensureCurrentArticleContext();
    if (!sourceContext?.sourcePath || !sourceContext?.markdown) return null;
    if (currentState?.status === 'ready' && currentState?.layoutJson?.blocks?.length) return currentState;

    const recoveryKey = `${sourceContext.sourcePath}::${requestedSelection.layoutFamily}::${requestedSelection.colorPalette}::${sourceContext.sourceHash}`;
    if (this._sourceFirstRecoveryKey === recoveryKey) return null;
    this._sourceFirstRecoveryKey = recoveryKey;

    try {
      if (!this.baseRenderedHtml) {
        await this.convertCurrent(true, { showLoading: false });
      }
      const aiSettings = this.plugin.settings.ai || createDefaultAiSettings();
      const provider = resolveAiProvider(aiSettings);
      const imageRefs = aiSettings.includeImagesInLayout === false
        ? []
        : extractImageRefsFromHtml(this.baseRenderedHtml || this.currentHtml || '');
      const result = await generateArticleLayout({
        provider,
        title: sourceContext.title,
        markdown: sourceContext.markdown,
        selection: requestedSelection,
        imageRefs,
        timeoutMs: aiSettings.requestTimeoutMs,
        fetchImpl: createObsidianFetchAdapter({ requestUrl: getObsidianRequestUrl(), request: getObsidianRequest() }),
      });
      const layoutJson = toAiLayoutJson(result.layoutJson);
      if (!Array.isArray(layoutJson?.blocks) || !layoutJson.blocks.length) return null;
      await this.plugin.saveArticleLayoutState(sourceContext.sourcePath, {
        version: AI_LAYOUT_SCHEMA_VERSION,
        updatedAt: Date.now(),
        sourceHash: sourceContext.sourceHash,
        providerId: provider?.id || '',
        model: provider?.model || '',
        selection: layoutJson.selection,
        resolved: layoutJson.resolved,
        recommendedLayoutFamily: layoutJson.recommendedLayoutFamily,
        recommendedColorPalette: layoutJson.recommendedColorPalette,
        stylePack: layoutJson.stylePack,
        status: 'ready',
        lastError: '',
        lastAttemptStatus: 'success',
        lastAttemptError: '',
        lastAttemptAt: Date.now(),
        lastAttemptSchemaValidation: null,
        dismissedBlockKeys: [],
        generationMeta: toAiLayoutGenerationMeta(result.generationMeta),
        layoutJson,
      }, layoutJson.selection);
      this.pendingAiLayoutFamily = layoutJson.selection?.layoutFamily || requestedSelection.layoutFamily;
      this.pendingAiColorPalette = layoutJson.selection?.colorPalette || requestedSelection.colorPalette;
      this.pendingAiStylePack = this.pendingAiColorPalette;
      this.refreshAiLayoutPanel();
      return layoutJson;
    } catch (error) {
      console.error('原文增强型本地恢复失败:', error);
      return null;
    } finally {
      if (this._sourceFirstRecoveryKey === recoveryKey) {
        this._sourceFirstRecoveryKey = '';
      }
    }
  },

  /**
   * @param {AiLayoutStateLike | null} [baseState]
   * @param {AiLayoutSelectionLike | null} [selection]
   * @returns {Promise<AiLayoutStateLike | null>}
   */
  async ensureAiLayoutSelectionState(baseState = null, selection = null) {
    const context = this.getCurrentLayoutContext();
    if (!context.sourcePath || typeof this.plugin?.getArticleLayoutState !== 'function') return null;
    const requestedSelection = normalizeLayoutSelection(selection || this.getCurrentAiLayoutSelection(), {
      layoutFamily: this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
    const existingState = toAiLayoutState(this.plugin.getArticleLayoutState(context.sourcePath, requestedSelection));
    if (existingState?.layoutJson?.blocks?.length) {
      return existingState;
    }
    const derivedState = deriveArticleLayoutStateForSelection(baseState, requestedSelection, {
      layoutFamily: this.plugin.settings.ai?.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: this.plugin.settings.ai?.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
    if (!derivedState) return null;
    await this.plugin.saveArticleLayoutState(context.sourcePath, {
      ...derivedState,
      updatedAt: Date.now(),
    }, requestedSelection);
    return toAiLayoutState(derivedState);
  },

  isAiLayoutPanelVisible() {
    return !!(this.aiLayoutOverlay && this.aiLayoutOverlay.classList?.contains('visible'));
  },

  shouldSyncAiLayoutUi() {
    return this.aiPreviewApplied === true || this.aiLayoutLoading === true || this.isAiLayoutPanelVisible();
  },

  /**
   * @param {AiLayoutStateLike | null} state
   * @param {AiSettingsLike | null | undefined} aiSettings
   * @returns {string}
   */
  getArticleLayoutProviderLabel(state, aiSettings) {
    if (!state) return '';
    const providerList = Array.isArray(aiSettings?.providers) ? aiSettings.providers : [];
    const matchedProvider = state.providerId
      ? providerList.find((item) => item.id === state.providerId)
      : null;
    return state.generationMeta?.providerName || matchedProvider?.name || '';
  },

  /**
   * @param {AiLayoutStateLike | null} state
   * @param {AiSettingsLike | null | undefined} aiSettings
   * @returns {string}
   */
  getArticleLayoutModelLabel(state, aiSettings) {
    if (!state) return '';
    const providerList = Array.isArray(aiSettings?.providers) ? aiSettings.providers : [];
    const matchedProvider = state.providerId
      ? providerList.find((item) => item.id === state.providerId)
      : null;
    return state.generationMeta?.providerModel || state.model || matchedProvider?.model || '';
  },

  /**
   * @param {AiLayoutBlockLike | unknown} block
   * @returns {string}
   */
  getAiLayoutBlockLabel(block) {
    const blockRecord = toAiLayoutBlock(block);
    return blockRecord.title || blockRecord.caseLabel || blockRecord.text || blockRecord.caption || blockRecord.buttonText || blockRecord.type || '未命名区块';
  },

  /**
   * @param {string} value
   * @returns {string}
   */
  getAiLayoutFamilyLabel(value) {
    if (value === AI_LAYOUT_SELECTION_AUTO) return '自动推荐';
    const family = getLayoutFamilyById(value);
    if (!family) return value || '自动推荐';
    return family.label || value || '自动推荐';
  },

  /**
   * @param {string} value
   * @returns {string}
   */
  getAiColorPaletteLabel(value) {
    if (value === AI_LAYOUT_SELECTION_AUTO) return '自动配色';
    return getColorPaletteById(value)?.label || value || '自动配色';
  },

  /**
   * @param {AiLayoutStateLike | null} state
   * @returns {AiSchemaValidationLike | null}
   */
  getVisibleAiSchemaValidation(state) {
    if (!state) return null;
    if (state.lastAttemptStatus === 'schema-error') {
      return state.lastAttemptSchemaValidation?.issueCount ? state.lastAttemptSchemaValidation : null;
    }
    if (state.lastAttemptStatus === 'error') {
      return null;
    }
    return state.generationMeta?.schemaValidation || null;
  },

  /**
   * @param {string[]} [chips]
   */
  renderAiLayoutMetaChips(chips = []) {
    if (!this.aiLayoutMetaChips) return;
    this.aiLayoutMetaChips.empty();
    chips.forEach((chip) => {
      if (!chip) return;
      this.aiLayoutMetaChips.createEl('span', {
        cls: 'apple-ai-layout-meta-chip',
        text: chip,
      });
    });
  },

  /**
   * @returns {{ familyStates?: Record<string, AiLayoutStateLike>, lastLayoutFamily?: string } | null}
   */
  getCurrentArticleLayoutCacheEntry() {
    const { sourcePath } = this.getCurrentLayoutContext();
    if (!sourcePath) return null;
    const normalizedPath = normalizeVaultPath(sourcePath);
    return /** @type {{ familyStates?: Record<string, AiLayoutStateLike>, lastLayoutFamily?: string } | null} */ (normalizeArticleLayoutCacheEntry(this.plugin?.settings?.ai?.articleLayoutsByPath?.[normalizedPath]));
  },

  /**
   * @param {AiLayoutContextLike} [context]
   * @returns {{ layoutFamily: string, state: AiLayoutStateLike, label: string, isCurrentContent: boolean, isStaleContent: boolean, fromAuto: boolean, updatedAt: number }[]}
   */
  getCachedAiLayoutFamilyItems(context = this.getCurrentLayoutContext()) {
    const entry = this.getCurrentArticleLayoutCacheEntry();
    if (!entry?.familyStates) return [];
    return Object.entries(entry.familyStates)
      .map(([layoutFamily, state]) => {
        const typedState = toAiLayoutState(state);
        if (!typedState?.layoutJson?.blocks?.length) return null;
        const isCurrentContent = !!(context.sourceHash && typedState.sourceHash && typedState.sourceHash === context.sourceHash);
        const isStaleContent = !!(
          !context.isStaleSuppressed
          && context.sourceHash
          && typedState.sourceHash
          && typedState.sourceHash !== context.sourceHash
        );
        const fromAuto = typedState.selection?.layoutFamily === AI_LAYOUT_SELECTION_AUTO;
        return {
          layoutFamily,
          state: typedState,
          label: this.getAiLayoutFamilyLabel(layoutFamily),
          isCurrentContent,
          isStaleContent,
          fromAuto,
          updatedAt: Number(typedState.updatedAt || 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.isCurrentContent !== b.isCurrentContent) return a.isCurrentContent ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  },

  /**
   * @param {{ context?: AiLayoutContextLike, currentLayoutFamily?: string, isLoading?: boolean }} [options]
   */
  renderAiCachedLayoutFamilies({ context, currentLayoutFamily = '', isLoading = false } = {}) {
    if (!this.aiCachedLayoutList) return;
    const items = this.getCachedAiLayoutFamilyItems(context);
    this.aiCachedLayoutList.hidden = items.length === 0;
    this.aiCachedLayoutList.empty();
    if (!items.length) return;

    const activeItem = items.find((item) => item.layoutFamily === currentLayoutFamily) || items[0];
    if (items.length === 1 && activeItem) {
      const inline = this.aiCachedLayoutList.createDiv({ cls: 'apple-ai-layout-cache-inline' });
      const sourceText = activeItem.fromAuto ? '由自动推荐生成' : '手动选择';
      inline.createEl('span', {
        cls: 'apple-ai-layout-cache-name',
        text: `${activeItem.label} · ${sourceText}`,
      });
      if (activeItem.isStaleContent) {
        inline.createEl('span', { cls: 'apple-ai-layout-cache-separator', text: '·' });
        inline.createEl('span', {
          cls: 'apple-ai-layout-cache-state is-stale',
          text: '基于旧内容',
        });
      }
      return;
    }

    const activeRow = this.aiCachedLayoutList.createDiv({ cls: 'apple-ai-layout-cache-inline' });
    const activeSourceText = activeItem?.fromAuto ? '由自动推荐生成' : '手动选择';
    activeRow.createEl('span', {
      cls: 'apple-ai-layout-cache-name',
      text: `${activeItem?.label || this.getAiLayoutFamilyLabel(currentLayoutFamily)} · ${activeSourceText}`,
    });
    if (activeItem?.isStaleContent) {
      activeRow.createEl('span', { cls: 'apple-ai-layout-cache-separator', text: '·' });
      activeRow.createEl('span', {
        cls: 'apple-ai-layout-cache-state is-stale',
        text: '基于旧内容',
      });
    }

    const switchRow = this.aiCachedLayoutList.createDiv({ cls: 'apple-ai-layout-cache-switch-row' });
    switchRow.createEl('span', { cls: 'apple-ai-layout-cache-caption', text: '切换到' });
    items
      .filter((item) => item.layoutFamily !== activeItem?.layoutFamily)
      .forEach((item) => {
        const button = switchRow.createEl('button', {
          cls: 'apple-ai-layout-cache-chip',
          title: item.isStaleContent ? '预览这份基于旧内容的缓存' : '预览这份缓存',
        });
        button.disabled = isLoading;
        button.dataset.layoutFamily = item.layoutFamily;
        button.createEl('span', { cls: 'apple-ai-layout-cache-name', text: item.label });
        if (item.isStaleContent) {
          button.createEl('span', { cls: 'apple-ai-layout-cache-state is-stale', text: '基于旧内容' });
        }
        button.addEventListener('click', () => this.previewCachedAiLayoutFamily(item.layoutFamily));
      });
  },

  /**
   * @param {string} [layoutFamily]
   */
  previewCachedAiLayoutFamily(layoutFamily = '') {
    const entry = this.getCurrentArticleLayoutCacheEntry();
    const state = entry?.familyStates?.[layoutFamily] || null;
    if (!state?.layoutJson?.blocks?.length) {
      new Notice('这份缓存已经不可用，请重新生成');
      this.refreshAiLayoutPanel();
      return;
    }
    this.pendingAiLayoutFamily = layoutFamily;
    if (this.aiLayoutFamilySelect) this.aiLayoutFamilySelect.value = layoutFamily;
    this.applyAiLayoutToPreview({ stateOverride: state, allowStale: true });
  },

  /**
   * @param {{ hasDoc: boolean, aiFeatureEnabled: boolean, canGenerateForSelection: boolean, state: AiLayoutStateLike | null, visibleLayout: AiLayoutJsonLike | null, hasReusableLayout: boolean, hasLastAttemptFailure: boolean, hasApplied: boolean, isStale: boolean, isLoading: boolean }} options
   * @returns {{ mode: string, label: string, disabled: boolean }}
   */
  getAiPrimaryActionConfig({
    hasDoc,
    aiFeatureEnabled,
    canGenerateForSelection,
    state,
    visibleLayout,
    hasReusableLayout,
    hasLastAttemptFailure,
    hasApplied,
    isStale,
    isLoading,
  }) {
    if (isLoading) {
      return { mode: 'generate-apply', label: '生成中...', disabled: true };
    }
    if (!hasDoc || !aiFeatureEnabled) {
      return { mode: 'generate-apply', label: '生成并应用', disabled: true };
    }
    if (isStale) {
      if (visibleLayout?.blocks?.length) {
        return { mode: 'apply-stale', label: '应用旧缓存', disabled: false };
      }
      return { mode: 'generate-apply', label: '重新生成并应用', disabled: !canGenerateForSelection };
    }
    if (hasReusableLayout && hasLastAttemptFailure) {
      if (hasApplied) {
        return { mode: 'generate-apply', label: '重新生成并应用', disabled: !canGenerateForSelection };
      }
      return { mode: 'apply', label: '应用上一版', disabled: false };
    }
    if (visibleLayout?.blocks?.length && !hasApplied) {
      return { mode: 'apply', label: '应用当前结果', disabled: false };
    }
    if (!canGenerateForSelection) {
      return { mode: 'generate-apply', label: '生成并应用', disabled: true };
    }
    if (!state) {
      return { mode: 'generate-apply', label: '生成并应用', disabled: false };
    }
    if (state.status === 'error' || state.status === 'schema-error') {
      return { mode: 'generate-apply', label: '重新生成并应用', disabled: false };
    }
    return { mode: 'generate-apply', label: '重新生成并应用', disabled: false };
  },

  /**
   * @param {AiSchemaValidationLike | null} [schemaValidation]
   */
  refreshAiSchemaIssuePanel(schemaValidation = null) {
    if (!this.aiSchemaIssuePanel) return;
    this.aiSchemaIssuePanel.empty();
    const issues = Array.isArray(schemaValidation?.issues) ? schemaValidation.issues.filter(Boolean) : [];
    if (!issues.length) {
      this.aiSchemaIssuePanel.classList.remove('visible');
      return;
    }

    this.aiSchemaIssuePanel.classList.add('visible');
    this.aiSchemaIssuePanel.createDiv({
      cls: 'apple-ai-layout-issues-title',
      text: schemaValidation?.fatal === true ? 'Schema 校验问题' : 'Schema 提醒',
    });

    issues.slice(0, 5).forEach((issue) => {
      const item = this.aiSchemaIssuePanel.createDiv({
        cls: `apple-ai-layout-issue-item ${issue?.fatal === true ? 'is-fatal' : ''}`,
      });
      item.createEl('span', {
        cls: 'apple-ai-layout-issue-path',
        text: issue?.path || '$',
      });
      item.createEl('span', {
        cls: 'apple-ai-layout-issue-message',
        text: issue?.message || '未知 schema 问题',
      });
    });

    if (issues.length > 5) {
      this.aiSchemaIssuePanel.createDiv({
        cls: 'apple-ai-layout-mini-note',
        text: `其余 ${issues.length - 5} 项请在“错误详情”或调试快照中查看。`,
      });
    }
  },

  /**
   * @param {AiLayoutStateLike | null} state
   * @returns {string}
   */
  buildAiLayoutDebugJson(state) {
    if (!state) return '';
    return JSON.stringify({
      layoutJson: state.layoutJson || null,
      generationMeta: state.generationMeta || null,
      lastAttempt: {
        status: state.lastAttemptStatus || 'idle',
        error: state.lastAttemptError || '',
        at: state.lastAttemptAt ? new Date(state.lastAttemptAt).toISOString() : '',
        schemaValidation: state.lastAttemptSchemaValidation || null,
      },
    }, null, 2);
  },

  /**
   * @param {{ state: AiLayoutStateLike | null, providerLabel?: string, modelLabel?: string, isStale?: boolean }} options
   * @returns {string}
   */
  buildAiLayoutErrorDetails({ state, providerLabel, modelLabel, isStale }) {
    return JSON.stringify({
      status: state?.status || 'unknown',
      lastError: state?.lastError || '',
      providerId: state?.providerId || '',
      providerName: providerLabel || '',
      model: modelLabel || '',
      selection: state?.selection || null,
      resolved: state?.resolved || null,
      updatedAt: state?.updatedAt ? new Date(state.updatedAt).toISOString() : '',
      sourceHash: state?.sourceHash || '',
      isStale: isStale === true,
      currentLayoutGenerationMeta: state?.generationMeta || null,
      lastAttempt: {
        status: state?.lastAttemptStatus || 'idle',
        error: state?.lastAttemptError || '',
        at: state?.lastAttemptAt ? new Date(state.lastAttemptAt).toISOString() : '',
        schemaValidation: state?.lastAttemptSchemaValidation || null,
      },
    }, null, 2);
  },

  /**
   * @param {{ mode?: string, state: AiLayoutStateLike | null, providerLabel?: string, modelLabel?: string, isStale?: boolean, sourcePath?: string }} options
   * @returns {string}
   */
  buildAiLayoutDebugSnapshot({ mode, state, providerLabel, modelLabel, isStale, sourcePath }) {
    if (!state || !mode) return '';
    const header = [
      `mode: ${mode}`,
      `sourcePath: ${sourcePath || ''}`,
      `provider: ${providerLabel || ''}`,
      `model: ${modelLabel || ''}`,
      `updatedAt: ${state?.updatedAt ? new Date(state.updatedAt).toISOString() : ''}`,
      '',
    ].join('\n');
    if (mode === 'json') {
      return `${header}${this.buildAiLayoutDebugJson(state)}`;
    }
    return `${header}${this.buildAiLayoutErrorDetails({ state, providerLabel, modelLabel, isStale })}`;
  },

  truncateAiPromptMarkdown(markdown, maxLength = 1600) {
    const normalized = String(markdown || '').trim();
    if (!normalized) return '';
    return normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 1)}…`
      : normalized;
  },

  /**
   * @param {{ state: AiLayoutStateLike | null, context: AiLayoutContextLike, providerLabel?: string, modelLabel?: string, isStale?: boolean }} options
   * @returns {string}
   */
  buildAiLayoutPromptContext({ state, context, providerLabel, modelLabel, isStale }) {
    if (!state?.layoutJson) return '';

    const visibleSchemaValidation = this.getVisibleAiSchemaValidation(state);

    const blockLines = Array.isArray(state.layoutJson.blocks)
      ? state.layoutJson.blocks.map((block, index) => {
        const blockRecord = toAiLayoutBlock(block);
        const origin = state.generationMeta?.blockOrigins?.[index]?.source === 'fallback' ? '补全' : 'AI';
        return `${index + 1}. [${origin}] ${blockRecord.type || ''} - ${this.getAiLayoutBlockLabel(blockRecord)}`;
      }).join('\n')
      : '- 无区块';

    const markdownExcerpt = this.truncateAiPromptMarkdown(context?.markdown || '');
    const snapshot = this.aiLayoutDebugMode
      ? this.buildAiLayoutDebugSnapshot({
        mode: this.aiLayoutDebugMode,
        state,
        providerLabel,
        modelLabel,
        isStale,
        sourcePath: context?.sourcePath,
      })
      : this.buildAiLayoutDebugSnapshot({
        mode: 'json',
        state,
        providerLabel,
        modelLabel,
        isStale,
        sourcePath: context?.sourcePath,
      });

    return [
      '# 公众号 AI 编排调试上下文',
      '',
      '请基于下面的信息，帮我分析当前 Obsidian 微信公众号 AI 编排结果，并给出：',
      '1. 当前 block 组合和顺序是否合理',
      '2. 哪些区块适合保留、替换或重排',
      '3. 如果存在失败或 fallback 介入，最可能的原因是什么',
      '4. 下一步最值得调整的 prompt / schema / block 策略',
      '',
      '## 文章信息',
      `- 标题：${context?.title || '未命名文章'}`,
      `- 路径：${context?.sourcePath || ''}`,
      `- 源哈希：${context?.sourceHash || ''}`,
      `- AI 状态：${state.status || 'ready'}`,
      `- 已过期：${isStale ? '是' : '否'}`,
      `- 布局选择：${state.selection?.layoutFamily || ''}`,
      `- 颜色选择：${state.selection?.colorPalette || ''}`,
      `- 最终布局：${state.resolved?.layoutFamily || ''}`,
      `- 最终颜色：${state.resolved?.colorPalette || ''}`,
      `- Provider：${providerLabel || ''}`,
      `- Model：${modelLabel || ''}`,
      '',
      '## 当前布局摘要',
      `- articleType: ${state.layoutJson.articleType || 'article'}`,
      `- blockCount: ${state.layoutJson.blocks?.length || 0}`,
      blockLines,
      '',
      '## 生成元信息',
      '```json',
      JSON.stringify(state.generationMeta || null, null, 2),
      '```',
      '',
      '## Schema 问题',
      '```json',
      JSON.stringify(visibleSchemaValidation, null, 2),
      '```',
      '',
      '## 当前调试快照',
      '```text',
      snapshot,
      '```',
      '',
      '## 文章正文摘录',
      '```md',
      markdownExcerpt || '(无可用正文)',
      '```',
    ].join('\n');
  },

  /**
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async copyPlainTextSnapshot(text) {
    if (!text) return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  },

  async copyAiLayoutDebugSnapshot() {
    const state = this.getCurrentArticleLayoutState();
    const aiSettings = this.plugin.settings.ai || createDefaultAiSettings();
    const context = this.getCurrentLayoutContext();
    const providerLabel = this.getArticleLayoutProviderLabel(state, aiSettings);
    const modelLabel = this.getArticleLayoutModelLabel(state, aiSettings);
    const isStale = !!(state && context.sourceHash && state.sourceHash && state.sourceHash !== context.sourceHash);
    const payload = this.buildAiLayoutDebugSnapshot({
      mode: this.aiLayoutDebugMode,
      state,
      providerLabel,
      modelLabel,
      isStale,
      sourcePath: context.sourcePath,
    });

    if (!payload) {
      new Notice('请先展开布局 JSON 或错误详情，再复制调试快照');
      return;
    }

    try {
      const copied = await this.copyPlainTextSnapshot(payload);
      if (!copied) throw new Error('clipboard unavailable');
      new Notice('✅ 调试快照已复制');
    } catch {
      new Notice('❌ 调试快照复制失败，请检查剪贴板权限');
    }
  },

  async copyAiLayoutPromptContext() {
    const state = this.getCurrentArticleLayoutState();
    const aiSettings = this.plugin.settings.ai || createDefaultAiSettings();
    const context = this.getCurrentLayoutContext();
    const providerLabel = this.getArticleLayoutProviderLabel(state, aiSettings);
    const modelLabel = this.getArticleLayoutModelLabel(state, aiSettings);
    const isStale = !!(state && context.sourceHash && state.sourceHash && state.sourceHash !== context.sourceHash);
    const payload = this.buildAiLayoutPromptContext({
      state,
      context,
      providerLabel,
      modelLabel,
      isStale,
    });

    if (!payload) {
      new Notice('当前还没有可用的 AI 编排结果，暂时无法生成 Prompt 上下文');
      return;
    }

    try {
      const copied = await this.copyPlainTextSnapshot(payload);
      if (!copied) throw new Error('clipboard unavailable');
      new Notice('✅ Prompt 上下文已复制');
    } catch {
      new Notice('❌ Prompt 上下文复制失败，请检查剪贴板权限');
    }
  },

  /**
   * @param {{ state: AiLayoutStateLike | null, providerLabel?: string, modelLabel?: string, isStale?: boolean }} options
   */
  refreshAiLayoutDebugPanel({ state, providerLabel, modelLabel, isStale }) {
    if (!this.aiDebugPanel || !this.aiDebugPanelBody || !this.aiDebugPanelTitle) return;
    const isLoading = this.aiLayoutLoading === true;
    const canShowJson = !!state?.layoutJson;
    const canShowError = !!(state?.status === 'error' || state?.status === 'schema-error' || state?.lastError);
    const isAdvancedOpen = this.aiAdvancedOpen === true;

    if (this.aiViewJsonBtn) {
      this.aiViewJsonBtn.disabled = !canShowJson || isLoading;
      this.aiViewJsonBtn.classList.toggle('is-active', this.aiLayoutDebugMode === 'json');
    }
    if (this.aiViewErrorBtn) {
      this.aiViewErrorBtn.disabled = !canShowError || isLoading;
      this.aiViewErrorBtn.classList.toggle('is-active', this.aiLayoutDebugMode === 'error');
    }
    if (this.aiCopyDebugBtn) {
      this.aiCopyDebugBtn.disabled = !this.aiLayoutDebugMode || isLoading;
    }
    if (this.aiCopyPromptBtn) {
      this.aiCopyPromptBtn.disabled = !state?.layoutJson || isLoading;
    }

    if ((this.aiLayoutDebugMode === 'json' && !canShowJson) || (this.aiLayoutDebugMode === 'error' && !canShowError)) {
      this.aiLayoutDebugMode = '';
    }

    if (!isAdvancedOpen || !this.aiLayoutDebugMode) {
      this.aiDebugPanel.classList.remove('visible');
      this.aiDebugPanelTitle.setText('调试输出');
      this.aiDebugPanelBody.setText('');
      if (this.aiCopyPromptBtn) {
        this.aiCopyPromptBtn.setText('复制给 AI');
        this.aiCopyPromptBtn.title = '复制一份包含文章摘录、布局摘要和调试信息的排查 Prompt';
      }
      if (this.aiCopyDebugBtn) {
        this.aiCopyDebugBtn.setText('复制当前内容');
        this.aiCopyDebugBtn.title = '复制当前调试面板内容';
      }
      if (this.aiCopyDebugBtn) this.aiCopyDebugBtn.disabled = true;
      return;
    }

    this.aiDebugPanel.classList.add('visible');
    if (this.aiCopyDebugBtn) this.aiCopyDebugBtn.disabled = false;
    if (this.aiCopyPromptBtn) {
      this.aiCopyPromptBtn.setText('复制给 AI');
      this.aiCopyPromptBtn.title = this.aiLayoutDebugMode === 'error'
        ? '复制一份包含错误详情、文章摘录和布局摘要的排查 Prompt'
        : '复制一份包含布局 JSON、文章摘录和布局摘要的排查 Prompt';
    }
    if (this.aiLayoutDebugMode === 'json') {
      this.aiDebugPanelTitle.setText('布局 JSON');
      if (this.aiCopyDebugBtn) {
        this.aiCopyDebugBtn.setText('复制 JSON');
        this.aiCopyDebugBtn.title = '只复制当前布局 JSON 调试内容';
      }
      this.aiDebugPanelBody.setText(this.buildAiLayoutDebugJson(state));
      return;
    }

    this.aiDebugPanelTitle.setText('错误详情');
    if (this.aiCopyDebugBtn) {
      this.aiCopyDebugBtn.setText('复制错误详情');
      this.aiCopyDebugBtn.title = '只复制当前错误详情调试内容';
    }
    this.aiDebugPanelBody.setText(this.buildAiLayoutErrorDetails({ state, providerLabel, modelLabel, isStale }));
  },

  refreshAiLayoutPanel() {
    if (!this.aiLayoutStatusBadge || !this.aiLayoutSummary || !this.aiBlockList) return;

    const aiSettings = this.plugin.settings.ai || createDefaultAiSettings();
    const provider = resolveAiProvider(aiSettings);
    const configuredProviders = Array.isArray(aiSettings.providers) ? aiSettings.providers.length : 0;
    const context = this.getCurrentLayoutContext();
    const storedState = this.getCurrentArticleLayoutState();
    const currentSelection = this.getCurrentAiLayoutSelection();
    const activeGenerationSelection = this.aiLayoutLoading === true
      ? normalizeLayoutSelection(this.aiLayoutActiveGenerationSelection || {}, {
        layoutFamily: aiSettings.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
        colorPalette: aiSettings.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
      })
      : null;
    const effectiveSelection = {
      layoutFamily: activeGenerationSelection?.layoutFamily || currentSelection.layoutFamily || storedState?.selection?.layoutFamily || aiSettings.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: activeGenerationSelection?.colorPalette || currentSelection.colorPalette || storedState?.selection?.colorPalette || aiSettings.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    };
    const state = storedState;
    if (
      effectiveSelection.layoutFamily === 'source-first'
      && context.sourcePath
      && (!state || ((state.status === 'error' || state.status === 'schema-error') && !(state.layoutJson?.blocks?.length)))
    ) {
      this.recoverSourceFirstLayoutState(state, effectiveSelection, context);
    }
    const generationMeta = state?.generationMeta || null;
    const schemaValidation = this.getVisibleAiSchemaValidation(state);
    const providerLabel = this.getArticleLayoutProviderLabel(state, aiSettings);
    const modelLabel = this.getArticleLayoutModelLabel(state, aiSettings);
    const aiFeatureEnabled = aiSettings.enabled === true;
    const visibleSnapshot = this.getVisibleAiLayoutSnapshot(state);
    const visibleLayout = visibleSnapshot.layoutJson;
    const visibleBlockOrigins = visibleSnapshot.blockOrigins;
    const hiddenBlockCount = visibleSnapshot.hiddenCount;
    const hasReusableLayout = !!(state?.status === 'ready' && visibleLayout?.blocks?.length);
    const hasLastAttemptFailure = state?.lastAttemptStatus === 'error' || state?.lastAttemptStatus === 'schema-error';

    const hasDoc = !!context.sourcePath;
    const hasProvider = !!provider;
    const canUseLocalLayout = effectiveSelection.layoutFamily === 'source-first';
    const canGenerateForSelection = hasProvider || canUseLocalLayout;
    const rawIsStale = !!(state && context.sourceHash && state.sourceHash && state.sourceHash !== context.sourceHash);
    const isSourceSwitching = context.isSourceSwitching === true;
    const isResolvingSourceState = isSourceSwitching || (context.isStaleSuppressed === true && rawIsStale);
    const isStale = rawIsStale && !isResolvingSourceState;
    const hasApplied = this.aiPreviewApplied === true && !!state && !rawIsStale;
    const isGenerating = this.aiLayoutLoading === true;
    const isLoading = isGenerating || isResolvingSourceState;
    const hasVisibleLayout = !!(visibleLayout?.blocks?.length);
    const canApplyVisibleLayout = hasVisibleLayout && !hasApplied && !rawIsStale;

    let badge = '未生成';
    let statusText = hasDoc ? '当前文章还没有 AI 编排结果。' : '请先打开一篇文章。';
    if (isResolvingSourceState) {
      badge = '读取中';
      statusText = '正在切换到当前文章，请稍候。';
    } else if (isGenerating) {
      badge = '生成中';
      statusText = '正在生成并应用新的编排，请稍候。';
    } else if (!aiFeatureEnabled) {
      badge = '已关闭';
      statusText = 'AI 编排已关闭，请先在设置中启用。';
    } else if (!state) {
      if (!hasProvider && !canUseLocalLayout) {
        badge = '待配置';
        statusText = configuredProviders > 0
          ? '当前布局需要可用的 AI Provider，请补全配置后再试。'
          : '当前布局需要 AI Provider，请先到设置中完成配置。';
      } else {
        badge = '未生成';
        statusText = '点击“生成并应用”查看效果。';
      }
    } else if (state?.status === 'schema-error') {
      badge = hasReusableLayout ? '已保留上一版' : '生成失败';
      statusText = hasReusableLayout
        ? '这次生成没有成功，已为你保留上一版结果。'
        : '这次生成没有成功，请重试或检查 AI 设置。';
    } else if (state?.status === 'error') {
      badge = hasReusableLayout ? '已保留上一版' : '生成失败';
      statusText = hasReusableLayout
        ? '这次生成没有成功，已为你保留上一版结果。'
        : '生成失败，请重试或检查 AI 设置。';
    } else if (state && isStale) {
      if (canGenerateForSelection) {
        badge = '需更新';
        statusText = hasReusableLayout
          ? '这份编排基于旧内容，可先应用旧缓存，或重新生成最新结果。'
          : '文章内容有更新，建议重新生成并应用。';
      } else {
        badge = '待配置';
        statusText = hasReusableLayout
          ? '这份编排基于旧内容；若要重新生成，请先完成 AI Provider 配置。'
          : '当前已有旧结果，但文章内容已更新。若要重新生成，请先完成 AI Provider 配置。';
      }
    } else if (hasReusableLayout && hasLastAttemptFailure) {
      badge = '已保留上一版';
      statusText = '这次生成没有成功，已为你保留上一版结果。';
    } else if (state) {
      badge = hasApplied ? '已应用' : '可应用';
      statusText = hasApplied
        ? '已应用到预览。'
        : '可以直接应用到预览。';
    }

    this.aiLayoutStatusBadge.setText(badge);
    this.aiLayoutStatusBadge.className = `apple-ai-layout-badge ${hasApplied ? 'is-applied' : ''} ${isStale ? 'is-stale' : ''} ${(state?.status === 'error' || state?.status === 'schema-error') ? 'is-error' : ''} ${!aiFeatureEnabled ? 'is-disabled' : ''}`;
    const hideSuccessStatusText = !!state
      && !isLoading
      && aiFeatureEnabled
      && !isStale
      && !hasLastAttemptFailure
      && state.status !== 'error'
      && state.status !== 'schema-error';
    this.aiLayoutStatusText.hidden = hideSuccessStatusText;
    this.aiLayoutStatusText.setText(hideSuccessStatusText ? '' : statusText);
    this.applyAiLayoutPanelStylePack(String(
      state?.resolved?.colorPalette
      || (effectiveSelection.colorPalette !== AI_LAYOUT_SELECTION_AUTO ? effectiveSelection.colorPalette : '')
      || aiSettings.defaultStylePack
      || 'tech-green'
    ));
    if (isResolvingSourceState && this.aiCachedLayoutList) {
      this.aiCachedLayoutList.empty();
      this.aiCachedLayoutList.hidden = true;
    } else {
      this.renderAiCachedLayoutFamilies({
        context,
        currentLayoutFamily: state?.resolved?.layoutFamily || state?.layoutFamily || effectiveSelection.layoutFamily,
        isLoading,
      });
    }
    this.aiLayoutFamilySelect.value = effectiveSelection.layoutFamily;
    this.aiColorPaletteSelect.value = effectiveSelection.colorPalette;
    if (this.aiStylePackSelect) this.aiStylePackSelect.value = effectiveSelection.colorPalette;
    this.pendingAiLayoutFamily = effectiveSelection.layoutFamily;
    this.pendingAiColorPalette = effectiveSelection.colorPalette;
    this.pendingAiStylePack = effectiveSelection.colorPalette;
    this.updateAiColorPaletteControls();
    this.aiLayoutFamilySelect.disabled = !aiFeatureEnabled || isLoading;
    this.aiColorPaletteSelect.disabled = !aiFeatureEnabled || isLoading;
    if (this.aiStylePackSelect) this.aiStylePackSelect.disabled = !aiFeatureEnabled || isLoading;
    if (this.aiAdvancedToggleBtn) {
      this.aiAdvancedToggleBtn.classList.toggle('is-open', this.aiAdvancedOpen === true);
      this.aiAdvancedToggleBtn.setAttribute('aria-expanded', this.aiAdvancedOpen === true ? 'true' : 'false');
    }
    if (this.aiAdvancedBody) {
      this.aiAdvancedBody.classList.toggle('visible', this.aiAdvancedOpen === true);
      this.aiAdvancedBody.hidden = this.aiAdvancedOpen !== true;
    }
    if (this.aiLayoutOverlay) {
      this.aiLayoutOverlay.classList.toggle('is-loading', isLoading);
    }
    const converterContainer = this.previewContainer?.closest('.apple-converter-container');
    if (converterContainer) {
      converterContainer.classList.toggle('apple-ai-layout-panel-loading', isLoading);
    }
    if (this.aiLayoutLoadingMask) {
      this.aiLayoutLoadingMask.classList.toggle('visible', isLoading);
    }
    if (this.aiLayoutLoadingMaskText) {
      const layoutLabel = this.getAiLayoutFamilyLabel(effectiveSelection.layoutFamily);
      const colorLabel = this.getAiColorPaletteLabel(effectiveSelection.colorPalette);
      this.aiLayoutLoadingMaskText.setText(isResolvingSourceState
        ? '正在切换文章预览...'
        : `正在生成「${layoutLabel} · ${colorLabel}」编排...`);
    }
    const primaryAction = this.getAiPrimaryActionConfig({
      hasDoc,
      aiFeatureEnabled,
      canGenerateForSelection,
      state,
      visibleLayout,
      hasReusableLayout,
      hasLastAttemptFailure,
      hasApplied,
      isStale,
      isLoading,
    });
    this.aiPrimaryActionMode = primaryAction.mode;
    this.aiGenerateBtn.setText(primaryAction.label);
    this.aiGenerateBtn.disabled = primaryAction.disabled;
    if (this.aiRegenerateBtn) {
      const showRegenerate = !!(
        hasDoc
        && aiFeatureEnabled
        && canGenerateForSelection
        && !isLoading
        && state
        && primaryAction.mode !== 'generate-apply'
      );
      this.aiRegenerateBtn.hidden = !showRegenerate;
      this.aiRegenerateBtn.disabled = !showRegenerate;
    }

    const setSummary = (text = '') => {
      if (!this.aiLayoutSummary) return;
      const value = String(text || '').trim();
      this.aiLayoutSummary.setText(value);
      this.aiLayoutSummary.hidden = !value;
    };
    const setMetaNote = (text = '') => {
      if (!this.aiLayoutMetaNote) return;
      const value = String(text || '').trim();
      this.aiLayoutMetaNote.setText(value);
      this.aiLayoutMetaNote.hidden = !value;
    };

    if (isResolvingSourceState) {
      setSummary('正在读取当前文章的编排状态。');
      this.renderAiLayoutMetaChips([]);
      setMetaNote('');
      this.refreshAiSchemaIssuePanel(null);
    } else if (isGenerating) {
      setSummary(`正在为「${context.title || '当前文章'}」生成新的排版效果。`);
      this.renderAiLayoutMetaChips([]);
      setMetaNote('');
      this.refreshAiSchemaIssuePanel(null);
    } else if (!aiFeatureEnabled) {
      setSummary('启用 AI 编排后，这里会根据当前文章生成版式结果。');
      setMetaNote('');
      this.renderAiLayoutMetaChips([]);
      this.refreshAiSchemaIssuePanel(null);
    } else if (!hasDoc) {
      setSummary('打开一篇文章后，就可以生成专属编排。');
      setMetaNote('');
      this.renderAiLayoutMetaChips([]);
      this.refreshAiSchemaIssuePanel(null);
    } else if (state?.status === 'schema-error') {
      setSummary(hasReusableLayout ? '上一版结果仍可继续使用。' : '');
      this.renderAiLayoutMetaChips([
        ...(providerLabel ? [`Provider ${providerLabel}`] : []),
        ...(modelLabel ? [`模型 ${modelLabel}`] : []),
        ...(schemaValidation?.issueCount > 0 ? [`Schema ${schemaValidation.issueCount} 项`] : []),
      ]);
      setMetaNote(hasReusableLayout ? '如果当前效果还能用，可以直接继续使用上一版。' : '可以重试一次；如仍失败，再到高级里查看具体原因。');
      this.refreshAiSchemaIssuePanel(schemaValidation);
    } else if (state?.status === 'error' && state.lastError) {
      setSummary(hasReusableLayout ? '上一版结果仍可继续使用。' : '');
      this.renderAiLayoutMetaChips([
        ...(providerLabel ? [`Provider ${providerLabel}`] : []),
        ...(modelLabel ? [`模型 ${modelLabel}`] : []),
      ]);
      setMetaNote(hasReusableLayout ? '当前不会影响继续使用上一版结果。' : '如果反复失败，可以到高级里查看错误详情。');
      this.refreshAiSchemaIssuePanel(null);
    } else if (hasReusableLayout && hasLastAttemptFailure) {
      setSummary('上一版结果仍可继续使用。');
      this.renderAiLayoutMetaChips([
        ...(providerLabel ? [`Provider ${providerLabel}`] : []),
        ...(modelLabel ? [`模型 ${modelLabel}`] : []),
        state.lastAttemptStatus === 'schema-error' ? '最近一次校验失败' : '最近一次生成失败',
      ]);
      setMetaNote(hiddenBlockCount > 0 ? `已隐藏 ${hiddenBlockCount} 个区块，可随时恢复。` : '');
      this.refreshAiSchemaIssuePanel(state.lastAttemptStatus === 'schema-error' ? schemaValidation : null);
    } else if (!state) {
      if (!hasProvider && !canUseLocalLayout) {
        setSummary('当前所选布局依赖 AI Provider。');
        setMetaNote('');
        this.renderAiLayoutMetaChips([]);
      } else {
        setSummary('');
        this.renderAiLayoutMetaChips([]);
        setMetaNote('');
      }
      this.refreshAiSchemaIssuePanel(null);
    } else if (state && isStale && !canGenerateForSelection) {
      setSummary('当前已有一版旧结果，但要重新生成需要先完成 AI Provider 配置。');
      this.renderAiLayoutMetaChips([
        ...(providerLabel ? [`Provider ${providerLabel}`] : []),
        ...(modelLabel ? [`模型 ${modelLabel}`] : []),
      ]);
      setMetaNote(canApplyVisibleLayout ? '当前结果仍可继续应用；如果要更新内容，请先恢复 Provider。' : '');
      this.refreshAiSchemaIssuePanel(null);
    } else {
      const blockCount = visibleLayout?.blocks?.length || 0;
      setSummary(`共 ${blockCount} 个区块，可移除不需要的部分。`);

      const metaChips = [];
      if (providerLabel) metaChips.push(`Provider ${providerLabel}`);
      if (modelLabel) metaChips.push(`模型 ${modelLabel}`);
      if (schemaValidation?.issueCount > 0) metaChips.push(`Schema ${schemaValidation.issueCount} 项`);
      if (generationMeta?.executionMode === 'local-fallback') {
        metaChips.push('本地兜底');
      } else if (generationMeta?.fallbackUsed) {
        metaChips.push(`补全 ${generationMeta.fallbackBlockCount} 块`);
      }
      if (hiddenBlockCount > 0) metaChips.push(`已移除 ${hiddenBlockCount} 块`);
      if (hasLastAttemptFailure) {
        metaChips.push(state.lastAttemptStatus === 'schema-error' ? '最近一次校验失败' : '最近一次生成失败');
      }
      this.renderAiLayoutMetaChips(metaChips);
      const hiddenText = hiddenBlockCount > 0 ? `已隐藏 ${hiddenBlockCount} 个区块，可随时恢复。` : '';
      if (hasLastAttemptFailure && state.lastAttemptError) {
        setMetaNote(`上一版结果已保留。${hiddenText}`.trim());
      } else if (generationMeta?.executionMode === 'local-fallback') {
        setMetaNote(`当前使用的是更稳定的本地增强结果。${hiddenText}`.trim());
      } else {
        setMetaNote(hiddenText);
      }
      this.refreshAiSchemaIssuePanel(schemaValidation);
    }

    if (this.aiResultSection) {
      this.aiResultSection.hidden = !(isLoading || hasVisibleLayout || hiddenBlockCount > 0);
    }

    this.aiBlockList.empty();
    if (isLoading) {
      for (let index = 0; index < 4; index += 1) {
        const item = this.aiBlockList.createDiv({ cls: 'apple-ai-layout-block-item is-skeleton' });
        item.createDiv({ cls: 'apple-ai-layout-block-skeleton-index' });
        const content = item.createDiv({ cls: 'apple-ai-layout-block-main' });
        content.createDiv({ cls: 'apple-ai-layout-block-skeleton-line is-title' });
        content.createDiv({ cls: 'apple-ai-layout-block-skeleton-line is-meta' });
        item.createDiv({ cls: 'apple-ai-layout-block-skeleton-badge' });
      }
    } else if (visibleLayout?.blocks?.length) {
      visibleLayout.blocks.forEach((block, index) => {
        const item = this.aiBlockList.createDiv({ cls: 'apple-ai-layout-block-item' });
        const origin = visibleBlockOrigins?.[index] || null;
        if (origin?.blockKey) {
          item.dataset.blockKey = origin.blockKey;
        }
        item.createEl('span', { cls: 'apple-ai-layout-block-index', text: String(index + 1).padStart(2, '0') });
        const content = item.createDiv({ cls: 'apple-ai-layout-block-main' });
        content.createEl('span', {
          cls: 'apple-ai-layout-block-name',
          text: this.getAiLayoutBlockLabel(block),
        });
        if (origin?.originalIndex >= 0) {
          const removeBtn = item.createEl('button', {
            cls: 'apple-ai-layout-block-remove',
            text: '移除',
          });
          removeBtn.addEventListener('click', () => this.removeAiLayoutBlock(origin.originalIndex, item));
        }
      });
    } else {
      this.aiBlockList.createDiv({
        cls: 'apple-ai-layout-empty',
        text: hiddenBlockCount > 0
          ? '当前区块都已被移除，可以点击“恢复已移除”重新查看。'
          : (aiFeatureEnabled ? '生成后会展示区块清单。' : '启用 AI 编排后，这里会展示当前文章的区块清单。'),
      });
    }

    this.aiResetBtn.disabled = !this.aiPreviewApplied || isLoading;
    if (this.aiRegenerateBtn && isLoading) {
      this.aiRegenerateBtn.disabled = true;
    }
    if (this.aiRestoreBlocksBtn) {
      this.aiRestoreBlocksBtn.disabled = hiddenBlockCount <= 0 || isLoading;
      this.aiRestoreBlocksBtn.hidden = hiddenBlockCount <= 0;
    }
    this.restoreAiLayoutPendingAnchor();
    this.refreshAiLayoutDebugPanel({ state, providerLabel, modelLabel, isStale });
    this.updateAiToolbarState();
  },
  markAiLayoutSourceSwitch(sourcePath = '') {
    if (!sourcePath) return;
    this.aiLayoutSourceSwitchPath = sourcePath;
    this.aiLayoutStaleSuppressPath = sourcePath;
    this.aiLayoutStaleSuppressUntil = Date.now() + AI_LAYOUT_SOURCE_SWITCH_STALE_SUPPRESS_MS;
    if (this.aiLayoutStaleSuppressTimer) {
      window.clearTimeout(this.aiLayoutStaleSuppressTimer);
    }
    this.aiLayoutStaleSuppressTimer = window.setTimeout(() => {
      this.aiLayoutStaleSuppressTimer = null;
      if (
        this.aiLayoutStaleSuppressPath === sourcePath
        && Date.now() >= this.aiLayoutStaleSuppressUntil
      ) {
        this.aiLayoutStaleSuppressPath = '';
        this.aiLayoutStaleSuppressUntil = 0;
      }
      if (this.shouldSyncAiLayoutUi()) {
        this.refreshAiLayoutPanel();
      }
    }, AI_LAYOUT_SOURCE_SWITCH_STALE_SUPPRESS_MS + 40);
  },

  completeAiLayoutSourceSwitch(sourcePath = '') {
    if (sourcePath && this.aiLayoutSourceSwitchPath === sourcePath) {
      this.aiLayoutSourceSwitchPath = '';
    }
  },

  isAiLayoutStaleSuppressedForPath(sourcePath = '') {
    if (!sourcePath || this.aiLayoutStaleSuppressPath !== sourcePath) return false;
    if (Date.now() < this.aiLayoutStaleSuppressUntil) return true;
    this.aiLayoutStaleSuppressPath = '';
    this.aiLayoutStaleSuppressUntil = 0;
    return false;
  },
  resetAiLayoutPanelViewState() {
    this.aiAdvancedOpen = false;
    this.aiLayoutDebugMode = '';
    this.aiLayoutPendingAnchor = null;

    const scrollTargets = [
      this.aiLayoutOverlay,
      this.aiLayoutArea,
      this.aiAdvancedBody,
      this.aiDebugPanelBody,
    ].filter(Boolean);

    const resetScroll = () => {
      scrollTargets.forEach((target) => {
        target.scrollTop = 0;
      });
    };

    resetScroll();
    if (typeof requestAnimationFrame === 'function') {
      window.requestAnimationFrame(resetScroll);
    }
  },
  async generateAiLayoutForCurrentArticle({ applyAfterGenerate = false } = {}) {
    const aiSettings = this.plugin.settings.ai || createDefaultAiSettings();
    const context = await this.ensureCurrentArticleContext();
    if (!context) {
      new Notice('请先打开一篇有内容的 Markdown 文章');
      return;
    }

    if (!this.baseRenderedHtml) {
      await this.convertCurrent(true, { showLoading: true, loadingText: '正在准备文章上下文...' });
    }

    const imageRefs = aiSettings.includeImagesInLayout === false
      ? []
      : extractImageRefsFromHtml(this.baseRenderedHtml || this.currentHtml || '');

    const selection = this.getCurrentAiLayoutSelection();
    const provider = resolveAiProvider(aiSettings);
    if (selection.layoutFamily !== 'source-first' && !provider) {
      new Notice('请先在插件设置中配置并启用 AI Provider');
      return;
    }
    const originalText = this.aiGenerateBtn?.textContent;
    try {
      this.aiLayoutActiveGenerationSelection = selection;
      this.aiLayoutLoading = true;
      this.refreshAiLayoutPanel();
      if (this.aiGenerateBtn) {
        this.aiGenerateBtn.disabled = true;
        this.aiGenerateBtn.setText('生成中...');
      }
      const result = await generateArticleLayout({
        provider,
        title: context.title,
        markdown: context.markdown,
        selection,
        imageRefs,
        timeoutMs: aiSettings.requestTimeoutMs,
        fetchImpl: createObsidianFetchAdapter({ requestUrl: getObsidianRequestUrl(), request: getObsidianRequest() }),
      });
      const layoutJson = toAiLayoutJson(result.layoutJson);
      if (!Array.isArray(layoutJson?.blocks) || !layoutJson.blocks.length) {
        throw new Error('AI 返回了空的编排结果');
      }

      await this.plugin.saveArticleLayoutState(context.sourcePath, {
        version: AI_LAYOUT_SCHEMA_VERSION,
        updatedAt: Date.now(),
        sourceHash: context.sourceHash,
        providerId: provider?.id || '',
        model: provider?.model || '',
        selection: layoutJson.selection,
        resolved: layoutJson.resolved,
        recommendedLayoutFamily: layoutJson.recommendedLayoutFamily,
        recommendedColorPalette: layoutJson.recommendedColorPalette,
        stylePack: layoutJson.stylePack,
        status: 'ready',
        lastError: '',
        lastAttemptStatus: 'success',
        lastAttemptError: '',
        lastAttemptAt: Date.now(),
        lastAttemptSchemaValidation: null,
        dismissedBlockKeys: [],
        generationMeta: toAiLayoutGenerationMeta(result.generationMeta),
        layoutJson,
      }, layoutJson.selection);
      this.pendingAiLayoutFamily = layoutJson.selection?.layoutFamily || selection.layoutFamily;
      this.pendingAiColorPalette = layoutJson.selection?.colorPalette || selection.colorPalette;
      this.pendingAiStylePack = this.pendingAiColorPalette;
      if (applyAfterGenerate) {
        this.applyAiLayoutToPreview();
        new Notice(
          toAiLayoutGenerationMeta(result.generationMeta)?.executionMode === 'local-fallback'
            ? '✅ 已生成并应用原文增强结果'
            : '✅ 已生成并应用新的编排结果'
        );
      } else {
        new Notice(
          toAiLayoutGenerationMeta(result.generationMeta)?.executionMode === 'local-fallback'
            ? '✅ 已生成原文增强结果'
            : '✅ AI 编排已生成'
        );
      }
    } catch (error) {
      console.error('AI 编排生成失败:', error);
      const readableError = toReadableError(error);
      const errorRecord = toRecord(error);
      const errorGenerationMeta = toAiLayoutGenerationMeta(errorRecord.generationMeta);
      const previousState = this.getCurrentArticleLayoutState();
      const isSchemaError = errorRecord.code === 'ai-layout-schema-invalid';
      const hasReusablePreviousLayout = !!(previousState?.status === 'ready' && previousState?.layoutJson?.blocks?.length);
      await this.plugin.saveArticleLayoutState(context.sourcePath, {
        version: AI_LAYOUT_SCHEMA_VERSION,
        updatedAt: hasReusablePreviousLayout ? previousState.updatedAt : Date.now(),
        sourceHash: hasReusablePreviousLayout ? previousState.sourceHash : context.sourceHash,
        providerId: provider?.id || '',
        model: provider?.model || '',
        selection: hasReusablePreviousLayout ? previousState.selection : selection,
        resolved: hasReusablePreviousLayout ? previousState.resolved : {
          layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? 'source-first' : selection.layoutFamily,
          colorPalette: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO ? 'tech-green' : selection.colorPalette,
        },
        recommendedLayoutFamily: hasReusablePreviousLayout ? previousState.recommendedLayoutFamily : '',
        recommendedColorPalette: hasReusablePreviousLayout ? previousState.recommendedColorPalette : '',
        stylePack: hasReusablePreviousLayout
          ? previousState.stylePack
          : (selection.colorPalette === AI_LAYOUT_SELECTION_AUTO ? 'tech-green' : selection.colorPalette),
        status: hasReusablePreviousLayout ? previousState.status : (isSchemaError ? 'schema-error' : 'error'),
        lastError: readableError.message || '未知错误',
        lastAttemptStatus: isSchemaError ? 'schema-error' : 'error',
        lastAttemptError: readableError.message || '未知错误',
        lastAttemptAt: Date.now(),
        lastAttemptSchemaValidation: /** @type {AiSchemaValidationLike | null} */ (errorRecord.schemaValidation || errorGenerationMeta?.schemaValidation || null),
        dismissedBlockKeys: hasReusablePreviousLayout ? (previousState.dismissedBlockKeys || []) : [],
        generationMeta: hasReusablePreviousLayout
          ? previousState.generationMeta
          : (errorGenerationMeta || previousState?.generationMeta || null),
        layoutJson: hasReusablePreviousLayout
          ? previousState.layoutJson
          : (previousState?.layoutJson || {
          version: AI_LAYOUT_SCHEMA_VERSION,
          articleType: 'article',
          selection,
          resolved: {
            layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? 'source-first' : selection.layoutFamily,
            colorPalette: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO ? 'tech-green' : selection.colorPalette,
          },
          recommendedLayoutFamily: '',
          recommendedColorPalette: '',
          stylePack: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO ? 'tech-green' : selection.colorPalette,
          layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? 'source-first' : selection.layoutFamily,
          title: context.title,
          summary: '',
          blocks: [],
        }),
      }, selection);
      new Notice(
        hasReusablePreviousLayout
          ? '❌ 这次生成没有成功，已为你保留上一版结果'
          : (isSchemaError ? `❌ 生成失败：${readableError.message}` : `❌ 生成失败：${readableError.message}`)
      );
    } finally {
      this.aiLayoutLoading = false;
      this.aiLayoutActiveGenerationSelection = null;
      if (this.aiGenerateBtn) {
        this.aiGenerateBtn.disabled = false;
        this.aiGenerateBtn.setText(originalText || '生成并应用');
      }
      this.refreshAiLayoutPanel();
    }
  },

  /**
   * @param {{ stateOverride?: AiLayoutStateLike | null, allowStale?: boolean }} [options]
   */
  applyAiLayoutToPreview({ stateOverride = null, allowStale = false } = {}) {
    const context = this.getCurrentLayoutContext();
    const state = stateOverride || this.getCurrentArticleLayoutState();
    const visibleSnapshot = this.getVisibleAiLayoutSnapshot(state);
    if (!state || !visibleSnapshot.layoutJson?.blocks?.length) {
      new Notice('当前文章还没有可用的 AI 编排结果');
      return;
    }
    if (!allowStale && context.sourceHash && state.sourceHash && context.sourceHash !== state.sourceHash) {
      this.refreshAiLayoutPanel();
      return;
    }

    const imageRefs = extractImageRefsFromHtml(this.baseRenderedHtml || this.currentHtml || '');
    const renderedSectionFragments = extractRenderedSectionFragments(this.baseRenderedHtml || this.currentHtml || '');
    const renderLayout = this.getAiRenderLayoutJson(visibleSnapshot.layoutJson);
    const html = renderArticleLayoutHtml(renderLayout, {
      imageRefs,
      renderedSectionFragments,
      colorPaletteOverride: this.getAiColorPaletteOverride(renderLayout?.resolved?.colorPalette || renderLayout?.stylePack),
    });
    const scrollTop = this.previewContainer?.scrollTop || 0;
    this.currentHtml = html;
    this.aiPreviewApplied = true;
    if (this.previewContainer) {
      setElementHtml(this.previewContainer, html);
      this.previewContainer.scrollTop = scrollTop;
      this.previewContainer.addClass('apple-has-content');
    }
    this.syncPreviewPresentationMode();
    this.refreshAiLayoutPanel();
  },
};
