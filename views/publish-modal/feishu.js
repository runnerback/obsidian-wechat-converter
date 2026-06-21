/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: JS file handles dynamic API responses without strict typescript type annotations */
// views/publish-modal/feishu.js
//
// Renders the Feishu tab content inside the publish modal.
// Modularized to avoid bloat in input.js.
// Uses Obsidian APIs (Setting, Notice, etc.).

import { getActiveWindowValue } from '../../services/dom-utils.js';
import { syncNoteToFeishu } from '../../services/feishu-sync.js';
import {
  findFeishuHistoryByPath,
  parseFeishuDocUrlOrToken,
  rebindFeishuHistoryByPath,
} from '../../services/feishu-settings.js';

/**
 * @param {unknown} Notice
 * @param {string} message
 * @param {number} [duration]
 * @returns {any}
 */
function showFeishuNotice(Notice, message, duration) {
  if (typeof Notice !== 'function') return null;
  return new Notice(message, duration);
}

/**
 * @param {any} notice
 * @param {string} message
 */
function updateFeishuNotice(notice, message) {
  if (notice && typeof notice.setMessage === 'function') {
    notice.setMessage(message);
  }
}

/** @param {any} notice */
function hideFeishuNotice(notice) {
  if (notice && typeof notice.hide === 'function') {
    notice.hide();
  }
}

/**
 * @param {any} imageSummary
 * @returns {string}
 */
function formatFeishuImageWarning(imageSummary) {
  const count = Number(imageSummary?.skipped || 0) + Number(imageSummary?.failed || 0);
  if (!count) return '';
  return `有 ${count} 张图片未完成同步处理，通常是异常文件或后处理失败；远程图片仍会交由飞书导入。`;
}

/**
 * @param {any} result
 * @returns {string[]}
 */
