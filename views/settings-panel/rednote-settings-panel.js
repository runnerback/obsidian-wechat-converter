// views/settings-panel/rednote-settings-panel.js
//
// 小红书模式的「样式设置」悬浮层 + 顶栏下载菜单。与公众号侧共用同一套
// 交互范式(顶栏图标按钮唤起 apple-settings-overlay 悬浮层),控件变更
// 直接调用 RedPreviewController 的公开方法(rednote/view.ts)。
// 悬浮层在首次切到小红书模式(controller 就绪)后由 setPreviewMode 构建。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import { getEventTargetValue } from '../../services/dom-utils.js';

const { Notice } = obsidianApi;

export const rednoteSettingsPanelMixin = {
  /**
   * 构建小红书样式设置悬浮层(仅构建一次)
   * @param {ObsidianElementLike} container 视图根容器(与公众号设置层同级)
   * @param {import('../../rednote/view.ts').RedPreviewController} controller
   */
  createRednoteSettingsPanel(container, controller) {
    if (this.rednoteSettingsOverlay) return;

    const overlay = container.createEl('div', { cls: 'apple-settings-overlay' });
    this.rednoteSettingsOverlay = overlay;
    const area = overlay.createEl('div', { cls: 'apple-settings-area' });

    const settings = controller.getSettings();

    /**
     * 下拉区块助手:与公众号侧「字体」等区块同款的原生 select
     * @param {string} label
     * @param {{ value: string, label: string }[]} options
     * @param {string} currentValue
     * @param {(value: string) => Promise<void>} onChange
     */
    const createSelectSection = (label, options, currentValue, onChange) => {
      this.createSection(area, label, (section) => {
        const select = /** @type {ObsidianInputLike} */ (section.createEl('select', { cls: 'apple-select' }));
        options.forEach(opt => {
          const option = /** @type {ObsidianInputLike} */ (select.createEl('option', { value: opt.value, text: opt.label }));
          if (opt.value === currentValue) option.selected = true;
        });
        select.addEventListener('change', (e) => {
          onChange(getEventTargetValue(e, currentValue));
        });
      });
    };

    // === 模板 ===
    createSelectSection('模板', controller.getTemplateOptions(), settings.templateId,
      (value) => controller.setTemplate(value));

    // === 主题 ===
    createSelectSection('主题', controller.getThemeOptions(), settings.themeId,
      (value) => controller.setTheme(value));

    // === 字体 ===
    createSelectSection('字体', controller.getFontOptions(), settings.fontFamily,
      (value) => controller.setFont(value));

    // === 字号 ===
    this.createSection(area, '字号', (section) => {
      const row = section.createEl('div', {
        cls: 'apple-slider-container',
        style: 'width: 100%; display: flex; align-items: center; gap: 10px;'
      });
      const slider = /** @type {ObsidianInputLike} */ (row.createEl('input', {
        type: 'range',
        cls: 'apple-slider',
        attr: { min: 12, max: 30, step: 1 }
      }));
      slider.value = String(settings.fontSize || 16);
      slider.setCssStyles({ flex: '1' });

      const valueLabel = row.createEl('span', {
        text: `${settings.fontSize || 16}px`,
        style: 'font-size: 12px; color: var(--apple-secondary); min-width: 32px; text-align: right;'
      });

      slider.addEventListener('input', (e) => {
        valueLabel.setText(`${getEventTargetValue(e, slider.value)}px`);
      });
      slider.addEventListener('change', (e) => {
        const size = parseInt(getEventTargetValue(e, slider.value), 10);
        valueLabel.setText(`${size}px`);
        controller.setFontSize(size);
      });
    });

    // === 背景图 ===
    this.createSection(area, '背景图', (section) => {
      const btn = section.createEl('button', {
        cls: 'apple-btn-theme',
        text: '设置背景图片…',
      });
      btn.addEventListener('click', () => {
        this.closeTransientPanels();
        controller.openBackgroundModal();
      });
    });

    // === 使用指南(原底栏帮助按钮 tooltip 改为常驻说明) ===
    this.createSection(area, '使用指南', (section) => {
      section.createEl('span', {
        text: controller.getUsageGuideText(),
        attr: {
          style: 'font-size: 11px; color: var(--apple-secondary); opacity: 0.8; font-weight: 500; display: block; white-space: pre-line; line-height: 1.7;'
        }
      });
    });

    this.attachOverlayScrollGuard(overlay);
  },

  /**
   * 顶栏下载按钮:弹出小菜单选择「下载当前页 / 导出全部页」
   * @param {MouseEvent} event
   */
  openRednoteDownloadMenu(event) {
    const controller = this.rednoteController;
    if (!controller) return;

    const menu = new obsidianApi.Menu();
    menu.addItem((item) => item
      .setTitle('下载当前页')
      .setIcon('image-down')
      .onClick(() => this.runRednoteExport(() => controller.downloadCurrentPage(), '当前页')));
    menu.addItem((item) => item
      .setTitle('导出全部页')
      .setIcon('images')
      .onClick(() => this.runRednoteExport(() => controller.downloadAllPages(), '全部页')));
    menu.showAtMouseEvent(event);
  },

  /**
   * 执行导出并以 Notice 反馈结果(替代原底栏按钮的文案态)
   * @param {() => Promise<void>} task
   * @param {string} label
   */
  async runRednoteExport(task, label) {
    try {
      new Notice(`正在导出${label}…`);
      await task();
      new Notice(`${label}导出成功`);
    } catch (error) {
      console.error('图卡导出失败:', error);
      new Notice(`导出失败: ${/** @type {Error} */ (error).message}`);
    }
  },
};
