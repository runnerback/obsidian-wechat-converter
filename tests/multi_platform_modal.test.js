// tests/multi_platform_modal.test.js
//
// Locks the DOM contract of the「其他平台发布」modal opened via
// AppleStyleView.showMultiPlatformSyncModal(). Mirrors the chip contract
// in tests/settings_platform_chip.test.js: name and status sit inside the
// label as stacked spans, and is-selected toggles correctly.
//
// Failing this test means a refactor changed the publish-modal platform row
// layout; review styles.css `.wechat-multiplatform-platform*` rules before
// adjusting the test.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadInputModule } = require('./helpers/input-module.cjs');
const { AppleStyleView } = loadInputModule();
const obsidian = require('obsidian');
const { __applyExtensions: applyExtensions } = obsidian;

function installModalCapture() {
  const opened = [];
  class CapturingModal {
    constructor(app) {
      this.app = app;
      this.titleEl = applyExtensions(document.createElement('h2'));
      this.contentEl = applyExtensions(document.createElement('div'));
      this.modalEl = applyExtensions(document.createElement('div'));
      opened.push(this);
    }
    open() { this.isOpen = true; }
    close() { this.isOpen = false; }
  }
  obsidian.Modal = CapturingModal;
  return {
    getLastModal: () => opened[opened.length - 1],
    reset: () => { opened.length = 0; },
  };
}

// 发布弹窗只显示已接入平台(小红书/X);fixture 默认用这两个。
// 小红书=已登录(is-ok),X=需登录(is-error),覆盖两种状态类。
function makeView({ selectedPlatforms = ['xiaohongshu', 'x'], cachedPlatforms = null, bridge = null, app = null } = {}) {
  const platforms = cachedPlatforms || [
    { id: 'xiaohongshu', name: '小红书', authKnown: true, authenticated: true, username: 'Lin' },
    { id: 'x', name: 'X', authKnown: true, authenticated: false, error: '需登录' },
  ];
  const view = new AppleStyleView(null, {
    settings: {
      wechatAccounts: [{ id: 'acc-1', name: '账号1', appId: 'wx1', appSecret: 'sec1' }],
      defaultAccountId: 'acc-1',
      proxyUrl: '',
      multiPlatformSync: {
        enabled: true,
        port: 9527,
        token: 'test-token',
        supportedPlatforms: [],
        selectedPlatforms,
        connection: {
          status: 'connected',
          checkedAt: Date.now(),
          platforms,
          capabilities: {},
          message: '',
        },
        recentTasks: [],
      },
    },
    getWechatSyncBridgeService: vi.fn(() => ({
      start: vi.fn().mockResolvedValue({}),
      waitForConnection: vi.fn().mockResolvedValue(undefined),
    })),
    saveSettings: vi.fn(),
  });
  if (bridge) {
    // 发送前会 start()+waitForConnection() 确保 WS 连通;mock 缺省补上,调用方可覆盖
    const fullBridge = {
      start: vi.fn().mockResolvedValue({}),
      waitForConnection: vi.fn().mockResolvedValue(undefined),
      ...bridge,
    };
    view.plugin.getWechatSyncBridgeService = vi.fn(() => fullBridge);
  }
  view.app = app || { isMobile: false };
  if (view.app.isMobile === undefined) view.app.isMobile = false;
  view.currentHtml = '<p>hello</p>';
  view.lastResolvedMarkdown = '';
  view.getPublishContextFile = vi.fn(() => ({ path: 'a.md', basename: 'a' }));
  view.getCurrentExportHtml = vi.fn(() => '<p>hello</p>');
  view.getFrontmatterPublishMeta = vi.fn(() => ({ coverSrc: '' }));
  view.getFirstImageFromArticle = vi.fn(() => '');
  view.prepareHtmlForWechatsyncArticle = vi.fn(async (html) => html);
  view.generateCoverThumbnailFromAsset = vi.fn(async () => '');
  view.getWechatsyncTaskSnapshot = vi.fn(async () => null);
  view.showMultiPlatformQuotaBlockedModal = vi.fn();
  return view;
}

function findRow(modal, platformId) {
  return Array.from(modal.contentEl.querySelectorAll('.wechat-multiplatform-platform'))
    .find((row) => row.querySelector(`input[value="${platformId}"]`));
}