function getFeishuResultWarnings(result) {
  const warnings = [];
  if (result?.transferOwnerWarning) {
    warnings.push('文档已同步，但所有权转移未完成。你仍可以照常使用该文档；如需自动转移，请检查飞书 User ID 和应用权限。');
  }
  const imageWarning = formatFeishuImageWarning(result?.imageSummary);
  if (imageWarning) warnings.push(imageWarning);
  return warnings;
}

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

  const shell = containerEl.createDiv({ cls: 'wechat-feishu-publish-shell' });

  // 2. Tab Content wrapper
  const contentWrapper = shell.createDiv({ cls: 'wechat-feishu-publish-content' });

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

  const introCard = contentWrapper.createDiv({ cls: 'wechat-feishu-intro-card' });
  introCard.createEl('div', { text: isUpdate ? '覆盖更新模式' : '首次同步模式', cls: 'wechat-feishu-intro-kicker' });
  introCard.createEl('p', {
    text: isUpdate
      ? '本次会尽量保持原文档链接不变，先清空旧正文，再写入最新内容。'
      : '本次会优先在目标文件夹里查找同名文档，命中则自动恢复绑定，未命中则新建。',
  });

  const settingsSection = contentWrapper.createDiv({ cls: 'wechat-modal-section wechat-feishu-section' });
  settingsSection.createEl('h3', { text: '发布设置', cls: 'wechat-feishu-section-title' });

  // 5. Title setting
  let docTitle = activeFile.basename;
  const titleSetting = new Setting(settingsSection)
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
  new Setting(settingsSection)
    .setName('同步目标文件夹')
    .setDesc(`Token: ${settings.folderToken.substring(0, 10)}... (将在此文件夹下创建 or 覆盖文档)`);

  const statusSection = contentWrapper.createDiv({ cls: 'wechat-modal-section wechat-feishu-section' });
  statusSection.createEl('h3', { text: '同步状态', cls: 'wechat-feishu-section-title' });
  const statusCard = statusSection.createDiv({ cls: 'wechat-feishu-status-card' });

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

  const rebindCard = statusSection.createDiv({ cls: 'wechat-feishu-rebind-card' });
  rebindCard.createEl('div', { text: '文档绑定', cls: 'wechat-feishu-rebind-title' });
  rebindCard.createEl('p', {
    text: '如果飞书端文档被移动、重建，或本地缓存还指向旧 token，可以粘贴新的飞书 docx 链接来重新绑定当前笔记。',
    cls: 'wechat-feishu-rebind-desc',
  });
  const rebindControls = rebindCard.createDiv({ cls: 'wechat-feishu-rebind-controls' });
  const rebindInput = rebindControls.createEl('input', {
    type: 'text',
    placeholder: '粘贴飞书文档 URL 或 docx token',
    cls: 'wechat-feishu-rebind-input',
  });
  if (historyItem?.url) {
    rebindInput.value = historyItem.url;
  }
  const rebindBtn = rebindControls.createEl('button', { text: isUpdate ? '更新绑定' : '绑定已有文档' });
  const rebindHint = rebindCard.createEl('p', { text: '', cls: 'wechat-feishu-rebind-hint' });
  rebindBtn.onclick = async () => {
    const parsed = parseFeishuDocUrlOrToken(rebindInput.value);
    if (!parsed) {
      rebindHint.setText('请输入有效的飞书 docx 链接或 token。');
      rebindHint.addClass('is-error');
      showFeishuNotice(Notice, '❌ 飞书文档链接无效');
      return;
    }

    const rebound = rebindFeishuHistoryByPath(settings, activeFile.path, {
      title: docTitle || activeFile.basename,
      url: parsed.url,
      docToken: parsed.docToken,
      uploadTime: new Date().toISOString(),
    });
    if (!rebound) {
      rebindHint.setText('绑定失败，请确认当前笔记路径和飞书链接。');
      rebindHint.addClass('is-error');
      showFeishuNotice(Notice, '❌ 绑定失败');
      return;
    }

    await plugin.saveSettings();
    showFeishuNotice(Notice, '✅ 已重新绑定当前笔记的飞书文档');
    renderFeishuPublishTab(view, modal, containerEl, options);
  };

  // 7. Result Card (summary + actions)
  const resultCard = contentWrapper.createDiv({ cls: 'wechat-feishu-result-card' });
  resultCard.addClass('is-hidden');

  // 8. Sync Buttons row
  const buttonRow = shell.createDiv({ cls: 'wechat-modal-buttons' });
  const cancelBtn = buttonRow.createEl('button', { text: '取消' });
  cancelBtn.onclick = () => modal.close();

  const syncBtn = buttonRow.createEl('button', { text: isUpdate ? '更新至飞书' : '同步至飞书', cls: 'mod-cta' });
  
  syncBtn.onclick = async () => {
    // Disable inputs and buttons
    titleSetting.settingEl.addClass('is-disabled');
    syncBtn.disabled = true;
    cancelBtn.disabled = true;
    
    resultCard.addClass('is-hidden');
    const progressNotice = showFeishuNotice(
      Notice,
      isUpdate ? '🚀 正在更新飞书文档...' : '🚀 正在同步到飞书文档...',
      0
    );

    try {
      const markdown = await view.app.vault.read(activeFile);
      
      const result = await syncNoteToFeishu({
        app: view.app,
        settings,
        activeFile,
        markdown,
        onProgress: (stage, message) => {
          updateFeishuNotice(progressNotice, message);
        },
        requestUrl: obsidian.requestUrl,
      });

      // Save settings
      await plugin.saveSettings();

      hideFeishuNotice(progressNotice);
      resultCard.empty();
      const warnings = getFeishuResultWarnings(result);
      resultCard.addClass(warnings.length ? 'has-warning' : 'is-success');
      resultCard.removeClass(warnings.length ? 'is-success' : 'has-warning');

      resultCard.createEl('h4', {
        text: warnings.length ? '同步完成' : '同步成功',
        cls: 'wechat-feishu-result-title',
      });
      resultCard.createEl('p', {
        text: warnings.length
          ? '飞书文档已导入并更新，下面有少量事项需要确认。'
          : '飞书文档已导入并更新，可以直接打开查看。',
        cls: 'wechat-feishu-result-desc',
      });

      if (warnings.length) {
        const warningList = resultCard.createDiv({ cls: 'wechat-feishu-result-warnings' });
        for (const warningText of warnings) {
          warningList.createEl('p', { text: warningText, cls: 'wechat-feishu-result-warning' });
        }
      }

      const resultActions = resultCard.createDiv({ cls: 'wechat-feishu-result-actions' });
      
      const openBtn = resultActions.createEl('button', { text: '在浏览器中打开', cls: 'mod-cta' });
      openBtn.onclick = () => {
        if (view.plugin && typeof view.plugin.openExternalUrl === 'function') {
          view.plugin.openExternalUrl(result.url);
        } else {
          window.open(result.url, '_blank', 'noopener');
        }
      };

      const copyBtn = resultActions.createEl('button', { text: '复制链接' });
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(result.url);
          showFeishuNotice(Notice, '✅ 链接已复制到剪贴板');
        } catch (copyError) {
          console.warn('[飞书同步] 复制链接失败:', copyError);
          showFeishuNotice(Notice, '❌ 复制链接失败，请手动打开后复制');
        }
      };

      resultCard.removeClass('is-hidden');
      
      // Re-enable cancel button to let them close
      cancelBtn.disabled = false;
      cancelBtn.setText('关闭');
      syncBtn.setCssStyles({ display: 'none' });
      
      showFeishuNotice(
        Notice,
        warnings.length ? '✅ 飞书文档已同步，部分事项需要确认' : '✅ 飞书文档同步成功！',
        warnings.length ? 7000 : undefined
      );
    } catch (err) {
      console.error('[飞书同步失败]:', err);
      hideFeishuNotice(progressNotice);
      
      // Re-enable
      titleSetting.settingEl.removeClass('is-disabled');
      syncBtn.disabled = false;
      cancelBtn.disabled = false;
      
      showFeishuNotice(Notice, `❌ 同步失败: ${err.message || String(err)}`, 8000);
    }
  };
}

export {
  renderFeishuPublishTab,
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: resume typed linting after Feishu publish modal Obsidian UI boundary */
