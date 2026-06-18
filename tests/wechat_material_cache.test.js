import { describe, it, expect, vi, beforeEach } from 'vitest';

const { loadInputModule } = require('./helpers/input-module.cjs');
function installModalCapture(obsidianMock) {
  const opened = [];
  const applyExtensions = obsidianMock.__applyExtensions || ((el) => el);

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

  obsidianMock.Modal = CapturingModal;
  return {
    getLastModal: () => opened[opened.length - 1],
  };
}

describe('AppleStyleView - WeChat material cache', () => {
  let AppleStyleView;
  let modalCapture;

  beforeEach(() => {
    vi.resetModules();
    const obsidianMock = require('obsidian');
    modalCapture = installModalCapture(obsidianMock);
    AppleStyleView = loadInputModule().AppleStyleView;
  });

  it('should reuse cached material pages within the ttl', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1100);
    const view = new AppleStyleView(null, null);
    const api = {
      appId: 'wx-1',
      proxyUrl: '',
      batchGetMaterials: vi.fn(async () => ({
        item: [{ media_id: 'm1', name: 'image.png', url: 'https://mmbiz.qpic.cn/a.png' }],
        total_count: 1,
      })),
    };

    const first = await view.loadWechatMaterialPage(api, 'image', 0, 18);
    const second = await view.loadWechatMaterialPage(api, 'image', 0, 18);

    expect(api.batchGetMaterials).toHaveBeenCalledTimes(1);
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.item[0].media_id).toBe('m1');
    Date.now.mockRestore();
  });

  it('should lazily remove expired material page cache entries', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000 + 5 * 60 * 1000 + 1);
    const view = new AppleStyleView(null, null);
    const api = {
      appId: 'wx-1',
      proxyUrl: '',
      batchGetMaterials: vi.fn()
        .mockResolvedValueOnce({ item: [{ media_id: 'old' }], total_count: 1 })
        .mockResolvedValueOnce({ item: [{ media_id: 'new' }], total_count: 1 }),
    };

    await view.loadWechatMaterialPage(api, 'image', 0, 18);
    const reloaded = await view.loadWechatMaterialPage(api, 'image', 0, 18);

    expect(api.batchGetMaterials).toHaveBeenCalledTimes(2);
    expect(reloaded.fromCache).toBe(false);
    expect(reloaded.item[0].media_id).toBe('new');
    expect(view.wechatMaterialCache.size).toBe(1);
    Date.now.mockRestore();
  });

  it('should refresh cached material pages when requested', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1100);
    const view = new AppleStyleView(null, null);
    const api = {
      appId: 'wx-1',
      proxyUrl: '',
      batchGetMaterials: vi.fn()
        .mockResolvedValueOnce({ item: [{ media_id: 'old' }], total_count: 1 })
        .mockResolvedValueOnce({ item: [{ media_id: 'new' }], total_count: 1 }),
    };

    await view.loadWechatMaterialPage(api, 'image', 0, 18);
    const refreshed = await view.loadWechatMaterialPage(api, 'image', 0, 18, { forceRefresh: true });

    expect(api.batchGetMaterials).toHaveBeenCalledTimes(2);
    expect(refreshed.fromCache).toBe(false);
    expect(refreshed.item[0].media_id).toBe('new');
    Date.now.mockRestore();
  });

  it('should isolate cache entries by account and page', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const view = new AppleStyleView(null, null);
    const apiA = {
      appId: 'wx-a',
      proxyUrl: '',
      batchGetMaterials: vi.fn(async () => ({ item: [{ media_id: 'a' }], total_count: 1 })),
    };
    const apiB = {
      appId: 'wx-b',
      proxyUrl: '',
      batchGetMaterials: vi.fn(async () => ({ item: [{ media_id: 'b' }], total_count: 1 })),
    };

    await view.loadWechatMaterialPage(apiA, 'image', 0, 18);
    await view.loadWechatMaterialPage(apiA, 'image', 18, 18);
    await view.loadWechatMaterialPage(apiB, 'image', 0, 18);

    expect(apiA.batchGetMaterials).toHaveBeenCalledTimes(2);
    expect(apiB.batchGetMaterials).toHaveBeenCalledTimes(1);
    Date.now.mockRestore();
  });

  it('should separate total material count from current page cache copy', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const view = new AppleStyleView(null, null);
    const api = {
      appId: 'wx-1',
      proxyUrl: '',
      batchGetMaterials: vi.fn(async () => ({
        item: [{ media_id: 'm1', name: 'image.png', url: 'https://mmbiz.qpic.cn/a.png' }],
        total_count: 444,
      })),
    };

    await view.showMaterialPickerModal(api, vi.fn());
    await view.showMaterialPickerModal(api, vi.fn());

    const modal = modalCapture.getLastModal();
    expect(api.batchGetMaterials).toHaveBeenCalledWith('image', 0, 12);
    expect(modal.contentEl.querySelector('.wechat-material-count').textContent).toBe('共 444 张图片素材');
    expect(modal.contentEl.querySelector('.wechat-material-cache-note').textContent).toBe('当前页列表来自缓存');
    expect(modal.contentEl.textContent).not.toContain('共 444 张图片素材，来自缓存');
    Date.now.mockRestore();
  });
});
