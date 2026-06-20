/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: JS file handles dynamic API responses without strict typescript type annotations */
// views/publish-modal/feishu.js
//
// Renders the Feishu tab content inside the publish modal.
// Modularized to avoid bloat in input.js.
// Uses Obsidian APIs (Setting, Notice, etc.).

import { getActiveWindowValue } from '../../services/dom-utils.js';
import { syncNoteToFeishu } from '../../services/feishu-sync.js';
import { findFeishuHistoryByPath } from '../../services/feishu-settings.js';

/**
 * Renders the Feishu publish tab content.
 * @param {any} view AppleStyleView instance
 * @param {any} modal Obsidian Modal instance
 * @param {HTMLDivElement} containerEl The container to render the tab content inside
 * @param {object} [options={}] Injected options
 */
function renderFeishuPublishTab(view, modal, containerEl, options = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic obsidian api resolution
  const obsidian = options.obsidianApi || view.plugin.obsidianApi || getActiveWindowValue('obsidian') || {};
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic Setting component
  const Setting = obsidian.Setting;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic Notice component
  const Notice = obsidian.Notice;

  const { plugin } = view;
  const settings = plugin.settings.feishuSync;

  // Clear previous content
  containerEl.empty();

  // 1. Re-render the tab headers inside containerEl (so they stay when switching tabs)
  const tabsWrapper = containerEl.createDiv({ cls: 'wechat-publish-mode-tabs' });
  
  const wechatTabBtn = tabsWrapper.createEl('button', {
    text: '微信草稿箱',
    cls: 'wechat-publish-mode-tab',
  });
  wechatTabBtn.onclick = () => {
    view.showSyncModal({ modal });
  };

  tabsWrapper.createEl('button', {
    text: '飞书云文档',
    cls: 'wechat-publish-mode-tab is-active',
  });

  const multiTabBtn = tabsWrapper.createEl('button', {
    cls: 'wechat-publish-mode-tab',
  });
  multiTabBtn.createEl('span', { text: '其他平台（小红书/知乎等）' });
  multiTabBtn.onclick = () => {
    view.showMultiPlatformSyncModal({ modal });
  };

  // 2. Tab Content wrapper
  const contentWrapper = containerEl.createDiv({ cls: 'wechat-feishu-publish-content' });
  contentWrapper.setCssStyles({ padding: '16px 0' });

  // 3. Check if Feishu sync is enabled and configured
  if (!settings || !settings.enabled || !settings.appId || !settings.appSecret || !settings.folderToken) {
    const emptyState = contentWrapper.createDiv({ cls: 'wechat-sync-empty-state' });
    emptyState.createEl('h3', { text: '尚未完成飞书同步配置' });
    emptyState.createEl('p', { text: '一键同步至飞书前，需要先在插件设置中开启并填写 App ID、App Secret 和目标文件夹 Token。' });
    
    const goSettingsBtn = emptyState.createEl('button', { text: '去设置', cls: 'mod-cta' });
    goSettingsBtn.onclick = () => {
      modal.close();
      view.openPluginSettings();
    };
    return;
  }

  // 4. Resolve the file to publish
  const activeFile = view.getPublishContextFile();
  if (!activeFile) {
    contentWrapper.createEl('p', { text: '❌ 未找到当前活动的 Markdown 笔记，请先打开一篇文档。', cls: 'text-error' });
    return;
  }

  // Resolve defaults
  const historyItem = findFeishuHistoryByPath(settings, activeFile.path);
  const isUpdate = !!(historyItem && historyItem.docToken);

  contentWrapper.createEl('h3', { text: '发布设置', cls: 'wechat-feishu-section-title' });

  // 5. Title setting
  let docTitle = activeFile.basename;
  const titleSetting = new Setting(contentWrapper)
    .setName('文档标题')
    .setDesc('发布至飞书时的文档标题。默认使用笔记文件名，支持自定义。')
    .addText((text) => text
      .setPlaceholder('请输入文档标题')
      .setValue(docTitle)
      .onChange((val) => {
        docTitle = val.trim();
      })
    );

  // 6. Sync info / Target Info
  new Setting(contentWrapper)
    .setName('同步目标文件夹')
    .setDesc(`Token: ${settings.folderToken.substring(0, 10)}... (将在此文件夹下创建 or 覆盖文档)`);

  const statusCard = contentWrapper.createDiv({ cls: 'wechat-feishu-status-card' });
  statusCard.setCssStyles({
    margin: '12px 0',
    padding: '12px 14px',
    border: '1px solid var(--background-modifier-border)',
    borderRadius: '6px',
    background: 'var(--background-primary)',
    fontSize: '13px',
  });

  if (isUpdate) {
    statusCard.createEl('p', {
      text: `🔄 该笔记已于 ${historyItem.uploadTime.substring(0, 16).replace('T', ' ')} 同步过。再次同步将启用「智能覆盖更新」模式，直接更新飞书文档正文，链接保持不变。`,
      cls: 'text-success',
    });
  } else {
    statusCard.createEl('p', {
      text: '🆕 第一次同步该笔记。点击开始同步后，系统会检索云端是否有同名文档，若有则自动关联更新，若无则新建文档并绑定。',
      cls: 'text-muted',
    });
  }

  // 7. Loading / Progress Indicator
  const progressWrapper = contentWrapper.createDiv({ cls: 'wechat-feishu-progress' });
  progressWrapper.setCssStyles({ display: 'none', margin: '20px 0', textAlign: 'center' });
  const progressText = progressWrapper.createEl('p', { text: '正在准备同步...', cls: 'feishu-progress-message' });
  progressText.setCssStyles({ fontWeight: 'bold', color: 'var(--text-accent)' });

  // 8. Result Card (Doc link, copy, open buttons)
  const resultCard = contentWrapper.createDiv({ cls: 'wechat-feishu-result-card' });
  resultCard.setCssStyles({ display: 'none', margin: '16px 0', padding: '16px', border: '1px solid var(--background-modifier-border)', borderRadius: '6px', background: 'var(--background-secondary)' });

  // 9. Sync Buttons row
  const buttonRow = contentWrapper.createDiv({ cls: 'wechat-modal-buttons' });
  const cancelBtn = buttonRow.createEl('button', { text: '取消' });
  cancelBtn.onclick = () => modal.close();

  const syncBtn = buttonRow.createEl('button', { text: isUpdate ? '更新至飞书' : '同步至飞书', cls: 'mod-cta' });
  
  syncBtn.onclick = async () => {
    // Disable inputs and buttons
    titleSetting.settingEl.addClass('is-disabled');
    syncBtn.disabled = true;
    cancelBtn.disabled = true;
    
    // Show progress
    progressWrapper.setCssStyles({ display: 'block' });
    resultCard.setCssStyles({ display: 'none' });

    try {
      const markdown = await view.app.vault.read(activeFile);
      
      const result = await syncNoteToFeishu({
        app: view.app,
        settings,
        activeFile,
        markdown,
        onProgress: (stage, message) => {
          progressText.setText(message);
        },
        requestUrl: obsidian.requestUrl,
      });

      // Save settings
      await plugin.saveSettings();

      // Show success
      progressWrapper.setCssStyles({ display: 'none' });
      resultCard.empty();
      
      const h4 = resultCard.createEl('h4', { text: '🎉 同步成功！' });
      h4.setCssStyles({ color: 'var(--text-success)', marginTop: '0' });

      if (result.transferOwnerWarning) {
        const warning = resultCard.createEl('p', {
          text: `⚠️ 文档已导入并更新，但文档所有权转移失败 (${result.transferOwnerWarning})。文档已存放在目标文件夹中，您可以照常协作。`,
        });
        warning.setCssStyles({ fontSize: '12px', color: 'var(--text-warning)' });
      }

      if (result.imageSummary && (result.imageSummary.skipped || result.imageSummary.failed)) {
        const imageWarning = resultCard.createEl('p', {
          text: `⚠️ 文档已同步，但有 ${result.imageSummary.skipped + result.imageSummary.failed} 张本地图片未处理。远程图片已交由飞书导入；本地 GIF 或异常图片会被跳过以保护 Obsidian 稳定性。`,
        });
        imageWarning.setCssStyles({ fontSize: '12px', color: 'var(--text-warning)' });
      }

      const linkContainer = resultCard.createDiv();
      linkContainer.createSpan({ text: '飞书链接: ' });
      const a = linkContainer.createEl('a', { text: result.title, href: result.url });
      a.onclick = (e) => {
        e.preventDefault();
        if (view.plugin && typeof view.plugin.openExternalUrl === 'function') {
          view.plugin.openExternalUrl(result.url);
        } else {
          window.open(result.url, '_blank', 'noopener');
        }
      };

      const resultActions = resultCard.createDiv();
      resultActions.setCssStyles({ marginTop: '12px', display: 'flex', gap: '10px' });
      
      const openBtn = resultActions.createEl('button', { text: '在浏览器中打开', cls: 'mod-cta' });
      openBtn.onclick = () => a.click();

      const copyBtn = resultActions.createEl('button', { text: '复制链接' });
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(result.url);
        new Notice('✅ 链接已复制到剪贴板');
      };

      resultCard.setCssStyles({ display: 'block' });
      
      // Re-enable cancel button to let them close
      cancelBtn.disabled = false;
      cancelBtn.setText('关闭');
      syncBtn.setCssStyles({ display: 'none' });
      
      if (result.imageSummary && (result.imageSummary.skipped || result.imageSummary.failed)) {
        new Notice('✅ 飞书文档已同步，部分本地图片未处理');
      } else {
        new Notice('✅ 飞书文档同步成功！');
      }
    } catch (err) {
      console.error('[飞书同步失败]:', err);
      progressWrapper.setCssStyles({ display: 'none' });
      
      // Re-enable
      titleSetting.settingEl.removeClass('is-disabled');
      syncBtn.disabled = false;
      cancelBtn.disabled = false;
      
      new Notice(`❌ 同步失败: ${err.message || String(err)}`, 8000);
    }
  };
}

export {
  renderFeishuPublishTab,
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: resume typed linting after Feishu publish modal Obsidian UI boundary */
