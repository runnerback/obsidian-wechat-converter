/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: JS file handles dynamic API responses without strict typescript type annotations */
// views/settings/feishu-tab.js
//
// Renders the「飞书」settings tab in the AppleStyleSettingTab.
// Extracted to keep input.js clean and maintain separation of concerns.
// Uses Obsidian APIs (Setting, Notice, etc.).

import { getActiveWindowValue } from '../../services/dom-utils.js';
import { FeishuApiClient } from '../../services/feishu-api.js';
import { normalizeFeishuSyncSettings } from '../../services/feishu-settings.js';

/**
 * Renders the Feishu Sync settings inside the settings tab.
 * @param {any} tab AppleStyleSettingTab instance
 * @param {HTMLDivElement} containerEl settings tab sub-container
 * @param {object} [options={}] Injected options
 */
function renderFeishuSettingsTab(tab, containerEl, options = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic obsidian api resolution
  const obsidian = options.obsidianApi || tab.plugin.obsidianApi || getActiveWindowValue('obsidian') || {};
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic Setting component
  const Setting = obsidian.Setting;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic Notice component
  const Notice = obsidian.Notice;

  const { plugin } = tab;
  const settings = normalizeFeishuSyncSettings(plugin.settings.feishuSync);
  plugin.settings.feishuSync = settings;

  containerEl.empty();

  containerEl.createEl('h2', { text: '飞书云文档同步配置', cls: 'wechat-feishu-heading' });
  containerEl.createEl('p', {
    text: '通过飞书自建应用机器人接口，将当前 Obsidian 笔记一键发布并转换为原生的飞书云文档（docx），支持保留标题、表格、以及图片上传（包含本地和图床图片）。',
    cls: 'setting-item-description',
  });

  // 1. Enable Toggle
  new Setting(containerEl)
    .setName('启用飞书同步功能')
    .setDesc('开启后，发布弹窗中会出现「飞书」选项卡，支持将笔记发布至飞书云盘。')
    .addToggle((toggle) => toggle
      .setValue(settings.enabled)
      .onChange(async (value) => {
        settings.enabled = value;
        await plugin.saveSettings();
        tab.display(); // re-render setting tab
      })
    );

  if (!settings.enabled) return;

  // 2. App ID
  new Setting(containerEl)
    .setName('飞书自建应用 App ID')
    .setDesc('在飞书开放平台（open.feishu.cn）中，您创建的企业自建应用的 App ID')
    .addText((text) => text
      .setPlaceholder('cli_a248xxxxxxxxxxxx')
      .setValue(settings.appId)
      .onChange(async (value) => {
        settings.appId = value.trim();
        await plugin.saveSettings();
      })
    );

  // 3. App Secret
  new Setting(containerEl)
    .setName('飞书自建应用 App Secret')
    .setDesc('自建应用的 App Secret 凭证')
    .addText((text) => {
      text.inputEl.type = 'password'; // mask the password input
      text
        .setPlaceholder('xxxxxxxxxxxxxxxxxxxx')
        .setValue(settings.appSecret)
        .onChange(async (value) => {
          settings.appSecret = value.trim();
          await plugin.saveSettings();
        });
    });

  // 4. Folder Token
  new Setting(containerEl)
    .setName('同步目标文件夹 Token')
    .setDesc('飞书文件夹链接中的最后一串字符。例如：https://feishu.cn/drive/folder/fldcnXXXXXXXXX 的 Token 是 fldcnXXXXXXXXX')
    .addText((text) => text
      .setPlaceholder('fldcnxxxxxxxxxxxxxxxxxx')
      .setValue(settings.folderToken)
      .onChange(async (value) => {
        settings.folderToken = value.trim();
        await plugin.saveSettings();
      })
    );

  // 5. User ID
  new Setting(containerEl)
    .setName('飞书用户 ID (User ID)')
    .setDesc('用于在同步成功后，把文档的所有权由机器人自动转移给您本人（您的飞书云盘中）。建议使用 user_id 格式，如 abc1234。')
    .addText((text) => text
      .setPlaceholder('abc1234')
      .setValue(settings.userId)
      .onChange(async (value) => {
        settings.userId = value.trim();
        await plugin.saveSettings();
      })
    );

  // 6. Test Connection Button
  new Setting(containerEl)
    .setName('测试连接')
    .setDesc('验证配置是否正确。将验证自建应用授权，以及文件夹的可写性。')
    .addButton((btn) => btn
      .setButtonText('测试连接')
      .onClick(async () => {
        if (!settings.appId || !settings.appSecret) {
          new Notice('❌ 请先填写 App ID 和 App Secret！');
          return;
        }
        if (!settings.folderToken) {
          new Notice('❌ 请先填写同步目标文件夹 Token！');
          return;
        }

        const notice = new Notice('⏳ 正在进行飞书连接测试...', 0);
        try {
          const client = new FeishuApiClient(settings.appId, settings.appSecret, obsidian.requestUrl);
          
          // Verify authentication token
          await client.getAccessToken();
          
          // Verify folder read access
          await client.listFolderItems(settings.folderToken);
          
          notice.hide();
          new Notice('✅ 飞书连接成功，且目标文件夹访问正常！');
        } catch (err) {
          notice.hide();
          console.error('[飞书连接测试失败]:', err);
          new Notice(`❌ 飞书连接测试失败: ${err.message || String(err)}`, 7000);
        }
      })
    );

  // 7. Render setup instructions
  const guideCard = containerEl.createDiv({ cls: 'wechat-feishu-guide-card' });
  guideCard.setCssStyles({
    margin: '24px 0',
    padding: '20px',
    border: '1px solid var(--background-modifier-border-hover)',
    borderRadius: '8px',
    background: 'var(--background-secondary)',
    boxShadow: 'var(--shadow-s)',
  });

  // Title
  const titleEl = guideCard.createEl('h3', { cls: 'guide-card-title' });
  titleEl.setText('飞书应用配置简易步骤 (SOP Guide):');
  titleEl.setCssStyles({
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-normal)',
    margin: '0 0 12px 0',
  });

  // Link Row
  const detailedLinkRow = guideCard.createDiv({ cls: 'wechat-feishu-guide-link-row' });
  detailedLinkRow.setCssStyles({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '18px',
    padding: '8px 12px',
    background: 'var(--background-primary)',
    borderRadius: '6px',
    border: '1px solid var(--background-modifier-border)',
  });

  detailedLinkRow.createSpan({ text: '💡 ' });
  const detailedLink = detailedLinkRow.createEl('a', {
    text: '点击查看飞书同步详细图文配置与排障指南 ➔',
    href: 'https://xiaoweibox.top/chats/feishu-sync',
  });
  detailedLink.onclick = (e) => {
    e.preventDefault();
    if (plugin && typeof plugin.openExternalUrl === 'function') {
      plugin.openExternalUrl('https://xiaoweibox.top/chats/feishu-sync');
    } else {
      window.open('https://xiaoweibox.top/chats/feishu-sync', '_blank', 'noopener');
    }
  };
  detailedLink.setCssStyles({
    color: 'var(--text-accent)',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  });
  detailedLink.onmouseenter = () => {
    detailedLink.setCssStyles({ textDecoration: 'underline' });
  };
  detailedLink.onmouseleave = () => {
    detailedLink.setCssStyles({ textDecoration: 'none' });
  };

  // Steps list
  const stepsContainer = guideCard.createDiv({ cls: 'guide-steps-list' });
  stepsContainer.setCssStyles({
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });

  // Helper function to render a step item
  const renderStep = (num, contentFn) => {
    const stepRow = stepsContainer.createDiv();
    stepRow.setCssStyles({
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    });

    const badge = stepRow.createSpan();
    badge.setText(num.toString());
    badge.setCssStyles({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: 'var(--interactive-accent)',
      color: 'var(--text-on-interactive-accent, #ffffff)',
      fontSize: '11px',
      fontWeight: 'bold',
      flexShrink: '0',
      marginTop: '2px',
    });

    const body = stepRow.createDiv();
    body.setCssStyles({
      fontSize: '13px',
      lineHeight: '1.6',
      color: 'var(--text-normal)',
      flexGrow: '1',
    });

    contentFn(body);
  };

  // Step 1
  renderStep(1, (body) => {
    body.createSpan({ text: '访问 ' });
    const link = body.createEl('a', { text: '飞书开放平台', href: 'https://open.feishu.cn/' });
    link.onclick = (e) => {
      e.preventDefault();
      if (plugin && typeof plugin.openExternalUrl === 'function') {
        plugin.openExternalUrl('https://open.feishu.cn/');
      } else {
        window.open('https://open.feishu.cn/', '_blank', 'noopener');
      }
    };
    link.setCssStyles({ color: 'var(--text-accent)', textDecoration: 'underline' });
    body.createSpan({ text: ' 创建自建应用，并在「应用功能」中启用「机器人」能力。' });
  });

  // Step 2
  renderStep(2, (body) => {
    body.createSpan({ text: '进入「权限管理」开通以下权限，并点击「版本管理与发布」申请上线（需管理员审批）：' });
    const subList = body.createDiv();
    subList.setCssStyles({
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginTop: '8px',
      paddingLeft: '12px',
      borderLeft: '2px solid var(--interactive-accent)',
    });

    const addSubItem = (codeText, descText) => {
      const item = subList.createDiv();
      item.setCssStyles({ display: 'flex', alignItems: 'center', gap: '6px' });
      
      const code = item.createEl('code', { text: codeText });
      code.setCssStyles({
        fontFamily: 'var(--font-monospace)',
        fontSize: '12px',
        padding: '2px 6px',
        background: 'var(--background-primary)',
        border: '1px solid var(--background-modifier-border)',
        borderRadius: '4px',
        color: 'var(--code-normal)',
      });

      const desc = item.createSpan({ text: descText });
      desc.setCssStyles({ color: 'var(--text-muted)', fontSize: '12px' });
    };

    addSubItem('drive:drive', '查看、编辑云空间所有文件 (应用和用户身份)');
    addSubItem('docs:document:import', '导入为文档 (应用和用户身份)');
  });

  // Step 3
  renderStep(3, (body) => {
    body.createSpan({ text: '在飞书客户端新建群聊，添加自建机器人，并将云盘同步文件夹共享给该群，协作权限必须选择 ' });
    const strong = body.createEl('strong', { text: '「可管理」' });
    strong.setCssStyles({ color: 'var(--text-accent)' });
    body.createSpan({ text: ' 权限。' });
  });
}

export {
  renderFeishuSettingsTab,
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: resume typed linting after Feishu settings Obsidian UI boundary */
