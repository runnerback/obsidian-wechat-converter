// views/settings-panel/settings-panel.js
//
// 转换视图内的「设置面板」UI（顶部工具栏 + 悬浮设置层）：面板构建、设置区块
// 助手、面板视图态重置，以及主题/字体/字号/主题色/引用样式/标点/代码块 等各
// 设置项的变更处理。从 AppleStyleView god-class 抽出为 prototype mixin
// （Object.assign 到 view 原型），方法内 `this` 用法不变。
//
// 独立目录 views/settings-panel/ 便于后续大量迭代设置 UI，不影响 input.js 主体。

import { getObsidianSetIcon, getAppleThemeApi, isMobileClient } from '../../services/obsidian-adapters.js';
import { getEventTargetValue } from '../../services/dom-utils.js';
import { APPLE_STYLE_VIEW_TITLE } from '../../services/settings-defaults.js';
import { getImageSwipeCommandCopy } from '../../services/image-swipe.js';

export const settingsPanelMixin = {
  /**
   * 创建设置面板（重构为：顶部工具栏 + 悬浮设置层）
   * @param {ObsidianElementLike} container
   */
  createSettingsPanel(container) {

    // 1. 创建顶部工具栏
    const toolbar = container.createEl('div', { cls: 'apple-top-toolbar' });

    // 1.0 最左侧固定：平台切换下拉。放在标题之前、钉在工具栏最左，
    // 位置不随右侧公众号按钮的显隐而漂移，便于肌肉记忆、方便点击。
    // 决定预览模式与发布流程，后续新增平台在此加 option
    const platformWrap = toolbar.createEl('div', { cls: 'apple-toolbar-platform-wrap' });
    const platformSelect = platformWrap.createEl('select', { cls: 'apple-toolbar-platform-select' });
    platformSelect.createEl('option', { value: 'wechat', text: '公众号' });
    platformSelect.createEl('option', { value: 'rednote', text: '小红书' });
    platformSelect.createEl('option', { value: 'x', text: 'X' });
    platformWrap.createEl('span', { cls: 'apple-toolbar-platform-arrow', text: '▾' });
    platformSelect.addEventListener('change', () => {
      this.setPreviewMode?.(platformSelect.value);
    });
    this.platformSelectEl = platformSelect;

    // 1.1 中间：双层信息（插件名 + 文档名）
    this.currentDocLabel = toolbar.createEl('div', { cls: 'apple-toolbar-title' });
    if (!isMobileClient(this.app)) {
      const pluginLine = this.currentDocLabel.createDiv({ cls: 'apple-toolbar-plugin-line' });
      pluginLine.createEl('span', { text: APPLE_STYLE_VIEW_TITLE, cls: 'apple-toolbar-plugin-name' });
    }
    this.docTitleText = this.currentDocLabel.createDiv({ text: '未选择文档', cls: 'apple-toolbar-doc-name' });

    // 1.2 右侧：操作按钮组
    const actions = toolbar.createEl('div', { cls: 'apple-toolbar-actions' });

    // 按钮工厂函数
    /**
     * @param {string} icon
     * @param {string} title
     * @param {() => unknown} onClick
     * @returns {ObsidianElementLike}
     */
    const createIconBtn = (icon, title, onClick) => {
      const btn = actions.createEl('div', {
        cls: 'apple-icon-btn',
        attr: { 'aria-label': title } // Tooltip
      });
      const setIcon = getObsidianSetIcon();
      if (typeof setIcon === 'function') {
        setIcon(btn, icon);
      }
      btn.addEventListener('click', onClick);
      return btn;
    };

    // [设置] 按钮
    const settingsButton = createIconBtn('sliders-horizontal', '样式设置', () => {
      this.togglePanel(this.settingsOverlay, settingsButton, () => this.resetSettingsPanelViewState());
    });
    settingsButton.setAttribute('aria-label', '公众号排版样式设置');
    settingsButton.setAttribute('title', '公众号排版样式设置');
    this.settingsBtn = settingsButton;

    this.aiLayoutBtn = createIconBtn('sparkles', 'AI 编排', () => this.onAiLayoutButtonClick());

    // [复制] 按钮（移动端隐藏，避免误导）
    if (!isMobileClient(this.app)) {
      this.copyBtn = createIconBtn('copy', '复制到公众号', () => this.copyHTML());
    } else {
      this.copyBtn = null;
    }

    // [小红书] 按钮组(仅小红书模式显示,由 setPreviewMode 显隐):
    // 样式设置唤起 rednote 专属悬浮层;下载弹出「当前页/全部页」小菜单
    const rednoteSettingsButton = createIconBtn('sliders-horizontal', '小红书样式设置', () => {
      this.togglePanel(this.rednoteSettingsOverlay, rednoteSettingsButton);
    });
    this.rednoteSettingsBtn = rednoteSettingsButton;
    this.rednoteDownloadBtn = createIconBtn('download', '下载图卡', (evt) => this.openRednoteDownloadMenu(evt));
    this.rednoteSettingsBtn.style.display = 'none';
    this.rednoteDownloadBtn.style.display = 'none';

    // [同步] 按钮（始终显示）:所有平台统一走「发布与分发」窗口。
    // 弹窗跟随顶栏平台下拉:公众号→微信草稿箱 tab;小红书/X→其他平台 tab,
    // 且只默认勾选对应平台(preferredPlatform)。
    this.sendBtn = createIconBtn('send', '发布与分发', () => {
      const mode = this._previewMode || 'wechat';
      if (mode === 'rednote') {
        this.showMultiPlatformSyncModal({ preferredPlatform: 'xiaohongshu' });
      } else if (mode === 'x') {
        this.showMultiPlatformSyncModal({ preferredPlatform: 'x' });
      } else {
        this.showSyncModal();
      }
    });

    // 2. 创建悬浮设置层 (初始隐藏)
    this.settingsOverlay = container.createEl('div', { cls: 'apple-settings-overlay' });
    const settingsArea = this.settingsOverlay.createEl('div', { cls: 'apple-settings-area' });
    this.settingsArea = settingsArea;

    // === 主题选择 ===
    this.createSection(settingsArea, '主题', (section) => {
      const grid = section.createEl('div', { cls: 'apple-btn-grid' });
      const themes = getAppleThemeApi().getThemeList();
      themes.forEach(t => {
        const btn = grid.createEl('button', {
          cls: `apple-btn-theme ${this.plugin.settings.theme === t.value ? 'active' : ''}`,
          text: t.label,
          attr: { title: t.label },
        });
        btn.dataset.value = t.value;
        btn.addEventListener('click', () => this.onThemeChange(t.value, grid));
      });
    });

    // === 字体选择 ===
    this.createSection(settingsArea, '字体', (section) => {
      const select = /** @type {ObsidianInputLike} */ (section.createEl('select', { cls: 'apple-select' }));
      [
        { value: 'sans-serif', label: '无衬线' },
        { value: 'serif', label: '衬线' },
        { value: 'monospace', label: '等宽' },
      ].forEach(opt => {
        const option = /** @type {ObsidianInputLike} */ (select.createEl('option', { value: opt.value, text: opt.label }));
        if (this.plugin.settings.fontFamily === opt.value) option.selected = true;
      });
      select.addEventListener('change', (e) => this.onFontFamilyChange(getEventTargetValue(e, this.plugin.settings.fontFamily)));
    });

    // === 字号选择 ===
    this.createSection(settingsArea, '字号', (section) => {
      const grid = section.createEl('div', { cls: 'apple-btn-row' });
      const sizeOpts = [
        { value: 1, label: '小' },
        { value: 2, label: '较小' },
        { value: 3, label: '推荐' },
        { value: 4, label: '较大' },
        { value: 5, label: '大' },
      ];

      sizeOpts.forEach(s => {
        const btn = grid.createEl('button', {
          cls: `apple-btn-size ${this.plugin.settings.fontSize === s.value ? 'active' : ''}`,
          text: s.label,
        });
        btn.dataset.value = s.value;
        btn.addEventListener('click', () => this.onFontSizeChange(s.value, grid));
      });
    });

    // === 主题色 (移到标题样式上方) ===
    this.createSection(settingsArea, '主题色', (section) => {
      const grid = section.createEl('div', { cls: 'apple-color-grid' });
      const colors = getAppleThemeApi().getColorList();

      // 预设颜色
      colors.forEach(c => {
        const btn = grid.createEl('button', {
          cls: `apple-btn-color ${this.plugin.settings.themeColor === c.value ? 'active' : ''}`,
        });
        btn.dataset.value = c.value;
        btn.style.setProperty('--btn-color', c.color);
        btn.addEventListener('click', () => this.onColorChange(c.value, grid));
      });

      // 自定义颜色
      const customBtn = grid.createEl('button', {
        cls: `apple-btn-custom-text ${this.plugin.settings.themeColor === 'custom' ? 'active' : ''}`,
        text: '自定义',
        title: '自定义颜色'
      });
      customBtn.dataset.value = 'custom';

      // 隐藏的颜色选择器
      const colorInput = /** @type {ObsidianInputLike} */ (grid.createEl('input', {
        type: 'color',
        cls: 'apple-color-picker-hidden'
      }));
      colorInput.value = this.plugin.settings.customColor || '#000000';
      colorInput.setCssStyles({
        visibility: 'hidden',
        width: '0',
        height: '0',
        position: 'absolute',
      });

      // 点击按钮触发颜色选择
      customBtn.addEventListener('click', () => {
        colorInput.click();
      });

      // 颜色改变实时预览
      colorInput.addEventListener('input', (e) => {
        customBtn.style.setProperty('--btn-color', getEventTargetValue(e, this.plugin.settings.customColor));
      });

      // 颜色确认后保存
      colorInput.addEventListener('change', async (e) => {
        const newColor = getEventTargetValue(e, this.plugin.settings.customColor);
        customBtn.style.setProperty('--btn-color', newColor);

        // 更新设置
        this.plugin.settings.customColor = newColor;
        this.theme.update({ customColor: newColor });
        await this.onColorChange('custom', grid);
      });
    });

    // === 页面两侧留白 ===
    this.createSection(settingsArea, '页面两侧留白', (section) => {
      const mobile = isMobileClient(this.app);
      const container = section.createEl('div', {
        cls: 'apple-slider-container',
        style: 'width: 100%; display: flex; align-items: center; gap: 10px;'
      });

      const slider = /** @type {ObsidianInputLike} */ (container.createEl('input', {
        type: 'range',
        cls: 'apple-slider',
        attr: { min: 0, max: mobile ? 36 : 40, step: 1 }
      }));
      slider.value = this.plugin.settings.sidePadding;
      slider.setCssStyles({ flex: '1' });

      const valueLabel = container.createEl('span', {
        text: `${this.plugin.settings.sidePadding}px`,
        style: 'font-size: 12px; color: var(--apple-secondary); min-width: 32px; text-align: right;'
      });

      slider.addEventListener('input', (e) => {
        const val = parseInt(getEventTargetValue(e, String(this.plugin.settings.sidePadding)), 10);
        valueLabel.setText(`${val}px`);
        // 拖动过程中只做轻量更新，避免移动端手势被重渲染卡住。
        this.plugin.settings.sidePadding = val;
        this.theme.update({ sidePadding: val });

        if (this.saveTimeout) window.clearTimeout(this.saveTimeout);
        this.saveTimeout = window.setTimeout(async () => {
          await this.plugin.saveSettings();
        }, 500);
        this.scheduleSidePaddingPreview(mobile ? 220 : 120);
      });

      slider.addEventListener('change', async (e) => {
        const val = parseInt(getEventTargetValue(e, String(this.plugin.settings.sidePadding)), 10);
        valueLabel.setText(`${val}px`);
        this.plugin.settings.sidePadding = val;
        this.theme.update({ sidePadding: val });
        if (this.sidePaddingPreviewTimer) {
          window.clearTimeout(this.sidePaddingPreviewTimer);
          this.sidePaddingPreviewTimer = null;
        }
        await this.plugin.saveSettings();
        await this.convertCurrent(true);
      });
    });

    const advancedOptions = settingsArea.createEl('details', { cls: 'apple-settings-details' });
    this.settingsAdvancedOptions = advancedOptions;
    advancedOptions.createEl('summary', {
      cls: 'apple-settings-summary',
      text: '高级选项'
    });
    const advancedArea = advancedOptions.createDiv({ cls: 'apple-settings-area apple-settings-advanced-area' });
    this.settingsAdvancedArea = advancedArea;

    // === 引用样式 ===
    const quoteStyleSection = this.createSection(advancedArea, '引用样式', (section) => {
      const select = /** @type {ObsidianInputLike} */ (section.createEl('select', { cls: 'apple-select' }));
      [
        { value: 'theme', label: '经典主题色' },
        { value: 'neutral', label: '中性灰（推荐）' },
      ].forEach((opt) => {
        const option = /** @type {ObsidianInputLike} */ (select.createEl('option', { value: opt.value, text: opt.label }));
        if (this.plugin.settings.quoteCalloutStyleMode === opt.value) option.selected = true;
      });
      select.addEventListener('change', (e) => this.onQuoteCalloutStyleModeChange(getEventTargetValue(e, this.plugin.settings.quoteCalloutStyleMode)));

      section.createEl('span', {
        text: '中性灰更适合长文阅读；经典主题色兼容现有风格。',
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); margin-top: 8px; opacity: 0.8; font-weight: 500; display: block;'
        }
      });
    });
    quoteStyleSection.classList.add('apple-settings-featured');

    // === 标题样式 (移到主题色下方) ===
    const headingStyleSection = this.createSection(advancedArea, '标题样式', (section) => {
      const row = section.createEl('div', { cls: 'apple-settings-inline-row' });

      const toggle = row.createEl('label', { cls: 'apple-toggle' });
      const checkbox = /** @type {ObsidianInputLike} */ (toggle.createEl('input', { type: 'checkbox', cls: 'apple-toggle-input' }));
      checkbox.checked = this.plugin.settings.coloredHeader;
      toggle.createEl('span', { cls: 'apple-toggle-slider' });

      section.createEl('span', {
        text: '标题使用加深主题色',
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); opacity: 0.8; font-weight: 500; display: block;'
        }
      });

      checkbox.addEventListener('change', async () => {
        this.plugin.settings.coloredHeader = checkbox.checked;
        await this.plugin.saveSettings();

        // 关键修复：更新主题状态并重绘
        this.theme.update({ coloredHeader: checkbox.checked });
        // 强制刷新
        await this.convertCurrent(true);
      });
    });
    headingStyleSection.classList.add('apple-settings-inline-toggle');

    // === 正文标点标准化 ===
    const punctuationSection = this.createSection(advancedArea, '正文标点标准化', (section) => {
      const row = section.createEl('div', { cls: 'apple-settings-inline-row' });
      const toggle = row.createEl('label', { cls: 'apple-toggle' });
      const checkbox = /** @type {ObsidianInputLike} */ (toggle.createEl('input', { type: 'checkbox', cls: 'apple-toggle-input' }));
      checkbox.checked = this.plugin.settings.normalizeChinesePunctuation === true;
      toggle.createEl('span', { cls: 'apple-toggle-slider' });

      section.createEl('span', {
        text: '仅作用于预览 / 复制 / 同步结果',
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); opacity: 0.8; font-weight: 500; display: block;'
        }
      });

      checkbox.addEventListener('change', async () => {
        this.plugin.settings.normalizeChinesePunctuation = checkbox.checked;
        await this.plugin.saveSettings();
        await this.convertCurrent(true);
      });
    });
    punctuationSection.classList.add('apple-settings-inline-toggle');

    // === Mac 代码块开关 ===
    const macCodeSection = this.createSection(advancedArea, 'Mac 风格代码块', (section) => {
      const row = section.createEl('div', { cls: 'apple-settings-inline-row' });
      const toggle = row.createEl('label', { cls: 'apple-toggle' });
      const checkbox = /** @type {ObsidianInputLike} */ (toggle.createEl('input', { type: 'checkbox', cls: 'apple-toggle-input' }));
      checkbox.checked = this.plugin.settings.macCodeBlock;
      toggle.createEl('span', { cls: 'apple-toggle-slider' });
      checkbox.addEventListener('change', () => this.onMacCodeBlockChange(checkbox.checked));
    });
    macCodeSection.classList.add('apple-settings-inline-toggle');

    // === 代码块行号开关 ===
    const codeLineNumberSection = this.createSection(advancedArea, '显示代码行号', (section) => {
      const row = section.createEl('div', { cls: 'apple-settings-inline-row' });
      const toggle = row.createEl('label', { cls: 'apple-toggle' });
      const checkbox = /** @type {ObsidianInputLike} */ (toggle.createEl('input', { type: 'checkbox', cls: 'apple-toggle-input' }));
      checkbox.checked = this.plugin.settings.codeLineNumber;
      toggle.createEl('span', { cls: 'apple-toggle-slider' });
      checkbox.addEventListener('change', () => this.onCodeLineNumberChange(checkbox.checked));
    });
    codeLineNumberSection.classList.add('apple-settings-inline-toggle');

    // === 显示图片说明文字 ===
    const captionSection = this.createSection(advancedArea, '显示图片说明文字', (section) => {
      const row = section.createEl('div', { cls: 'apple-settings-inline-row' });
      const toggle = row.createEl('label', { cls: 'apple-toggle' });
      const checkbox = /** @type {ObsidianInputLike} */ (toggle.createEl('input', { type: 'checkbox', cls: 'apple-toggle-input' }));
      checkbox.checked = this.plugin.settings.showImageCaption;
      toggle.createEl('span', { cls: 'apple-toggle-slider' });

      section.createEl('span', {
        text: '关闭水印时，在图片下方显示说明文字',
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); opacity: 0.8; font-weight: 500; display: block;'
        }
      });

      checkbox.addEventListener('change', async () => {
        this.plugin.settings.showImageCaption = checkbox.checked;
        await this.plugin.saveSettings();

        if (this.converter) {
          this.converter.updateConfig({ showImageCaption: checkbox.checked });
          await this.convertCurrent(true);
        }
      });

      this.captionToggleState = { checkbox, toggle };
    });
    captionSection.classList.add('apple-settings-inline-toggle');

    // === 横滑图片块提示 ===
    this.createSection(advancedArea, '横滑图片块', (section) => {
      const imageBlockCommand = getImageSwipeCommandCopy(this.app, 'image-swipe').name;
      const sensitiveImageBlockCommand = getImageSwipeCommandCopy(this.app, 'image-sensitive').name;
      section.createEl('span', {
        text: `选中多张图片，打开命令面板，运行「${imageBlockCommand}」或「${sensitiveImageBlockCommand}」。`,
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); opacity: 0.78; font-weight: 500; line-height: 1.6; display: block;'
        }
      });
    });

    // 根据全局水印设置更新状态
    if (this.plugin.settings.enableWatermark) {
      const captionDesc = captionSection.querySelector('.apple-setting-content > span');
      if (captionDesc) {
        captionDesc.setText('因全局设置中已开启水印，此选项默认开启');
      }
      const toggleState = this.captionToggleState;
      if (toggleState?.checkbox) {
        toggleState.checkbox.checked = true;
        toggleState.checkbox.disabled = true;
      }
      if (toggleState?.toggle) {
        toggleState.toggle.setCssStyles({
          pointerEvents: 'none',
          opacity: '0.6',
          filter: 'grayscale(100%)',
        });
      }
    }

    // === 使用指南(面板底部常驻说明,与小红书设置面板同款样式) ===
    this.createSection(settingsArea, '使用指南', (section) => {
      section.createEl('span', {
        text: `1. 实时预览：编辑文档时预览区实时渲染公众号排版效果，双向同步滚动
2. 样式设置：本面板调整主题/字体/字号/主题色，「高级选项」含引用/标题/代码块等细节
3. AI 编排：顶栏 ✨ 按钮让 AI 自动优化整篇排版与配色
4. 复制发布：顶栏复制按钮把排版结果复制进剪贴板，粘贴到公众号编辑器即可
5. 草稿同步：顶栏「发布与分发」直接保存公众号草稿，本地图片/公式/图表自动上传
6. 手机预览：插件设置中开启手机框模式，模拟手机端阅读效果`,
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); opacity: 0.8; font-weight: 500; display: block; white-space: pre-line; line-height: 1.7;'
        }
      });
    });

    this.aiLayoutOverlay = container.createEl('div', { cls: 'apple-ai-layout-overlay' });
    this.createAiLayoutPanel(this.aiLayoutOverlay);
    this.updateAiToolbarState();
  },


  /**
   * 创建设置区块
   * @param {ObsidianElementLike} parent
   * @param {string} label
   * @param {(content: ObsidianElementLike) => unknown} builder
   * @returns {ObsidianElementLike}
   */
  createSection(parent, label, builder) {
    const section = parent.createEl('div', { cls: 'apple-setting-section' });
    section.createEl('label', { cls: 'apple-setting-label', text: label });
    const content = section.createEl('div', { cls: 'apple-setting-content' });
    builder(content);
    return section;
  },

  resetSettingsPanelViewState() {
    const advancedOptions = this.settingsAdvancedOptions || this.settingsOverlay?.querySelector('.apple-settings-details');
    if (advancedOptions) advancedOptions.open = false;

    const scrollTargets = [
      this.settingsOverlay,
      this.settingsArea,
      this.settingsAdvancedArea,
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
  // === 设置变更处理 ===
  /**
   * @param {string} value
   * @param {Element} grid
   */
  async onThemeChange(value, grid) {
    this.plugin.settings.theme = value;
    await this.plugin.saveSettings();
    this.updateButtonActive(grid, value);
    this.theme?.update({ theme: value });
    await this.convertCurrent(true);
  },

  /**
   * @param {string} value
   */
  async onFontFamilyChange(value) {
    this.plugin.settings.fontFamily = value;
    await this.plugin.saveSettings();
    this.theme?.update({ fontFamily: value });
    await this.convertCurrent(true);
  },

  /**
   * @param {number} value
   * @param {Element} grid
   */
  async onFontSizeChange(value, grid) {
    this.plugin.settings.fontSize = value;
    await this.plugin.saveSettings();
    this.updateButtonActive(grid, value);
    this.theme?.update({ fontSize: value });
    await this.convertCurrent(true);
  },

  /**
   * @param {string} value
   * @param {Element} grid
   */
  async onColorChange(value, grid) {
    this.plugin.settings.themeColor = value;
    await this.plugin.saveSettings();
    this.updateButtonActive(grid, value);
    this.theme?.update({ themeColor: value });

    // 移除：不再更改全局 CSS 变量，保持设置面板 UI 为默认蓝色 (#0071e3)
    // const colorHex = this.theme.getThemeColorValue();
    // this.containerEl.style.setProperty('--apple-accent', colorHex);

    await this.convertCurrent(true);
  },

  /**
   * @param {string} value
   */
  async onQuoteCalloutStyleModeChange(value) {
    const nextValue = value === 'neutral' ? 'neutral' : 'theme';
    this.plugin.settings.quoteCalloutStyleMode = nextValue;
    await this.plugin.saveSettings();
    this.theme?.update({ quoteCalloutStyleMode: nextValue });
    await this.convertCurrent(true);
  },

  /**
   * @param {boolean} checked
   */
  async onMacCodeBlockChange(checked) {
    this.plugin.settings.macCodeBlock = checked;
    await this.plugin.saveSettings();
    this.theme?.update({ macCodeBlock: checked });
    // 重建 converter
    if (this.converter) {
      this.converter.reinit();
      await this.converter.initMarkdownIt();
    }
    await this.convertCurrent(true);
  },

  /**
   * @param {boolean} checked
   */
  async onCodeLineNumberChange(checked) {
    this.plugin.settings.codeLineNumber = checked;
    await this.plugin.saveSettings();
    this.theme?.update({ codeLineNumber: checked });
    // 重建 converter
    if (this.converter) {
      this.converter.reinit();
      await this.converter.initMarkdownIt();
    }
    await this.convertCurrent(true);
  },

  /**
   * @param {Element} grid
   * @param {string | number | boolean} value
   */
  updateButtonActive(grid, value) {
    const buttons = Array.from(grid.querySelectorAll('button'));
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value == value);
    });
  },
};
