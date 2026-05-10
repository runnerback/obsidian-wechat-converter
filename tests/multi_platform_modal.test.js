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

const { AppleStyleView } = require('../input.js');
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

function makeView({ selectedPlatforms = ['zhihu'], cachedPlatforms = null } = {}) {
  const platforms = cachedPlatforms || [
    { id: 'zhihu', name: '知乎', authKnown: true, authenticated: true, username: 'Lin' },
    { id: 'juejin', name: '掘金', authKnown: true, authenticated: false, error: '登录已失效' },
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
    getWechatSyncBridgeService: vi.fn(() => ({})),
  });
  view.app = { isMobile: false };
  view.currentHtml = '<p>hello</p>';
  view.getPublishContextFile = vi.fn(() => ({ path: 'a.md', basename: 'a' }));
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
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();

    const row = findRow(modal, 'zhihu');
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
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'zhihu');
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(row.classList.contains('is-ok')).toBe(true);
  });

  it('login_required row gets is-error class when selected', async () => {
    const view = makeView({ selectedPlatforms: ['juejin'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'juejin');
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(row.classList.contains('is-error')).toBe(true);
  });

  it('toggling checkbox flips is-selected on the row', async () => {
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'zhihu');
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

  it('hides bridge-not-enabled empty state when enabled', async () => {
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const empty = modal.contentEl.querySelector('.wechat-sync-empty-state');
    expect(empty).toBeNull();
  });

  it('row exposes a tooltip with full platform name + status when selected', async () => {
    const view = makeView({ selectedPlatforms: ['zhihu'] });
    await view.showMultiPlatformSyncModal();
    const modal = modalCapture.getLastModal();
    const row = findRow(modal, 'zhihu');
    const title = row.getAttribute('title');
    expect(title).toContain('知乎');
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
});
