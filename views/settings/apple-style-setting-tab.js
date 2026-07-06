// views/settings/apple-style-setting-tab.js
//
// AppleStyleSettingTab (plugin settings panel), extracted from input.js
// (Phase 4). Behavior-preserving move; dependencies imported from the
// service/view modules they were extracted into.

import {
  obsidianApi,
  createObsidianModal,
  getObsidianRequestUrl,
  getObsidianRequest,
  refreshSettingTabCompat,
  setDestructiveButtonCompat,
  getActiveDocumentCompat,
} from '../../services/obsidian-adapters.js';
import { normalizeVaultPath, isAbsolutePathLike } from '../../services/path-utils.js';
import { toReadableError, generateId } from '../../services/input-utils.js';
import {
  MAX_ACCOUNTS,
  MULTI_PLATFORM_TAB_LABEL,
  getWechatAccountPublishOptions,
  normalizeWechatAccountPublishOptions,
} from '../../services/settings-defaults.js';
import { WechatAPI } from '../../services/wechat-api.js';
import { createObsidianFetchAdapter } from '../../services/obsidian-fetch-adapter.js';
import { renderFeishuSettingsTab } from './feishu-tab.js';
import { renderMultiPlatformSettingsTab } from './multi-platform-tab.js';
import {
  AI_LAYOUT_SELECTION_AUTO,
  AI_PROVIDER_KINDS,
  normalizeAiProvider,
  getAiProviderIssues,
  isAiProviderRunnable,
  summarizeAiProviderIssues,
  getLayoutFamilyList,
  getColorPaletteList,
  normalizeArticleLayoutCacheEntry,
  testAiProviderConnection,
} from '../../services/ai-layout.js';

const { PluginSettingTab, Setting, Notice } = obsidianApi;
const LEGACY_SETTING_RENDER_KEY = ['dis', 'play'].join('');

/**
 * 📝 Obsidian 发布助手设置面板
 */
export class AppleStyleSettingTab extends PluginSettingTab {
  /**
   * @param {any} app
   * @param {any} plugin
   */
  constructor(app, plugin) {
    super(app, plugin);
    /** @type {any} */
    this.plugin = plugin;
  }

  /**
   * @param {string} vaultPath
   * @returns {string}
   */
  normalizeVaultPath(vaultPath) {
    return normalizeVaultPath(vaultPath);
  }

  /**
   * @param {string} vaultPath
   * @returns {boolean}
   */
  isAbsolutePathLike(vaultPath) {
    return isAbsolutePathLike(vaultPath);
  }

  refreshOpenConverterAiState() {
    const view = /** @type {any} */ (this.plugin.getConverterView?.() || null);
    if (view && typeof view.updateAiToolbarState === 'function') {
      view.updateAiToolbarState();
    }
    if (view && typeof view.refreshAiLayoutPanel === 'function') {
      view.refreshAiLayoutPanel();
    }
  }

  /**
   * @param {{ title?: string, message?: string, confirmText?: string, cancelText?: string }} options
   * @returns {Promise<boolean>}
   */
  confirmDestructiveAction({ title, message, confirmText = '确认', cancelText = '取消' }) {
    return new Promise((resolve) => {
      const modal = createObsidianModal(this.app);
      let settled = false;
      /** @param {boolean} value */
      const settle = (value) => {
        if (settled) return;
        settled = true;
        modal.close();
        resolve(value);
      };

      modal.titleEl.setText(title || '确认操作');
      const body = modal.contentEl.createDiv({ cls: 'wechat-confirm-modal' });
      body.createEl('p', { text: message || '确定要继续吗？' });
      const actions = modal.contentEl.createDiv({ cls: 'wechat-modal-buttons' });
      actions.createEl('button', { text: cancelText }).onclick = () => settle(false);
      const confirmBtn = actions.createEl('button', { text: confirmText, cls: 'mod-warning' });
      confirmBtn.onclick = () => settle(true);
      const originalOnClose = typeof modal.onClose === 'function'
        ? /** @type {() => void} */ (modal.onClose.bind(modal))
        : null;
      modal.onClose = () => {
        if (originalOnClose) originalOnClose();
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };
      modal.open();
    });
  }

  /** @returns {any[]} */
  getSettingDefinitions() {
    return [{
      name: 'Wechat Converter',
      desc: '微信发布助手设置',
      searchable: false,
      render: () => {
        this.renderSettingsContent();
      },
    }];
  }

  /**
   * @param {any} containerEl
   * @param {string} description
   */
  renderSettingsTabIntro(containerEl, description) {
    const intro = containerEl.createDiv({ cls: 'apple-settings-tab-intro' });
    intro.createEl('p', { text: description, cls: 'apple-settings-tab-intro-desc' });
  }