describe('AppleStyleView - showMultiPlatformSyncModal platform rows', () => {
  let modalCapture;

  beforeEach(() => {
    modalCapture = installModalCapture();
  });

  it('renders selected rows with name + status both inside the label (stacked)', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();

    const row = findRow(modal, 'xiaohongshu');
    expect(row).toBeDefined();

    const label = row.querySelector('.wechat-multiplatform-platform-label');
    const name = label && label.querySelector('.wechat-multiplatform-platform-name');
    const status = label && label.querySelector('.wechat-multiplatform-platform-status');

    expect(label).not.toBeNull();
    expect(name).not.toBeNull();
    expect(status).not.toBeNull();
    expect(status.parentElement).toBe(label);
  });

  it('selected row carries is-selected + auth-status class', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'xiaohongshu');
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(row.classList.contains('is-ok')).toBe(true);
  });

  it('marks platform rows disabled when the browser bridge is not ready', async () => {
    const view = makeView();
    view.plugin.settings.multiPlatformSync.connection.status = 'disconnected';
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'xiaohongshu');
    const checkbox = row.querySelector('input[type="checkbox"]');

    expect(row.classList.contains('is-disabled')).toBe(true);
    expect(row.classList.contains('is-selected')).toBe(false);
    expect(checkbox.disabled).toBe(true);
  });

  it('orders displayed platforms by authenticated state and featured platform order', async () => {
    // 只显示已接入平台;已登录的排在需登录的前面(authenticated-first)
    const view = makeView({
      cachedPlatforms: [
        { id: 'xiaohongshu', name: '小红书', authKnown: true, authenticated: false, error: '需登录' },
        { id: 'x', name: 'X', authKnown: true, authenticated: true },
      ],
    });

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const rowIds = Array.from(modal.contentEl.querySelectorAll('.wechat-multiplatform-platform input'))
      .map((input) => input.value);

    expect(rowIds).toEqual(['x', 'xiaohongshu']);
  });

  it('preferredPlatform 只默认勾选对应平台(顶栏选 X → 只勾 X)', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal({ preferredPlatform: 'x' });
    const modal = modalCapture.getLastModal();
    // 两个平台都显示,但只有 X 默认勾选
    expect(findRow(modal, 'x').querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(findRow(modal, 'xiaohongshu').querySelector('input[type="checkbox"]').checked).toBe(false);
  });

  it('preferredPlatform=xiaohongshu → 只勾小红书', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal({ preferredPlatform: 'xiaohongshu' });
    const modal = modalCapture.getLastModal();
    expect(findRow(modal, 'xiaohongshu').querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(findRow(modal, 'x').querySelector('input[type="checkbox"]').checked).toBe(false);
  });

  it('无 preferredPlatform 时默认全选(小红书+X)', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    expect(findRow(modal, 'xiaohongshu').querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(findRow(modal, 'x').querySelector('input[type="checkbox"]').checked).toBe(true);
  });

  it('login_required row gets is-error class when selected', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'x');
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(row.classList.contains('is-error')).toBe(true);
  });

  it('toggling checkbox flips is-selected on the row', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'xiaohongshu');
    const checkbox = row.querySelector('input[type="checkbox"]');

    expect(row.classList.contains('is-selected')).toBe(true);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(row.classList.contains('is-selected')).toBe(false);
    expect(row.classList.contains('is-ok')).toBe(false);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(row.classList.contains('is-ok')).toBe(true);
  });

  it('keeps temporary platform choices when returning to the tab inside the same modal', async () => {
    const cachedPlatforms = [
      { id: 'xiaohongshu', name: '小红书', authKnown: true, authenticated: true },
      { id: 'x', name: 'X', authKnown: true, authenticated: true },
    ];
    const view = makeView({ cachedPlatforms });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();

    const xRow = findRow(modal, 'x');
    const xCheckbox = xRow.querySelector('input[type="checkbox"]');
    xCheckbox.checked = false;
    xCheckbox.dispatchEvent(new Event('change'));

    await view.showMultiPlatformSyncModal({ modal });

    const returnedXhs = findRow(modal, 'xiaohongshu').querySelector('input[type="checkbox"]');
    const returnedX = findRow(modal, 'x').querySelector('input[type="checkbox"]');

    expect(returnedXhs.checked).toBe(true);
    expect(returnedX.checked).toBe(false);
    expect(findRow(modal, 'x').classList.contains('is-selected')).toBe(false);
  });

  it('hides bridge-not-enabled empty state when enabled', async () => {
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const empty = modal.contentEl.querySelector('.wechat-sync-empty-state');
    expect(empty).toBeNull();
  });

  it('row exposes a tooltip with full platform name + status when selected', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'xiaohongshu');
    const title = row.getAttribute('title');
    expect(title).toContain('小红书');
    expect(title).toContain('上次可用');
  });

  it('renders exactly one connection status bar (Phase 2 helper) above the platform list', async () => {
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const bars = modal.contentEl.querySelectorAll('.wechat-multiplatform-status');
    expect(bars.length).toBe(1);

    const bar = bars[0];
    const dot = bar.querySelector('.wechat-multiplatform-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-ok')).toBe(true);

    // Bar must come before the platform list in DOM order.
    const list = modal.contentEl.querySelector('.wechat-multiplatform-list');
    expect(list).not.toBeNull();
    const followers = bar.compareDocumentPosition(list);
    expect(followers & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('updates platform hint to reflect the selected platform count (2)', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const hint = modal.contentEl.querySelector('.wechat-multiplatform-quota-hint');

    expect(hint.textContent).toContain('已选 2 个平台');
    expect(hint.textContent).not.toContain('免费版');
  });

  it('updates platform hint after deselecting a platform (2 → 1)', async () => {
    const view = makeView();
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const xCheckbox = findRow(modal, 'x').querySelector('input[type="checkbox"]');
    xCheckbox.checked = false;
    xCheckbox.dispatchEvent(new Event('change'));
    const hint = modal.contentEl.querySelector('.wechat-multiplatform-quota-hint');

    expect(hint.textContent).toContain('已选 1 个平台');
  });

  it('passes truncate quotaPolicy and shows quota modal when the extension blocks the task', async () => {
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({
        accepted: false,
        reason: 'daily_limit',
        quotaBlocked: true,
        skippedPlatforms: ['xiaohongshu', 'x'],
        message: '部分平台本次未入队，请稍后重试。',
      }),
    };
    const view = makeView({ bridge });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const syncBtn = modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta');

    await syncBtn.onclick();

    expect(bridge.enqueueSyncArticle).toHaveBeenCalledWith(expect.objectContaining({
      platforms: ['xiaohongshu', 'x'],
      source: 'obsidian',
      quotaPolicy: 'truncate',
    }));
    expect(view.showMultiPlatformQuotaBlockedModal).toHaveBeenCalledWith(expect.objectContaining({
      requestedPlatformIds: ['xiaohongshu', 'x'],
      quotaResult: expect.objectContaining({
        accepted: false,
        reason: 'daily_limit',
      }),
    }));
  });

  it('sends local markdown images as bridge assets and rewrites local HTML src values', async () => {
    const imageFile = {
      path: 'notes/assets/local.png',
      name: 'local.png',
      extension: 'png',
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]),
    };
    const app = {
      isMobile: false,
      metadataCache: {
        getFirstLinkpathDest: vi.fn((linkpath) => (linkpath === 'assets/local.png' ? imageFile : null)),
      },
      vault: {
        readBinary: vi.fn(async () => imageFile.bytes),
        getResourcePath: vi.fn(() => 'app://local/notes%2Fassets%2Flocal.png'),
        getAbstractFileByPath: vi.fn(() => null),
      },
    };
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge, app });
    view.lastResolvedMarkdown = '![图](assets/local.png)';
    view.getCurrentExportHtml = vi.fn(() => '<p><img src="app://local/notes%2Fassets%2Flocal.png" alt="图"></p>');
    view.prepareHtmlForWechatsyncArticle = vi.fn(async (html) => html);
    view.showWechatsyncEnqueueAcceptedModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const syncBtn = modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta');

    await syncBtn.onclick();

    expect(bridge.enqueueSyncArticle).toHaveBeenCalledWith(expect.objectContaining({
      markdown: '![图](asset://image-1)',
      content: '<p><img src="asset://image-1" alt="图"></p>',
      cover: 'asset://image-1',
      assets: [
        expect.objectContaining({
          id: 'image-1',
          filename: 'local.png',
          mimeType: 'image/png',
          base64: imageFile.bytes.toString('base64'),
        }),
      ],
    }));
  });

  it('uses frontmatter local cover as a bridge asset and reuses it for the first body image', async () => {
    const imageFile = {
      path: 'notes/assets/cover.png',
      name: 'cover.png',
      extension: 'png',
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8]),
    };
    const app = {
      isMobile: false,
      metadataCache: {
        getFirstLinkpathDest: vi.fn((linkpath) => (linkpath === 'assets/cover.png' ? imageFile : null)),
      },
      vault: {
        readBinary: vi.fn(async () => imageFile.bytes),
        getResourcePath: vi.fn(() => 'app://local/notes%2Fassets%2Fcover.png'),
        getAbstractFileByPath: vi.fn(() => null),
      },
    };
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge, app });
    view.lastResolvedMarkdown = '![封面](assets/cover.png)';
    view.getFrontmatterPublishMeta = vi.fn(() => ({ cover: 'assets/cover.png', coverSrc: 'app://local/notes%2Fassets%2Fcover.png' }));
    view.getCurrentExportHtml = vi.fn(() => '<p><img src="app://local/notes%2Fassets%2Fcover.png" alt="封面"></p>');
    view.prepareHtmlForWechatsyncArticle = vi.fn(async (html) => html);
    view.showWechatsyncEnqueueAcceptedModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const syncBtn = modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta');

    await syncBtn.onclick();

    expect(bridge.enqueueSyncArticle).toHaveBeenCalledWith(expect.objectContaining({
      markdown: '![封面](asset://image-1)',
      content: '<p><img src="asset://image-1" alt="封面"></p>',
      cover: 'asset://image-1',
      assets: [
        expect.objectContaining({
          id: 'image-1',
          filename: 'cover.png',
        }),
      ],
    }));
  });

  it('ignores app resource session cover and resolves the original frontmatter cover path', async () => {
    const imageFile = {
      path: 'Wechat/published/img/cover-combined.jpg',
      name: 'cover-combined.jpg',
      extension: 'jpg',
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00, 9, 10]),
    };
    const app = {
      isMobile: false,
      metadataCache: {
        getFirstLinkpathDest: vi.fn((linkpath) => (
          linkpath === 'Wechat/published/img/cover-combined.jpg' ? imageFile : null
        )),
      },
      vault: {
        readBinary: vi.fn(async () => imageFile.bytes),
        getResourcePath: vi.fn(() => 'app://local/Users/demo/Vault/Wechat/published/img/cover-combined.jpg?123'),
        getAbstractFileByPath: vi.fn(() => null),
      },
    };
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge, app });
    view.sessionCoverBase64 = 'app://local/Users/demo/Vault/Wechat/published/img/cover-combined.jpg?123';
    view.lastResolvedMarkdown = '正文';
    view.getFrontmatterPublishMeta = vi.fn(() => ({
      cover: 'Wechat/published/img/cover-combined.jpg',
      coverSrc: 'app://local/Users/demo/Vault/Wechat/published/img/cover-combined.jpg?123',
    }));
    view.prepareHtmlForWechatsyncArticle = vi.fn(async (html) => html);
    view.showWechatsyncEnqueueAcceptedModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const syncBtn = modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta');

    await syncBtn.onclick();

    expect(bridge.enqueueSyncArticle).toHaveBeenCalledWith(expect.objectContaining({
      cover: 'asset://image-1',
      assets: [
        expect.objectContaining({
          id: 'image-1',
          filename: 'cover-combined.jpg',
          mimeType: 'image/jpeg',
        }),
      ],
    }));
  });

  it('downloads selected WeChat material cover and sends it as a bridge asset', async () => {
    obsidian.requestUrl = vi.fn(async () => ({
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x11]).buffer,
      headers: { 'content-type': 'image/jpeg' },
    }));
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge });
    view.sessionThumbMediaId = 'thumb-from-material';
    view.sessionCoverBase64 = 'https://mmbiz.qpic.cn/mmbiz_jpg/material-cover/0?wx_fmt=jpeg';
    view.lastResolvedMarkdown = '正文';
    view.getFrontmatterPublishMeta = vi.fn(() => ({ cover: 'assets/fallback.png', coverSrc: '' }));
    view.getFirstImageFromArticle = vi.fn(() => 'https://example.com/fallback.png');
    view.showWechatsyncEnqueueAcceptedModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const syncBtn = modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta');

    await syncBtn.onclick();

    expect(obsidian.requestUrl).toHaveBeenCalledWith({
      url: 'https://mmbiz.qpic.cn/mmbiz_jpg/material-cover/0?wx_fmt=jpeg',
      method: 'GET',
    });
    expect(bridge.enqueueSyncArticle).toHaveBeenCalledWith(expect.objectContaining({
      cover: 'asset://image-1',
      assets: [
        expect.objectContaining({
          id: 'image-1',
          filename: '0.jpg',
          mimeType: 'image/jpeg',
          source: expect.objectContaining({
            kind: 'wechat-material-cover',
            thumbMediaId: 'thumb-from-material',
          }),
        }),
      ],
    }));
  });

  it('reuses cached downloaded WeChat material cover assets for later bridge sends', async () => {
    obsidian.requestUrl = vi.fn(async () => ({
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x22]).buffer,
      headers: { 'content-type': 'image/jpeg' },
    }));
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge });
    view.sessionThumbMediaId = 'thumb-from-material';
    view.sessionCoverBase64 = 'https://mmbiz.qpic.cn/mmbiz_jpg/material-cover/1?wx_fmt=jpeg';
    view.lastResolvedMarkdown = '正文';
    view.getFrontmatterPublishMeta = vi.fn(() => ({ cover: '', coverSrc: '' }));
    view.showWechatsyncEnqueueAcceptedModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    let modal = modalCapture.getLastModal();
    await modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta').onclick();

    await view.showMultiPlatformSyncModal();
    modal = modalCapture.getLastModal();
    await modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta').onclick();

    expect(obsidian.requestUrl).toHaveBeenCalledTimes(1);
    expect(bridge.enqueueSyncArticle).toHaveBeenCalledTimes(2);
    expect(view.wechatMaterialCoverAssetCache.size).toBe(1);
    expect(bridge.enqueueSyncArticle.mock.calls[1][0]).toEqual(expect.objectContaining({
      cover: 'asset://image-1',
      assets: [
        expect.objectContaining({
          id: 'image-1',
          filename: '1.jpg',
          base64: Buffer.from([0xff, 0xd8, 0xff, 0x22]).toString('base64'),
        }),
      ],
    }));
  });

  it('does not enqueue when a selected WeChat material cover has no downloadable URL', async () => {
    obsidian.requestUrl = vi.fn();
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge });
    view.sessionThumbMediaId = 'thumb-from-material';
    view.sessionCoverBase64 = '';
    view.lastResolvedMarkdown = '正文';
    view.showMultiPlatformSyncResultModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    await modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta').onclick();

    expect(obsidian.requestUrl).not.toHaveBeenCalled();
    expect(bridge.enqueueSyncArticle).not.toHaveBeenCalled();
    expect(view.showMultiPlatformSyncResultModal).toHaveBeenCalledWith(expect.objectContaining({
      fatalError: expect.any(Error),
    }));
  });

  it('does not enqueue when a selected WeChat material cover downloads as a non-image', async () => {
    obsidian.requestUrl = vi.fn(async () => ({
      arrayBuffer: async () => new TextEncoder().encode('<html></html>').buffer,
      headers: { 'content-type': 'text/html' },
    }));
    const bridge = {
      health: vi.fn().mockResolvedValue({ ok: true, capabilities: { quotaPolicy: true } }),
      enqueueSyncArticle: vi.fn().mockResolvedValue({ accepted: true, syncId: 'sync-1' }),
    };
    const view = makeView({ selectedPlatforms: ['zhihu'], bridge });
    view.sessionThumbMediaId = 'thumb-from-material';
    view.sessionCoverBase64 = 'https://mmbiz.qpic.cn/material-cover/not-image';
    view.lastResolvedMarkdown = '正文';
    view.showMultiPlatformSyncResultModal = vi.fn();

    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    await modal.contentEl.querySelector('.wechat-modal-buttons .mod-cta').onclick();

    expect(obsidian.requestUrl).toHaveBeenCalledTimes(1);
    expect(bridge.enqueueSyncArticle).not.toHaveBeenCalled();
    expect(view.showMultiPlatformSyncResultModal.mock.calls[0][0].fatalError.message).toContain('格式不支持');
  });

  it('shows skipped platforms in the accepted task modal when quota truncates the request', () => {
    const view = makeView({ selectedPlatforms: ['zhihu', 'juejin'] });

    view.showWechatsyncEnqueueAcceptedModal({
      syncId: 'sync-1',
      title: 'a',
      platforms: ['zhihu', 'juejin'],
      quotaResult: {
        accepted: true,
        quotaBlocked: true,
        maxPlatforms: 1,
        publishedPlatforms: ['zhihu'],
        skippedPlatforms: ['juejin'],
      },
    });

    const modal = modalCapture.getLastModal();
    expect(modal.titleEl.textContent).toBe('已发送到浏览器插件');
    expect(modal.contentEl.textContent).toContain('部分平台已跳过');
    expect(modal.contentEl.textContent).toContain('跳过 1 个平台');
    expect(modal.contentEl.textContent).toContain('掘金');

    const upgradeBtn = Array.from(modal.contentEl.querySelectorAll('button'))
      .find((button) => button.textContent === '升级 Pro');
    expect(upgradeBtn).toBeUndefined();
  });

  it('does not render skipped platforms again as queued task rows', () => {
    const view = makeView({ selectedPlatforms: ['zhihu', 'juejin'] });

    view.showWechatsyncEnqueueAcceptedModal({
      syncId: 'sync-1',
      title: 'a',
      platforms: ['zhihu', 'juejin'],
      task: {
        platforms: [
          { id: 'zhihu', status: 'queued' },
          { id: 'juejin', status: 'queued', message: '免费版今日平台额度不足' },
        ],
      },
      quotaResult: {
        accepted: true,
        quotaBlocked: true,
        maxPlatforms: 1,
        publishedPlatforms: ['zhihu'],
        skippedPlatforms: ['juejin'],
      },
    });

    const modal = modalCapture.getLastModal();
    const rows = Array.from(modal.contentEl.querySelectorAll('.wechat-multiplatform-result-row'));
    const platformRows = rows.filter((row) => row.querySelector('.wechat-multiplatform-result-name')?.textContent !== 'a');
    const zhihuRows = platformRows.filter((row) => row.querySelector('.wechat-multiplatform-result-name')?.textContent === '知乎');
    const juejinRows = platformRows.filter((row) => row.querySelector('.wechat-multiplatform-result-name')?.textContent === '掘金');

    expect(zhihuRows).toHaveLength(1);
    expect(zhihuRows[0].querySelector('.wechat-multiplatform-result-pill')?.textContent).toBe('已投递');
    expect(juejinRows).toHaveLength(1);
    expect(juejinRows[0].querySelector('.wechat-multiplatform-result-pill')?.textContent).toBe('已跳过');
  });

  it('uses daily platform quota copy for legacy platform_limit blocks', () => {
    const view = makeView({ selectedPlatforms: ['zhihu', 'juejin'] });
    view.showMultiPlatformQuotaBlockedModal = AppleStyleView.prototype.showMultiPlatformQuotaBlockedModal.bind(view);

    view.showMultiPlatformQuotaBlockedModal({
      requestedPlatformIds: ['zhihu', 'juejin'],
      quotaResult: {
        accepted: false,
        quotaBlocked: true,
        reason: 'platform_limit',
        maxPlatforms: 3,
        skippedPlatforms: ['zhihu', 'juejin'],
        message: '免费版每次最多 3 个平台。',
      },
    });

    const modal = modalCapture.getLastModal();
    expect(modal.titleEl.textContent).toBe('发布受限');
    expect(modal.contentEl.textContent).toContain('部分平台未入队');
    expect(modal.contentEl.textContent).toContain('本次有平台未入队');
    expect(modal.contentEl.textContent).not.toContain('每次最多');
    expect(modal.contentEl.textContent).not.toContain('单次最多');
    expect(modal.contentEl.querySelector('.wechat-multiplatform-result-row')).toBeNull();
    const buttonTexts = Array.from(modal.contentEl.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttonTexts).not.toContain('重新选择平台');
  });

  it('hides platform reselection when publish is quota blocked', () => {
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    view.showMultiPlatformQuotaBlockedModal = AppleStyleView.prototype.showMultiPlatformQuotaBlockedModal.bind(view);

    view.showMultiPlatformQuotaBlockedModal({
      requestedPlatformIds: ['zhihu'],
      quotaResult: {
        accepted: false,
        quotaBlocked: true,
        reason: 'daily_limit',
        skippedPlatforms: ['zhihu'],
        message: '今日平台数已用完，请稍后重试',
      },
    });

    const modal = modalCapture.getLastModal();
    const buttonTexts = Array.from(modal.contentEl.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttonTexts).not.toContain('重新选择平台');
    expect(buttonTexts).not.toContain('升级 Pro');
    expect(buttonTexts).toContain('关闭');
  });
});
