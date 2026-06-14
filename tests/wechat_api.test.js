import { describe, it, expect, beforeEach, vi } from 'vitest';

// Note: We don't use vi.mock('obsidian') here because we use the alias in vitest.config.mjs
// to resolve 'obsidian' to our __mocks__/obsidian.js file.
// To mock specific methods like requestUrl, we modify the required module object directly
// BEFORE importing the module under test (input.js).

describe('WechatAPI - Upload & MIME Logic', () => {
  let WechatAPI;
  let AppleStyleView;
  let obsidianMock;

  beforeEach(async () => {
    // 1. Reset modules to ensure we get a fresh import of input.js
    vi.resetModules();

    // 2. Get the obsidian mock object (resolved via alias)
    obsidianMock = require('obsidian');

    // 3. Setup the spy on requestUrl
    // We overwrite the method on the exported object so that when input.js
    // does `const { requestUrl } = require('obsidian')`, it grabs this spy.
    obsidianMock.requestUrl = vi.fn().mockResolvedValue({
      json: {},
      status: 200,
      headers: {}
    });

    // 4. Import the module under test
    // This must happen AFTER mocking obsidian.requestUrl
    const inputModule = require('../input.js');
    WechatAPI = inputModule.WechatAPI;
    AppleStyleView = inputModule.AppleStyleView;
  });

  // === Task A: Proxy Upload Optimization (FileReader) ===
  it('should use FileReader for proxy uploads (Perf Optimization)', async () => {
    const api = new WechatAPI('appid', 'secret', 'https://proxy.com');
    const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });

    obsidianMock.requestUrl.mockResolvedValue({
      json: { media_id: '123', url: 'http://img.com' }
    });

    await api.uploadMultipart('http://wx-api.com', mockBlob, 'media');

    expect(obsidianMock.requestUrl).toHaveBeenCalledTimes(1);
    const callArg = obsidianMock.requestUrl.mock.calls[0][0];
    const body = JSON.parse(callArg.body);

    expect(body.method).toBe('UPLOAD');
    expect(body.fileData).toBe('ZmFrZS1pbWFnZS1kYXRh');
  });

  // === Task B: Remote MIME Parsing ===
  it('should detect MIME type from headers for http images', async () => {
    const view = new AppleStyleView(null, null);

    obsidianMock.requestUrl.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { 'content-type': 'image/gif' }
    });

    const blob = await view.srcToBlob('http://example.com/anim.gif');
    expect(blob.type).toBe('image/gif');
  });

  it('should fallback to image/jpeg if header is missing', async () => {
    const view = new AppleStyleView(null, null);

    obsidianMock.requestUrl.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: {}
    });

    const blob = await view.srcToBlob('http://example.com/unknown.jpg');
    expect(blob.type).toBe('image/jpeg');
  });

  it('should handle Content-Type case insensitively', async () => {
    const view = new AppleStyleView(null, null);

    obsidianMock.requestUrl.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { 'Content-Type': 'image/png' }
    });

    const blob = await view.srcToBlob('http://example.com/icon.png');
    expect(blob.type).toBe('image/png');
  });

  it('should request permanent image materials with pagination', async () => {
    const api = new WechatAPI('appid', 'secret');
    api.accessToken = 'token-1';
    api.expireTime = Date.now() + 3600_000;
    obsidianMock.requestUrl.mockResolvedValue({
      json: { item: [], item_count: 0, total_count: 0 }
    });

    await api.batchGetMaterials('image', 20, 10);

    expect(obsidianMock.requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=token-1',
      method: 'POST',
      body: JSON.stringify({ type: 'image', offset: 20, count: 10 }),
    }));
  });

  it('should request draft count, list, and detail with expected bodies', async () => {
    const api = new WechatAPI('appid', 'secret');
    api.accessToken = 'token-1';
    api.expireTime = Date.now() + 3600_000;
    obsidianMock.requestUrl.mockResolvedValue({ json: { total_count: 1, item: [] } });

    await api.getDraftCount();
    await api.batchGetDrafts(40, 20, 1);
    await api.getDraft('draft-media');

    expect(obsidianMock.requestUrl).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: 'https://api.weixin.qq.com/cgi-bin/draft/count?access_token=token-1',
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(obsidianMock.requestUrl).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: 'https://api.weixin.qq.com/cgi-bin/draft/batchget?access_token=token-1',
      method: 'POST',
      body: JSON.stringify({ offset: 40, count: 20, no_content: 1 }),
    }));
    expect(obsidianMock.requestUrl).toHaveBeenNthCalledWith(3, expect.objectContaining({
      url: 'https://api.weixin.qq.com/cgi-bin/draft/get?access_token=token-1',
      method: 'POST',
      body: JSON.stringify({ media_id: 'draft-media' }),
    }));
  });

  it('should update draft without network retry wrapper', async () => {
    const api = new WechatAPI('appid', 'secret');
    api.accessToken = 'token-1';
    api.expireTime = Date.now() + 3600_000;
    const requestWithRetrySpy = vi.spyOn(api, 'requestWithRetry');
    obsidianMock.requestUrl.mockResolvedValue({ json: { errcode: 0, errmsg: 'ok' } });

    const result = await api.updateDraft('draft-media', 0, { title: 'Title' });

    expect(result).toEqual({ media_id: 'draft-media' });
    expect(requestWithRetrySpy).not.toHaveBeenCalled();
    expect(obsidianMock.requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.weixin.qq.com/cgi-bin/draft/update?access_token=token-1',
      method: 'POST',
      body: JSON.stringify({
        media_id: 'draft-media',
        index: 0,
        articles: { title: 'Title' },
      }),
    }));
  });

  it('should include X-Client-Id header in sendRequest when clientId is provided and proxy is used', async () => {
    const api = new WechatAPI('appid', 'secret', 'https://proxy.com', 'client-123456');
    obsidianMock.requestUrl.mockResolvedValue({ json: { success: true } });

    await api.sendRequest('https://api.weixin.qq.com/test');

    expect(obsidianMock.requestUrl).toHaveBeenCalledTimes(1);
    expect(obsidianMock.requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://proxy.com',
      headers: expect.objectContaining({
        'X-Client-Id': 'client-123456'
      })
    }));
  });

  it('should include X-Client-Id header in uploadMultipart when clientId is provided and proxy is used', async () => {
    const api = new WechatAPI('appid', 'secret', 'https://proxy.com', 'client-123456');
    const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    obsidianMock.requestUrl.mockResolvedValue({ json: { url: 'http://wx.com', media_id: 'media-123' } });

    await api.uploadMultipart('https://api.weixin.qq.com/upload', mockBlob, 'media');

    expect(obsidianMock.requestUrl).toHaveBeenCalledTimes(1);
    expect(obsidianMock.requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://proxy.com',
      headers: expect.objectContaining({
        'X-Client-Id': 'client-123456'
      })
    }));
  });

  it('should NOT include X-Client-Id header when clientId is empty', async () => {
    const api = new WechatAPI('appid', 'secret', 'https://proxy.com', '');
    obsidianMock.requestUrl.mockResolvedValue({ json: { success: true } });

    await api.sendRequest('https://api.weixin.qq.com/test');

    expect(obsidianMock.requestUrl).toHaveBeenCalledTimes(1);
    const callArg = obsidianMock.requestUrl.mock.calls[0][0];
    expect(callArg.headers).not.toHaveProperty('X-Client-Id');
  });
});
