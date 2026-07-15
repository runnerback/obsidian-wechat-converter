// tests/settings_platform_chip.test.js
//
// Locks the DOM contract of the「其他平台」settings tab platform section
// after the 方案 i redesign (2026-07):
//
//   1. Settings is READ-ONLY info, not an interactive checkbox picker.
//   2. Enabled platforms (小红书 / X) render as read-only chips with
//      `.is-selected`, name + status stacked inside `.wechat-platform-chip-body`.
//   3. Other platforms render inside a collapsible「计划支持」<details> as
//      `.is-disabled` chips with a「计划中」status, and NO checkbox anywhere.
//
// Failing this test means the settings platform section structure changed;
// review against styles/src/05-accounts.css `.wechat-platform-chip` rules.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createObsidianLikeElement } = require('./helpers/obsidian-dom.js');
const { loadInputModule } = require('./helpers/input-module.cjs');
const { AppleStyleSettingTab } = loadInputModule();

function makePlugin({ connection = null } = {}) {
  const defaultConnection = {
    status: 'connected',
    checkedAt: Date.now(),
    platforms: [
      { id: 'xiaohongshu', name: '小红书', authKnown: true, authenticated: true, username: 'Lin' },
    ],
    capabilities: {},
    message: '',
  };
  return {
    app: {},
    manifest: { dir: '/test', id: 'content-studio', version: '0.0.0-test' },
    settings: {
      wechatAccounts: [],
      defaultAccountId: '',
      proxyUrl: '',
      cleanupAfterSync: false,
      cleanupUseSystemTrash: true,
      cleanupDirTemplate: '',
      usePhoneFrame: true,
      enableWatermark: false,
      showImageCaption: true,
      normalizeChinesePunctuation: true,
      coloredHeader: false,
      sidePadding: 16,
      theme: 'github', themeColor: 'blue', customColor: '#0366d6',
      quoteCalloutStyleMode: 'theme',
      fontFamily: 'sans-serif', fontSize: 3,
      macCodeBlock: true, codeLineNumber: true,
      avatarUrl: '', avatarBase64: '',
      multiPlatformSync: {
        enabled: true,
        port: 9527,
        token: 'test-token',
        supportedPlatforms: [],
        selectedPlatforms: [],
        connection: connection || defaultConnection,
        recentTasks: [],
      },
      ai: {
        enabled: false, providers: [], defaultProviderId: '',
        defaultLayoutFamily: 'auto', defaultColorPalette: 'auto',
        includeImagesInLayout: true, requestTimeoutMs: 45000, articleLayoutsByPath: {},
      },
    },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    startWechatSyncBridgeInBackground: vi.fn(),
    _wechatSyncBridgeService: null,
    getWechatSyncBridgeService: vi.fn(() => ({})),
    getConverterView: vi.fn(() => null),
    getArticleLayoutState: vi.fn(() => null),
  };
}

function renderTab(plugin) {
  const tab = new AppleStyleSettingTab(plugin.app, plugin);
  tab.containerEl = createObsidianLikeElement('div');
  tab.renderSettingsContent();
  return tab;
}

function findChipByName(tab, name) {
  return Array.from(tab.containerEl.querySelectorAll('.wechat-platform-chip'))
    .find((chip) => chip.querySelector('.wechat-platform-chip-name')?.textContent === name);
}

describe('settings page - platform section (方案 i read-only)', () => {
  beforeEach(() => {
    globalThis.__obsidianSettingNamesRegistry = [];
  });

  it('已接入平台(小红书)只读展示:name + status 同在 chip-body 内(堆叠,非兄弟)', () => {
    const tab = renderTab(makePlugin());
    const chip = findChipByName(tab, '小红书');
    expect(chip).toBeDefined();

    const body = chip.querySelector('.wechat-platform-chip-body');
    const name = body && body.querySelector('.wechat-platform-chip-name');
    const status = body && body.querySelector('.wechat-platform-chip-status');
    expect(body).not.toBeNull();
    expect(name).not.toBeNull();
    expect(status).not.toBeNull();
    // 回归守卫:status 必须在 body 内,不能是 chip 的兄弟节点
    expect(status.parentElement).toBe(body);
  });

  it('已接入平台带 is-selected + 认证状态类,状态文本在 DOM 中', () => {
    const tab = renderTab(makePlugin());
    const chip = findChipByName(tab, '小红书');
    expect(chip.classList.contains('is-selected')).toBe(true);
    expect(chip.classList.contains('is-ok')).toBe(true);
    const status = chip.querySelector('.wechat-platform-chip-status');
    expect(status.textContent.length).toBeGreaterThan(0);
  });

  it('X 作为已接入平台一并展示', () => {
    const tab = renderTab(makePlugin());
    const chip = findChipByName(tab, 'X');
    expect(chip).toBeDefined();
    expect(chip.classList.contains('is-selected')).toBe(true);
  });

  it('计划支持平台(知乎)为 is-disabled、标「计划中」,且在折叠区内', () => {
    const tab = renderTab(makePlugin());
    const chip = findChipByName(tab, '知乎');
    expect(chip).toBeDefined();
    expect(chip.classList.contains('is-disabled')).toBe(true);
    expect(chip.querySelector('.wechat-platform-chip-status')?.textContent).toBe('计划中');
    // 位于「计划支持」<details> 折叠区
    expect(chip.closest('.wechat-platform-planned')).not.toBeNull();
  });

  it('整个平台区不再有任何可交互 checkbox(方案 i)', () => {
    const tab = renderTab(makePlugin());
    const picker = tab.containerEl.querySelector('.wechat-platform-picker');
    expect(picker).not.toBeNull();
    expect(picker.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });
});
