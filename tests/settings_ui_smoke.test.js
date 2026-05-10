// tests/settings_ui_smoke.test.js
//
// Smoke test for AppleStyleSettingTab.display(). Goal: any future refactor
// that accidentally drops a Setting from the wechat tab or the multi-platform
// tab will be caught here. This was motivated by commit d115abd silently
// dropping「使用系统回收站」and「API 代理地址」when refactoring 高级设置 into the
// wechat tab — neither change had a test, so the regression went unnoticed.
//
// Invariant: when the test fails, fix the SettingTab UI, not the test —
// unless the field has been intentionally retired.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createObsidianLikeElement } = require('./helpers/obsidian-dom.js');
const { AppleStyleSettingTab } = require('../input.js');

function makeMinimalSettings(overrides = {}) {
  return {
    theme: 'github',
    themeColor: 'blue',
    customColor: '#0366d6',
    quoteCalloutStyleMode: 'theme',
    fontFamily: 'sans-serif',
    fontSize: 3,
    macCodeBlock: true,
    codeLineNumber: true,
    avatarUrl: '',
    avatarBase64: '',
    enableWatermark: false,
    showImageCaption: true,
    normalizeChinesePunctuation: true,
    wechatAccounts: [],
    defaultAccountId: '',
    proxyUrl: '',
    usePhoneFrame: true,
    sidePadding: 16,
    coloredHeader: false,
    cleanupAfterSync: false,
    cleanupUseSystemTrash: true,
    cleanupDirTemplate: '',
    multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: {
        status: 'untested',
        checkedAt: 0,
        platforms: [],
        capabilities: {},
        message: '',
      },
      recentTasks: [],
    },
    wechatAppId: '',
    wechatAppSecret: '',
    ai: {
      enabled: false,
      providers: [],
      defaultProviderId: '',
      defaultLayoutFamily: 'auto',
      defaultColorPalette: 'auto',
      includeImagesInLayout: true,
      requestTimeoutMs: 45000,
      articleLayoutsByPath: {},
    },
    ...overrides,
  };
}

function makePlugin(settingsOverrides = {}) {
  return {
    app: {},
    manifest: { dir: '/test', id: 'wechat-converter', version: '0.0.0-test' },
    settings: makeMinimalSettings(settingsOverrides),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    startWechatSyncBridgeInBackground: vi.fn(),
    _wechatSyncBridgeService: null,
    getWechatSyncBridgeService: vi.fn(() => ({
      start: vi.fn().mockResolvedValue({}),
      waitForConnection: vi.fn().mockResolvedValue(undefined),
      health: vi.fn().mockResolvedValue({ ok: true, tokenValid: true }),
      listSupportedPlatforms: vi.fn().mockResolvedValue([]),
      getAuthSnapshot: vi.fn().mockResolvedValue({ platforms: [], checkedAt: 0 }),
      checkAuth: vi.fn().mockResolvedValue([]),
      getStatus: vi.fn().mockResolvedValue({}),
    })),
    getConverterView: vi.fn(() => null),
    getArticleLayoutState: vi.fn(() => null),
  };
}

function renderTab(plugin) {
  const tab = new AppleStyleSettingTab(plugin.app, plugin);
  tab.containerEl = createObsidianLikeElement('div');
  tab.display();
  return tab;
}

describe('AppleStyleSettingTab.display - smoke test', () => {
  beforeEach(() => {
    globalThis.__obsidianSettingNamesRegistry = [];
  });

  it('loads via the resolver patch (sanity check)', () => {
    expect(globalThis.__obsidianMockLoaded).toBe(true);
  });

  it('renders the wechat-tab core sections without throwing', () => {
    const plugin = makePlugin();
    expect(() => renderTab(plugin)).not.toThrow();
    expect(globalThis.__obsidianSettingNamesRegistry.length).toBeGreaterThan(5);
  });

  it('keeps 高级设置 fields that earlier refactors silently dropped', () => {
    // Regression guard for commit d115abd. If you remove either of these,
    // either restore them (recommended) or update this test deliberately.
    renderTab(makePlugin());
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('发送成功后自动清理资源');
    expect(names).toContain('清理目录');
    expect(names).toContain('使用系统回收站');
    expect(names).toContain('API 代理地址');
  });

  it('renders the preview / watermark headings on the wechat tab', () => {
    renderTab(makePlugin());
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('预览模式');
    expect(names).toContain('使用手机仿真框');
    expect(names).toContain('图片水印');
  });

  it('renders the multi-platform tab core fields when bridge is enabled', () => {
    renderTab(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('启用浏览器插件发布');
    expect(names).toContain('本地服务端口');
    expect(names).toContain('连接令牌');
    expect(names).toContain('测试连接');
    expect(names).toContain('诊断已选平台登录状态');
  });

  it('hides bridge-config fields and diagnostics when bridge is disabled', () => {
    renderTab(makePlugin({ multiPlatformSync: {
      enabled: false,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('启用浏览器插件发布');
    expect(names).not.toContain('本地服务端口');
    expect(names).not.toContain('测试连接');
    expect(names).not.toContain('诊断已选平台登录状态');
  });
});
