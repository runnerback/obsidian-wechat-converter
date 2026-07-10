// views/preview/render-pipeline.js
//
// 预览渲染管线：选择渲染管线、渲染 markdown 预览、更新当前文档、占位符与
// 渲染失败占位、缺渲染提示等，从 AppleStyleView god-class（Phase 8）抽出为
// prototype mixin（Object.assign 到 view 原型），方法内 `this` 用法不变。
//
// 占位图标 data URL 仅本文件的 renderPlaceholderIcon 使用，一并从 input.js 迁入。

import { obsidianApi } from '../../services/obsidian-adapters.js';

const { MarkdownView } = obsidianApi;

const PLACEHOLDER_ICON_DATA_URL = 'data:image/png;base64,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';

export const renderPipelineMixin = {
  /**
   * @returns {RenderPipelineLike | null}
   */
  getActiveRenderPipeline() {
    return /** @type {RenderPipelineLike | null} */ (this.nativeRenderPipeline);
  },

  /**
   * @param {string} markdown
   * @param {string} sourcePath
   * @returns {Promise<string>}
   */
  async renderMarkdownForPreview(markdown, sourcePath) {
    const pipeline = this.getActiveRenderPipeline();
    if (!pipeline) {
      throw new Error('渲染管线未初始化');
    }
    return pipeline.renderForPreview(markdown, {
      sourcePath,
      settings: this.plugin.settings,
    });
  },

  /**
   * 更新当前文档显示
   */
  updateCurrentDoc() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && this.docTitleText) {
      this.docTitleText.setText(activeView.file.basename);
      this.docTitleText.setCssStyles({ color: 'var(--apple-primary)' }); // 恢复激活色
    } else if (this.lastActiveFile && this.docTitleText) {
      this.docTitleText.setText(this.lastActiveFile.basename);
      this.docTitleText.setCssStyles({ color: 'var(--apple-primary)' });
    } else if (this.docTitleText) {
      this.docTitleText.setText('未选择文档');
      this.docTitleText.setCssStyles({ color: 'var(--apple-tertiary)' }); // 灰色提示
    }
    this.updateAiToolbarState();
  },

  /**
   * 设置占位符
   */
  setPlaceholder() {
    this.previewContainer.empty();
    this.previewContainer.removeClass('apple-has-content'); // 移除内容状态类
    const placeholder = this.previewContainer.createEl('div', { cls: 'apple-placeholder' });
    const iconDiv = placeholder.createEl('div', { cls: 'apple-placeholder-icon' });
    this.renderPlaceholderIcon(iconDiv);
    placeholder.createEl('h2', { text: 'Content Studio' });
    const content = placeholder.createDiv({ cls: 'apple-placeholder-content' });
    content.createEl('p', {
      text: '当前面板用于预览微信公众号排版。请在左侧编辑器中打开或激活任意 Markdown 笔记以自动加载预览。',
      cls: 'apple-placeholder-desc'
    });
    const steps = content.createEl('div', { cls: 'apple-steps' });
    steps.createEl('div', { text: '1. 打开或点击任意 Markdown 笔记' });
    steps.createEl('div', { text: '2. 预览微信公众号排版' });
    steps.createEl('div', { text: '3. 一键复制或同步到微信、飞书、小红书等平台' });

    content.createEl('p', {
      text: '注：此面板仅预览微信排版。同步至飞书、小红书等平台直接以源 Markdown 笔记为准。',
      cls: 'apple-placeholder-note'
    });
  },

  /**
   * @param {ObsidianElementLike} iconDiv
   * @returns {Promise<void>}
   */
  renderPlaceholderIcon(iconDiv) {
    iconDiv.empty();
    const img = /** @type {ObsidianElementLike & HTMLImageElement} */ (iconDiv.createEl('img', { attr: { alt: 'Content Studio' } }));
    img.src = PLACEHOLDER_ICON_DATA_URL;
    img.setCssStyles({
      width: '64px',
      height: '64px',
      display: 'block',
    });
  },

  showRenderFailurePlaceholder(message = '') {
    if (!this.previewContainer || typeof this.previewContainer.createEl !== 'function') return;
    this.previewContainer.empty();
    this.previewContainer.removeClass('apple-has-content');
    const placeholder = this.previewContainer.createEl('div', { cls: 'apple-placeholder' });
    placeholder.createEl('div', { cls: 'apple-placeholder-icon', text: '⚠️' });
    placeholder.createEl('h2', { text: '渲染失败' });
    placeholder.createEl('p', {
      text: '当前文档尚未成功渲染，复制/同步已禁用。请修复后重试。'
    });
    if (message) {
      placeholder.createEl('p', { cls: 'apple-placeholder-note', text: `错误信息：${message}` });
    }
  },

  getMissingRenderNotice() {
    if (this.lastRenderError) {
      return '❌ 当前文档渲染失败，请修复后重试';
    }
    return '⚠️ 请先打开一个文章进行转换';
  },
};