  renderSettingsContent() {
    const { containerEl } = this;
    containerEl.empty();

    // === Tab 导航 ===
    const tabBar = containerEl.createDiv({ cls: 'apple-settings-tabs' });
    const wechatTab = tabBar.createDiv({ cls: 'apple-settings-tab active', text: '微信' });
    const feishuTab = tabBar.createDiv({ cls: 'apple-settings-tab', text: '飞书' });
    const multiTab = tabBar.createDiv({ cls: 'apple-settings-tab apple-settings-tab-multi' });
    multiTab.createSpan({ text: MULTI_PLATFORM_TAB_LABEL, cls: 'apple-settings-tab-label' });

    const wechatContent = containerEl.createDiv({ cls: 'apple-settings-tab-content' });
    const feishuContent = containerEl.createDiv({ cls: 'apple-settings-tab-content' });
    feishuContent.setCssStyles({ display: 'none' });
    const multiContent = containerEl.createDiv({ cls: 'apple-settings-tab-content' });
    multiContent.setCssStyles({ display: 'none' });

    wechatTab.onclick = () => {
      this._activeSettingsTab = 'wechat';
      wechatTab.addClass('active');
      feishuTab.removeClass('active');
      multiTab.removeClass('active');
      wechatContent.setCssStyles({ display: '' });
      feishuContent.setCssStyles({ display: 'none' });
      multiContent.setCssStyles({ display: 'none' });
    };
    feishuTab.onclick = () => {
      this._activeSettingsTab = 'feishu';
      feishuTab.addClass('active');
      wechatTab.removeClass('active');
      multiTab.removeClass('active');
      wechatContent.setCssStyles({ display: 'none' });
      feishuContent.setCssStyles({ display: '' });
      multiContent.setCssStyles({ display: 'none' });
      renderFeishuSettingsTab(this, feishuContent, { obsidianApi });
    };
    multiTab.onclick = () => {
      this._activeSettingsTab = 'multi';
      multiTab.addClass('active');
      wechatTab.removeClass('active');
      feishuTab.removeClass('active');
      wechatContent.setCssStyles({ display: 'none' });
      feishuContent.setCssStyles({ display: 'none' });
      multiContent.setCssStyles({ display: '' });
    };

    // 恢复上次激活的 Tab
    if (this._activeSettingsTab === 'feishu') {
      feishuTab.onclick();
    } else if (this._activeSettingsTab === 'multi') {
      multiTab.onclick();
    }

    // === 微信 Tab ===
    {
      const containerEl = wechatContent;

    this.renderSettingsTabIntro(
      containerEl,
      '配置公众号账号、封面摘要和微信预览相关选项。'
    );

    // 预览模式设置
    new Setting(containerEl)
      .setName('预览模式')
      .setHeading();

    new Setting(containerEl)
      .setName('使用手机仿真框')
      .setDesc('开启后，预览区域将显示为 iPhone X 手机框样式；关闭则恢复为经典全宽预览模式（需重启插件面板生效）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.usePhoneFrame)
        .onChange(async (value) => {
          this.plugin.settings.usePhoneFrame = value;
          await this.plugin.saveSettings();
          new Notice('设置已保存，请关闭并重新打开发布助手面板以生效');
        }));

    // 图片水印设置
    new Setting(containerEl)
      .setName('图片水印')
      .setHeading();

    new Setting(containerEl)
      .setName('启用图片水印')
      .setDesc('在每张图片上方显示头像（需重启插件面板生效）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableWatermark)
        .onChange(async (value) => {
          this.plugin.settings.enableWatermark = value;
          await this.plugin.saveSettings();
          new Notice('设置已保存，请关闭并重新打开发布助手面板以生效');
        }));

    // 本地头像上传
    const uploadSetting = new Setting(containerEl)
      .setName('上传本地头像')
      .setDesc(this.plugin.settings.avatarBase64 ? '✅ 已上传本地头像（优先使用）' : '选择本地图片，转换为 Base64 存储，无需网络请求');

    uploadSetting.addButton(button => button
      .setButtonText(this.plugin.settings.avatarBase64 ? '重新上传' : '选择图片')
      .onClick(() => {
        const activeDocument = getActiveDocumentCompat();
        if (!activeDocument) return;
        const input = activeDocument.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const target = e.target instanceof HTMLInputElement ? e.target : null;
          const file = target?.files?.[0] || null;
          if (!file) return;

          if (file.size > 100 * 1024) {
            new Notice('❌ 图片太大，请选择小于 100KB 的图片');
            return;
          }

          const reader = new FileReader();
          reader.onload = async (event) => {
            const result = event.target?.result;
            this.plugin.settings.avatarBase64 = typeof result === 'string' ? result : '';
            await this.plugin.saveSettings();
            new Notice('✅ 头像已上传');
            refreshSettingTabCompat(this);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      }));

    if (this.plugin.settings.avatarBase64) {
      uploadSetting.addButton((button) => {
        const clearButton = setDestructiveButtonCompat(button.setButtonText('清除'));
        clearButton.onClick(async () => {
            this.plugin.settings.avatarBase64 = '';
            await this.plugin.saveSettings();
            new Notice('已清除本地头像');
            refreshSettingTabCompat(this);
          });
      });
    }

    new Setting(containerEl)
      .setName('头像 URL（备用）')
      .setDesc('如未上传本地头像，将使用此 URL')
      .addText(text => text
        .setPlaceholder('https://example.com/avatar.jpg')
        .setValue(this.plugin.settings.avatarUrl)
        .onChange(async (value) => {
          this.plugin.settings.avatarUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('微信公众号账号')
      .setDesc('请在微信公众号后台 [设置与开发] -> [基本配置] 中获取 AppID 和 AppSecret，并确保已将当前 IP 加入白名单。')
      .setHeading();

    // 账号列表
    const accounts = this.plugin.settings.wechatAccounts || [];
    const defaultId = this.plugin.settings.defaultAccountId;

    if (accounts.length === 0) {
      containerEl.createEl('p', {
        text: '暂无账号，请点击下方按钮添加',
        cls: 'setting-item-description',
        attr: { style: 'color: var(--text-muted); font-style: italic;' }
      });
    } else {
      const listContainer = containerEl.createDiv({ cls: 'wechat-account-list' });

      for (const account of accounts) {
        const isDefault = account.id === defaultId;
        const card = listContainer.createDiv({ cls: 'wechat-account-card' });

        // 账号信息
        const info = card.createDiv({ cls: 'wechat-account-info' });
        const nameRow = info.createDiv({ cls: 'wechat-account-name-row' });
        nameRow.createSpan({ text: account.name, cls: 'wechat-account-name' });
        if (isDefault) {
          nameRow.createSpan({ text: '默认', cls: 'wechat-account-badge' });
        }
        info.createDiv({
          text: `AppID: ${account.appId.substring(0, 8)}...`,
          cls: 'wechat-account-appid'
        });

        // 操作按钮
        const actions = card.createDiv({ cls: 'wechat-account-actions' });

        if (!isDefault) {
          const defaultBtn = actions.createEl('button', { text: '设为默认', cls: 'wechat-btn-small' });
          defaultBtn.onclick = async () => {
            this.plugin.settings.defaultAccountId = account.id;
            await this.plugin.saveSettings();
            refreshSettingTabCompat(this);
          };
        }

        const editBtn = actions.createEl('button', { text: '编辑', cls: 'wechat-btn-small' });
        editBtn.onclick = () => this.showEditAccountModal(account);

        const testBtn = actions.createEl('button', { text: '测试', cls: 'wechat-btn-small wechat-btn-test' });
        testBtn.onclick = async () => {
          testBtn.disabled = true;
          testBtn.textContent = '测试中...';
          try {
            const api = new WechatAPI(account.appId, account.appSecret, this.plugin.settings.proxyUrl, this.plugin.settings.clientId);
            await api.getAccessToken();
            new Notice(`✅ ${account.name} 连接成功！`);
          } catch (err) {
            new Notice(`❌ ${account.name} 连接失败: ${toReadableError(err).message}`);
          }
          testBtn.disabled = false;
          testBtn.textContent = '测试';
        };

        const deleteBtn = actions.createEl('button', { text: '删除', cls: 'wechat-btn-small wechat-btn-danger' });
        deleteBtn.onclick = async () => {
          const confirmed = await this.confirmDestructiveAction({
            title: '删除公众号账号',
            message: `确定要删除账号 "${account.name}" 吗？`,
            confirmText: '删除',
          });
          if (!confirmed) return;
          this.plugin.settings.wechatAccounts = accounts.filter(a => a.id !== account.id);
          // 如果删除的是默认账号，自动选择第一个
          if (account.id === defaultId && this.plugin.settings.wechatAccounts.length > 0) {
            this.plugin.settings.defaultAccountId = this.plugin.settings.wechatAccounts[0].id;
          } else if (this.plugin.settings.wechatAccounts.length === 0) {
            this.plugin.settings.defaultAccountId = '';
          }
          await this.plugin.saveSettings();
          refreshSettingTabCompat(this);
        };
      }
    }

    // 添加账号按钮
    const addBtnContainer = containerEl.createDiv({ cls: 'wechat-add-account-container' });
    if (accounts.length < MAX_ACCOUNTS) {
      const addBtn = addBtnContainer.createEl('button', {
        text: '+ 添加账号',
        cls: 'wechat-btn-add'
      });
      addBtn.onclick = () => this.showEditAccountModal(null);
    } else {
      addBtnContainer.createEl('p', {
        text: `已达到最大账号数量 (${MAX_ACCOUNTS})`,
        cls: 'setting-item-description',
        attr: { style: 'color: var(--text-muted);' }
      });
    }

    this.renderAiSettingsSection(containerEl);

    this.renderTitlePolishSection(containerEl);

    // 高级设置
    new Setting(containerEl)
      .setName('高级设置')
      .setHeading();

    let hasWarnedInsecureProxy = false;
    new Setting(containerEl)
      .setName('API 代理地址')
      .setDesc('如果您的网络 IP 经常变化（如多地办公或使用移动热点），可配置代理服务以解决微信 IP 白名单漂移导致的同步失败问题。')
      .addText(text => {
        text
          .setPlaceholder('https://your-proxy.workers.dev')
          .setValue(this.plugin.settings.proxyUrl || '')
          .onChange(async (value) => {
            const trimmedValue = value.trim();
            if (trimmedValue && !trimmedValue.toLowerCase().startsWith('https://')) {
              if (!hasWarnedInsecureProxy) {
                new Notice('⚠️ 安全风险：代理地址必须使用 HTTPS 以保护您的 AppSecret。');
                hasWarnedInsecureProxy = true;
              }
            } else {
              hasWarnedInsecureProxy = false;
            }
            this.plugin.settings.proxyUrl = trimmedValue;
            await this.plugin.saveSettings();
          });
        // 拓宽输入框宽度以完美容纳带 Token 的长 URL，并作安全判定兼容 Mock 环境
        if (text.inputEl && typeof text.inputEl.setAttribute === 'function') {
          text.inputEl.setCssStyles?.({ width: '320px', maxWidth: '100%' });
        }
      });

    // 独立于 Setting 结构之外的说明卡片，自动独占一行并横跨 100% 宽度
    const card = containerEl.createDiv({
      cls: 'wechat-proxy-info-card',
      attr: {
        style: 'margin-top: 8px; margin-bottom: 16px; padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background-color: var(--background-primary-alt); font-size: 12px; line-height: 1.6; display: flex; flex-direction: column; gap: 8px;'
      }
    });

    // 1. 官方免自建服务行
    const officialRow = card.createDiv({ attr: { style: 'display: flex; gap: 6px; align-items: flex-start;' } });
    officialRow.createSpan({ text: '💡', attr: { style: 'flex-shrink: 0; line-height: 1.6;' } });
    const officialText = officialRow.createDiv();
    officialText.createEl('strong', {
      text: '官方中转',
      attr: { style: 'color: var(--text-normal); font-weight: 600;' }
    });
    officialText.createSpan({
      text: '：已上线稳定中转代理，彻底解决微信 IP 白名单频繁漂移问题。',
      attr: { style: 'color: var(--text-muted);' }
    });
    officialText.createEl('a', {
      text: '获取官方中转 Token ➔',
      href: 'https://xiaoweibox.top/chats/wechat-proxy-service',
      attr: { style: 'margin-left: 6px; color: var(--text-muted); text-decoration: underline;' }
    });

    // 2. 自建指南行
    const selfHostedRow = card.createDiv({ attr: { style: 'display: flex; gap: 6px; align-items: flex-start;' } });
    selfHostedRow.createSpan({ text: '🛠️', attr: { style: 'flex-shrink: 0; line-height: 1.6;' } });
    const selfHostedText = selfHostedRow.createDiv();
    selfHostedText.createEl('strong', {
      text: '手工自建',
      attr: { style: 'color: var(--text-normal); font-weight: 600;' }
    });
    selfHostedText.createSpan({
      text: '：如果您想拥有完全自主的控制权，也可以基于 Cloudflare Worker 或个人 VPS 自建。',
      attr: { style: 'color: var(--text-muted);' }
    });
    selfHostedText.createEl('a', {
      text: '查看自建部署指南 ➔',
      href: 'https://xiaoweibox.top/chats/wechat-proxy',
      attr: { style: 'margin-left: 6px; color: var(--text-muted); text-decoration: underline;' }
    });

    // 3. 安全与隐私提示
    const securityRow = card.createDiv({ attr: { style: 'display: flex; gap: 6px; align-items: flex-start;' } });
    securityRow.createSpan({ text: '🔒', attr: { style: 'flex-shrink: 0; line-height: 1.6;' } });
    const securityText = securityRow.createDiv();
    securityText.createEl('strong', {
      text: '安全声明',
      attr: { style: 'color: var(--text-warning); font-weight: 600;' }
    });
    securityText.createSpan({
      text: '：代理服务将中转您的请求。请确保使用受信任的代理（自建或官方），以保护 AppSecret 安全。中转服务仅在内存中转发，不存储您的任何敏感凭证。',
      attr: { style: 'color: var(--text-muted);' }
    });

    }

    // === 其他平台 Tab ===
    renderMultiPlatformSettingsTab(this, multiContent, { obsidianApi });
  }

  /**
   * @param {any} containerEl
   */
  renderAiSettingsSection(containerEl) {
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('配置 LLM Provider（当前 DeepSeek）。「AI 编排」与「标题 AI 润色」都复用这里选中的默认 Provider 的凭证；各自的开关与模型质量在各自区块里设置。')
      .setHeading();

    /** @type {any[]} */
    const providers = this.plugin.settings.ai.providers || [];
    const defaultProviderId = this.plugin.settings.ai.defaultProviderId;
    const runnableProviders = providers.filter((provider) => isAiProviderRunnable(provider) && provider.enabled !== false);

    new Setting(containerEl)
      .setName('默认 AI Provider')
      .setDesc(runnableProviders.length > 0
        ? '生成 AI 编排时会优先使用这里选中的 Provider。'
        : '还没有可直接用于 AI 编排的 Provider，请先补全 Base URL、API Key 和模型。')
      .addDropdown((dropdown) => {
        dropdown.addOption('', '自动选择');
        providers.forEach((provider) => {
          const statusText = summarizeAiProviderIssues(provider);
          dropdown.addOption(provider.id, `${provider.name} (${statusText})`);
        });
        dropdown.setValue(defaultProviderId || '');
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.defaultProviderId = value;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        });
      });

    if (providers.length === 0) {
      containerEl.createEl('p', {
        text: '暂无 AI Provider，请点击下方按钮添加',
        cls: 'setting-item-description',
        attr: { style: 'color: var(--text-muted); font-style: italic;' }
      });
    } else {
      const providerList = containerEl.createDiv({ cls: 'wechat-account-list' });
      for (const provider of providers) {
        const isDefault = provider.id === defaultProviderId;
        const providerIssues = getAiProviderIssues(provider);
        const isRunnable = isAiProviderRunnable(provider) && provider.enabled !== false;
        const providerCard = providerList.createDiv({ cls: 'wechat-account-card' });
        const info = providerCard.createDiv({ cls: 'wechat-account-info' });
        const nameRow = info.createDiv({ cls: 'wechat-account-name-row' });
        nameRow.createEl('span', { text: provider.name, cls: 'wechat-account-name' });
        if (isDefault) {
          nameRow.createEl('span', { text: '默认', cls: 'wechat-account-badge' });
        }
        if (provider.enabled === false) {
          nameRow.createEl('span', { text: '已停用', cls: 'wechat-account-badge', attr: { style: 'background: var(--text-faint);' } });
        } else if (isRunnable) {
          nameRow.createEl('span', { text: '可用', cls: 'wechat-account-badge', attr: { style: 'background: #0f8f64;' } });
        } else {
          nameRow.createEl('span', { text: '待补全', cls: 'wechat-account-badge', attr: { style: 'background: #d97706;' } });
        }
        info.createDiv({
          text: `${provider.kind} · ${provider.model || '未设置模型'}`,
          cls: 'wechat-account-appid'
        });
        info.createDiv({
          text: summarizeAiProviderIssues(provider),
          cls: 'wechat-account-appid'
        });

        const actions = providerCard.createDiv({ cls: 'wechat-account-actions' });
        if (!isDefault) {
          const defaultBtn = actions.createEl('button', { text: '设为默认', cls: 'wechat-btn-small' });
          defaultBtn.onclick = async () => {
            this.plugin.settings.ai.defaultProviderId = provider.id;
            await this.plugin.saveSettings();
            this.refreshOpenConverterAiState();
            refreshSettingTabCompat(this);
          };
        }

        const editBtn = actions.createEl('button', { text: '编辑', cls: 'wechat-btn-small' });
        editBtn.onclick = () => this.showEditAiProviderModal(provider);

        const testBtn = actions.createEl('button', { text: '测试', cls: 'wechat-btn-small wechat-btn-test' });
        if (!isRunnable) {
          testBtn.disabled = true;
          testBtn.title = providerIssues.includes('disabled')
            ? '请先启用该 Provider'
            : `当前无法测试：${summarizeAiProviderIssues(provider)}`;
        }
        testBtn.onclick = async () => {
          if (!isRunnable) return;
          testBtn.disabled = true;
          testBtn.textContent = '测试中...';
          try {
            await testAiProviderConnection(provider, createObsidianFetchAdapter({ requestUrl: getObsidianRequestUrl(), request: getObsidianRequest() }));
            new Notice(`✅ ${provider.name} 连接成功！`);
          } catch (error) {
            new Notice(`❌ ${provider.name} 连接失败: ${toReadableError(error).message}`);
          }
          testBtn.disabled = false;
          testBtn.textContent = '测试';
        };

        const deleteBtn = actions.createEl('button', { text: '删除', cls: 'wechat-btn-small wechat-btn-danger' });
        deleteBtn.onclick = async () => {
          const confirmed = await this.confirmDestructiveAction({
            title: '删除 AI Provider',
            message: `确定要删除 AI Provider "${provider.name}" 吗？`,
            confirmText: '删除',
          });
          if (!confirmed) return;
          this.plugin.settings.ai.providers = providers.filter((item) => item.id !== provider.id);
          if (provider.id === defaultProviderId) {
            const nextRunnableProvider = this.plugin.settings.ai.providers.find((item) => item.enabled !== false && isAiProviderRunnable(item));
            this.plugin.settings.ai.defaultProviderId = nextRunnableProvider?.id || '';
          }
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
          refreshSettingTabCompat(this);
        };
      }
    }

    const addProviderContainer = containerEl.createDiv({ cls: 'wechat-add-account-container' });
    const addProviderBtn = addProviderContainer.createEl('button', {
      text: '+ 添加 AI Provider',
      cls: 'wechat-btn-add'
    });
    addProviderBtn.onclick = () => this.showEditAiProviderModal(null);

    // 折叠区「AI 编排」：该能力的全部设置（开关/模型质量/布局/颜色/进阶项）
    const advancedOptions = containerEl.createEl('details', { cls: 'apple-settings-details' });
    advancedOptions.createEl('summary', {
      cls: 'apple-settings-summary',
      text: 'AI 编排'
    });
    const advancedArea = advancedOptions.createDiv({ cls: 'apple-settings-area apple-settings-advanced-area' });

    new Setting(advancedArea)
      .setName('启用 AI 编排')
      .setDesc('关闭后会隐藏右侧工具栏中的 AI 编排入口，但不会删除已生成的缓存结果。')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ai.enabled === true)
        .onChange(async (value) => {
          this.plugin.settings.ai.enabled = value;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        }));

    new Setting(advancedArea)
      .setName('模型质量')
      .setDesc('AI 编排使用的模型质量，复用上方「默认 AI Provider」的凭证。')
      .addDropdown((dropdown) => {
        dropdown.addOption('deepseek-v4-pro', 'DeepSeek V4 Pro（质量优先）');
        dropdown.addOption('deepseek-v4-flash', 'DeepSeek V4 Lite（快/省）');
        dropdown.setValue(this.plugin.settings.ai.layoutModel || 'deepseek-v4-pro');
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.layoutModel = value;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        });
      });

    const layoutFamilyOptions = getLayoutFamilyList({ includeAuto: true, includeReserved: false });
    new Setting(advancedArea)
      .setName('默认布局')
      .setDesc('打开 AI 编排面板时默认选中的布局。保持“自动推荐”时，AI 会根据文章内容推荐布局风格。')
      .addDropdown((dropdown) => {
        layoutFamilyOptions.forEach((option) => dropdown.addOption(option.value, option.label));
        dropdown.setValue(this.plugin.settings.ai.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO);
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.defaultLayoutFamily = value;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        });
      });

    const colorPaletteOptions = getColorPaletteList({ includeAuto: true });
    new Setting(advancedArea)
      .setName('默认颜色')
      .setDesc('打开 AI 编排面板时默认选中的颜色。保持“自动推荐”时，AI 会推荐一个配色；生成后也可手动切换。')
      .addDropdown((dropdown) => {
        colorPaletteOptions.forEach((option) => dropdown.addOption(option.value, option.label));
        dropdown.setValue(this.plugin.settings.ai.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO);
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.defaultColorPalette = value;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        });
      });

    new Setting(advancedArea)
      .setName('编排时参考图片')
      .setDesc('开启后，AI 会把文中的配图和截图作为排版素材参考，但不会直接改写你的正文。')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ai.includeImagesInLayout !== false)
        .onChange(async (value) => {
          this.plugin.settings.ai.includeImagesInLayout = value;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        }));

    new Setting(advancedArea)
      .setName('AI 请求超时（秒）')
      .setDesc('默认 120 秒；较快模型可设 15 到 45 秒，较慢或本地模型建议保持 60 到 120 秒。')
      .addText(text => text
        .setPlaceholder('120')
        .setValue(String(Math.round((this.plugin.settings.ai.requestTimeoutMs || 120000) / 1000)))
        .onChange(async (value) => {
          const seconds = Math.min(180, Math.max(5, parseInt(value || '120', 10) || 120));
          this.plugin.settings.ai.requestTimeoutMs = seconds * 1000;
          await this.plugin.saveSettings();
          this.refreshOpenConverterAiState();
        }));

    const layoutCacheEntries = Object.values(this.plugin.settings.ai.articleLayoutsByPath || {});
    const cachedDocCount = layoutCacheEntries.length;
    const cachedLayoutCount = layoutCacheEntries.reduce((count, entry) => {
      const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
      if (!normalizedEntry) return count;
      return count + Object.keys(normalizedEntry.familyStates || {}).length;
    }, 0);
    const cacheSetting = new Setting(advancedArea)
      .setName('AI 编排缓存')
      .setDesc(cachedLayoutCount > 0
        ? `当前已缓存 ${cachedDocCount} 篇文章、共 ${cachedLayoutCount} 份编排风格结果。`
        : '当前还没有缓存的 AI 编排结果。');

    if (cachedLayoutCount > 0) {
      cacheSetting.addButton((button) => {
        const clearCacheButton = setDestructiveButtonCompat(button.setButtonText('清空缓存'));
        clearCacheButton.onClick(async () => {
            const confirmed = await this.confirmDestructiveAction({
              title: '清空 AI 编排缓存',
              message: `确定要清空 ${cachedDocCount} 篇文章、共 ${cachedLayoutCount} 份 AI 编排缓存吗？`,
              confirmText: '清空',
            });
            if (!confirmed) return;
            this.plugin.settings.ai.articleLayoutsByPath = {};
            await this.plugin.saveSettings();
            this.refreshOpenConverterAiState();
            new Notice('已清空 AI 编排缓存');
            refreshSettingTabCompat(this);
          });
      });
    }
  }

  /**
   * 标题 AI 润色设置。
   * 复用上方「默认 AI Provider」的 API Key / Base URL（DeepSeek），这里只单独选模型。
   * @param {any} containerEl
   */
  renderTitlePolishSection(containerEl) {
    const providers = this.plugin.settings.ai?.providers || [];
    const defaultProviderId = this.plugin.settings.ai?.defaultProviderId;
    const provider = providers.find((p) => p.id === defaultProviderId);

    // 折叠区「标题 AI 润色」：该能力的全部设置（开关 + 模型质量）
    const details = containerEl.createEl('details', { cls: 'apple-settings-details' });
    details.createEl('summary', {
      cls: 'apple-settings-summary',
      text: '标题 AI 润色'
    });
    const area = details.createDiv({ cls: 'apple-settings-area apple-settings-advanced-area' });

    new Setting(area)
      .setName('启用标题 AI 润色')
      .setDesc('开启后，在「发布与分发」的文章标题旁显示「AI 润色标题」按钮，一键让 LLM 根据正文优化标题（给 5 个候选）。')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.titlePolishEnabled !== false)
        .onChange(async (value) => {
          this.plugin.settings.titlePolishEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(area)
      .setName('模型质量')
      .setDesc(provider
        ? `使用 Provider「${provider.name}」的凭证；当前 DeepSeek 可选 V4 Pro / V4 Lite。`
        : '尚未配置默认 AI Provider。请先在上方「AI Provider」里添加并选中一个 Provider（DeepSeek），标题润色才能用。')
      .addDropdown((dropdown) => {
        dropdown.addOption('deepseek-v4-pro', 'DeepSeek V4 Pro（质量优先）');
        dropdown.addOption('deepseek-v4-flash', 'DeepSeek V4 Lite（快/省）');
        dropdown.setValue(this.plugin.settings.titlePolishModel || 'deepseek-v4-pro');
        dropdown.onChange(async (value) => {
          this.plugin.settings.titlePolishModel = value;
          await this.plugin.saveSettings();
        });
      });
  }

  /**
   * 显示添加/编辑账号的模态框
   */
  /**
   * @param {any} provider
   */
  showEditAiProviderModal(provider) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText(provider ? '编辑 AI Provider' : '添加 AI Provider');

    const form = modal.contentEl.createDiv();

    const nameGroup = form.createDiv({ cls: 'wechat-form-group' });
    nameGroup.createEl('label', { text: '名称' });
    const nameInput = /** @type {any} */ (nameGroup.createEl('input', {
      type: 'text',
      placeholder: '例如：OpenAI / OpenRouter / 自建网关',
      value: provider?.name || ''
    }));

    const kindGroup = form.createDiv({ cls: 'wechat-form-group' });
    kindGroup.createEl('label', { text: '类型' });
    const kindSelectWrap = kindGroup.createDiv({ cls: 'wechat-form-select-wrap' });
    const kindSelect = /** @type {any} */ (kindSelectWrap.createEl('select', { cls: 'wechat-form-select' }));
    const providerKinds = [
      { value: AI_PROVIDER_KINDS.OPENAI_COMPATIBLE, label: 'OpenAI 兼容接口' },
      { value: AI_PROVIDER_KINDS.GEMINI, label: 'Gemini 兼容格式' },
      { value: AI_PROVIDER_KINDS.ANTHROPIC, label: 'Anthropic 兼容格式' },
    ];
    providerKinds.forEach((kind) => {
      const option = /** @type {any} */ (kindSelect.createEl('option', { value: kind.value, text: kind.label }));
      if ((provider?.kind || AI_PROVIDER_KINDS.OPENAI_COMPATIBLE) === kind.value) {
        option.selected = true;
      }
    });

    const baseUrlGroup = form.createDiv({ cls: 'wechat-form-group' });
    baseUrlGroup.createEl('label', { text: 'Base URL' });
    const baseUrlInput = /** @type {any} */ (baseUrlGroup.createEl('input', {
      type: 'text',
      placeholder: 'https://api.openai.com/v1 或 http://localhost:11434/v1',
      value: provider?.baseUrl || 'https://api.deepseek.com/v1'
    }));

    const apiKeyGroup = form.createDiv({ cls: 'wechat-form-group' });
    apiKeyGroup.createEl('label', { text: 'API Key' });
    const apiKeyInput = /** @type {any} */ (apiKeyGroup.createEl('input', {
      type: 'password',
      placeholder: 'sk-...',
      value: provider?.apiKey || ''
    }));

    // 模型：Provider 层只标明模型家族「DeepSeek V4」一项；具体 Pro/Lite 质量
    // 由各消费方（标题润色 / AI 编排）在各自设置里选，故这里不放质量选项。
    const modelGroup = form.createDiv({ cls: 'wechat-form-group' });
    modelGroup.createEl('label', { text: '模型' });
    const modelSelectWrap = modelGroup.createDiv({ cls: 'wechat-form-select-wrap' });
    const modelSelect = /** @type {any} */ (modelSelectWrap.createEl('select', { cls: 'wechat-form-select' }));
    // value 用真实模型作默认/兜底（测试连接、消费方未覆盖时可用），label 只显示家族名
    const opt = /** @type {any} */ (modelSelect.createEl('option', { value: 'deepseek-v4-pro', text: 'DeepSeek V4' }));
    opt.selected = true;

    const applyKindDefaults = () => {
      const kind = kindSelect.value || AI_PROVIDER_KINDS.OPENAI_COMPATIBLE;
      if (kind === AI_PROVIDER_KINDS.GEMINI) {
        baseUrlInput.placeholder = 'https://generativelanguage.googleapis.com/v1beta';
        if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
          baseUrlInput.value = 'https://generativelanguage.googleapis.com/v1beta';
        }
        return;
      }
      if (kind === AI_PROVIDER_KINDS.ANTHROPIC) {
        baseUrlInput.placeholder = 'https://api.anthropic.com/v1';
        if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
          baseUrlInput.value = 'https://api.anthropic.com/v1';
        }
        return;
      }
      // OpenAI 兼容（DeepSeek 走这条）：默认指向 DeepSeek
      baseUrlInput.placeholder = 'https://api.deepseek.com/v1 或 http://localhost:11434/v1';
      if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
        baseUrlInput.value = 'https://api.deepseek.com/v1';
      }
    };
    kindSelect.addEventListener('change', applyKindDefaults);
    applyKindDefaults();

    const enabledGroup = form.createDiv({ cls: 'wechat-form-group' });
    enabledGroup.createEl('label', { text: '启用' });
    const enabledWrap = enabledGroup.createDiv({ cls: 'wechat-provider-enabled' });
    const enabledToggle = /** @type {any} */ (enabledWrap.createEl('label', { cls: 'apple-toggle' }).createEl('input', {
      type: 'checkbox',
      cls: 'apple-toggle-input',
      checked: provider?.enabled !== false ? true : undefined,
    }));
    enabledToggle.checked = provider?.enabled !== false;
    enabledToggle.parentElement.createEl('span', { cls: 'apple-toggle-slider' });
    enabledWrap.createEl('span', {
      cls: 'wechat-provider-enabled-text',
      text: '保存后可用于 AI 编排和连接测试',
    });

    const btnRow = form.createDiv({ cls: 'wechat-modal-buttons' });
    const cancelBtn = btnRow.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const testBtn = btnRow.createEl('button', { text: '测试连接', cls: 'wechat-btn-test' });
    testBtn.onclick = async () => {
      const candidate = normalizeAiProvider({
        id: provider?.id,
        name: nameInput.value.trim() || '未命名 Provider',
        kind: kindSelect.value,
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelSelect.value,
        enabled: enabledToggle.checked,
      });
      const issueSummary = summarizeAiProviderIssues(candidate);
      if (!isAiProviderRunnable(candidate)) {
        new Notice(`请先补全 Provider 配置：${issueSummary}`);
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = '测试中...';
      try {
        await testAiProviderConnection(candidate, createObsidianFetchAdapter({ requestUrl: getObsidianRequestUrl(), request: getObsidianRequest() }));
        new Notice('✅ AI Provider 连接成功！');
      } catch (error) {
        new Notice(`❌ 连接失败: ${toReadableError(error).message}`);
      }
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    };

    const saveBtn = btnRow.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      const nextProvider = normalizeAiProvider({
        id: provider?.id,
        name: nameInput.value.trim() || '未命名 Provider',
        kind: kindSelect.value,
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelSelect.value,
        enabled: enabledToggle.checked,
      });

      const issues = getAiProviderIssues(nextProvider).filter((issue) => issue !== 'disabled');
      if (issues.length > 0) {
        new Notice(`请补全 Provider 配置：${summarizeAiProviderIssues(nextProvider)}`);
        return;
      }

      const providers = this.plugin.settings.ai.providers || [];
      if (provider) {
        this.plugin.settings.ai.providers = providers.map((item) => item.id === provider.id ? nextProvider : item);
      } else {
        this.plugin.settings.ai.providers.push(nextProvider);
        if (!this.plugin.settings.ai.defaultProviderId) {
          this.plugin.settings.ai.defaultProviderId = nextProvider.id;
        }
      }

      if (!this.plugin.settings.ai.defaultProviderId && nextProvider.enabled !== false && isAiProviderRunnable(nextProvider)) {
        this.plugin.settings.ai.defaultProviderId = nextProvider.id;
      }

      await this.plugin.saveSettings();
      this.refreshOpenConverterAiState();
      modal.close();
      refreshSettingTabCompat(this);
      new Notice(provider ? '✅ AI Provider 已更新' : '✅ AI Provider 已添加');
    };

    modal.open();
  }

  /**
   * 显示添加/编辑账号的模态框
   */
  /**
   * @param {any} account
   */
  showEditAccountModal(account) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText(account ? '编辑账号' : '添加账号');

    const form = modal.contentEl.createDiv();
    const publishDefaults = getWechatAccountPublishOptions(account);

    // 账号名称
    const nameGroup = form.createDiv({ cls: 'wechat-form-group' });
    nameGroup.createEl('label', { text: '账号名称' });
    const nameInput = /** @type {any} */ (nameGroup.createEl('input', {
      type: 'text',
      placeholder: '例如：我的公众号',
      value: account?.name || ''
    }));

    // AppID
    const appIdGroup = form.createDiv({ cls: 'wechat-form-group' });
    appIdGroup.createEl('label', { text: 'AppID' });
    const appIdInput = /** @type {any} */ (appIdGroup.createEl('input', {
      type: 'text',
      placeholder: 'wx...',
      value: account?.appId || ''
    }));

    // AppSecret
    const secretGroup = form.createDiv({ cls: 'wechat-form-group' });
    secretGroup.createEl('label', { text: 'AppSecret' });
    const secretInput = /** @type {any} */ (secretGroup.createEl('input', {
      type: 'password',
      placeholder: '开发者密钥',
      value: account?.appSecret || ''
    }));

    // 默认作者
    const authorGroup = form.createDiv({ cls: 'wechat-form-group' });
    authorGroup.createEl('label', { text: '默认作者（可选）' });
    const authorInput = /** @type {any} */ (authorGroup.createEl('input', {
      type: 'text',
      placeholder: '留空则不显示作者',
      value: account?.author || ''
    }));

    const publishOptions = form.createEl('details', { cls: 'wechat-sync-advanced wechat-account-publish-options' });
    publishOptions.createEl('summary', {
      text: '发布选项',
      cls: 'wechat-sync-advanced-summary',
    });
    const publishSection = publishOptions.createDiv({ cls: 'wechat-sync-advanced-body wechat-account-publish-body' });
    publishSection.createEl('div', {
      text: '可为当前公众号预设原文链接与留言相关的默认发布策略。',
      cls: 'wechat-form-help',
    });

    const sourceUrlGroup = publishSection.createDiv({ cls: 'wechat-form-group' });
    sourceUrlGroup.createEl('label', { text: '默认原文链接（可选）' });
    const sourceUrlInput = /** @type {any} */ (sourceUrlGroup.createEl('input', {
      type: 'url',
      placeholder: '留空则不同步原文链接',
      value: publishDefaults.contentSourceUrl,
    }));

    const commentGroup = publishSection.createDiv({ cls: 'wechat-form-checkbox-group' });
    const commentLabel = commentGroup.createEl('label', { cls: 'wechat-form-checkbox-label' });
    const commentInput = /** @type {any} */ (commentLabel.createEl('input', { type: 'checkbox' }));
    commentInput.checked = publishDefaults.openComment;
    commentLabel.appendText('默认开启留言');

    const fansCommentGroup = publishSection.createDiv({ cls: 'wechat-form-checkbox-group' });
    const fansCommentLabel = fansCommentGroup.createEl('label', { cls: 'wechat-form-checkbox-label' });
    const fansCommentInput = /** @type {any} */ (fansCommentLabel.createEl('input', { type: 'checkbox' }));
    fansCommentInput.checked = publishDefaults.openComment && publishDefaults.onlyFansCanComment;
    fansCommentLabel.appendText('默认仅粉丝可留言');
    fansCommentGroup.createEl('div', {
      text: '关闭留言时，此选项不会生效。',
      cls: 'wechat-form-help',
    });

    const syncCommentDependency = () => {
      const enabled = commentInput.checked;
      fansCommentInput.disabled = !enabled;
      fansCommentGroup.toggleClass('is-disabled', !enabled);
      if (!enabled) fansCommentInput.checked = false;
    };
    commentInput.addEventListener('change', syncCommentDependency);
    syncCommentDependency();

    // 按钮区
    const btnRow = form.createDiv({ cls: 'wechat-modal-buttons' });

    const cancelBtn = btnRow.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const testBtn = btnRow.createEl('button', { text: '测试连接', cls: 'wechat-btn-test' });
    testBtn.onclick = async () => {
      if (!appIdInput.value || !secretInput.value) {
        new Notice('请填写 AppID 和 AppSecret');
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = '测试中...';
      try {
        const api = new WechatAPI(appIdInput.value.trim(), secretInput.value.trim(), this.plugin.settings.proxyUrl, this.plugin.settings.clientId);
        await api.getAccessToken();
        new Notice('✅ 连接成功！');
      } catch (err) {
        new Notice(`❌ 连接失败: ${toReadableError(err).message}`);
      }
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    };

    const saveBtn = btnRow.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      const name = nameInput.value.trim() || '未命名账号';
      const appId = appIdInput.value.trim();
      const appSecret = secretInput.value.trim();

      if (!appId || !appSecret) {
        new Notice('请填写 AppID 和 AppSecret');
        return;
      }

      const publishOptions = normalizeWechatAccountPublishOptions({
        contentSourceUrl: sourceUrlInput.value,
        openComment: commentInput.checked,
        onlyFansCanComment: fansCommentInput.checked,
      });

      if (account) {
        // 编辑现有账号
        account.name = name;
        account.appId = appId;
        account.appSecret = appSecret;
        account.author = authorInput.value.trim();
        Object.assign(account, publishOptions);
      } else {
        // 添加新账号
        const newAccount = {
          id: generateId(),
          name,
          appId,
          appSecret,
          author: authorInput.value.trim(),
          ...publishOptions,
        };
        this.plugin.settings.wechatAccounts.push(newAccount);
        // 如果是第一个账号，自动设为默认
        if (this.plugin.settings.wechatAccounts.length === 1) {
          this.plugin.settings.defaultAccountId = newAccount.id;
        }
      }

      await this.plugin.saveSettings();
      modal.close();
      refreshSettingTabCompat(this);
      new Notice(account ? '✅ 账号已更新' : '✅ 账号已添加');
    };

    modal.open();
  }
}

AppleStyleSettingTab.prototype[LEGACY_SETTING_RENDER_KEY] = function legacySettingsFallback() {
  this.renderSettingsContent();
};
