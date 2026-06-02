import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
const { replaceUnuploadedDraftImagesWithPlaceholders, createWechatSyncService } = require('../services/wechat-sync');

describe('Wechat Sync Service', () => {
  function createMockApi() {
    return {
      uploadCover: vi.fn(async () => ({ media_id: 'thumb-1' })),
      uploadImage: vi.fn(async () => ({ url: 'https://wx.image/1' })),
      createDraft: vi.fn(async () => ({ media_id: 'draft-1' })),
      updateDraft: vi.fn(async () => ({ media_id: 'draft-existing' })),
    };
  }

  it('should run full sync pipeline and return cleanup result', async () => {
    const api = createMockApi();
    const createApi = vi.fn(() => api);

    const service = createWechatSyncService({
      createApi,
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>with <svg></svg></p>'),
      processMathFormulas: vi.fn(async () => '<p>done</p>'),
      cleanHtmlForDraft: vi.fn(() => '<p>done</p>'),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: true, success: true })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    const onStatus = vi.fn();
    const onImageProgress = vi.fn();
    const onMathProgress = vi.fn();

    const result = await service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec', author: 'author1' },
      proxyUrl: 'https://proxy.example',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: 'digest',
      onStatus,
      onImageProgress,
      onMathProgress,
    });

    expect(createApi).toHaveBeenCalledWith('wx1', 'sec', 'https://proxy.example');
    expect(api.uploadCover).toHaveBeenCalledTimes(1);
    expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      title: 'note-title',
      thumb_media_id: 'thumb-1',
      author: 'author1',
      digest: 'digest',
      content: '<p>done</p>',
    }));
    expect(result.article).not.toHaveProperty('content_source_url');
    expect(result.article).not.toHaveProperty('need_open_comment');
    expect(result.article).not.toHaveProperty('only_fans_can_comment');
    expect(onStatus).toHaveBeenCalledWith('cover');
    expect(onStatus).toHaveBeenCalledWith('images');
    expect(onStatus).toHaveBeenCalledWith('math');
    expect(onStatus).toHaveBeenCalledWith('draft');
    expect(result.cleanupResult).toEqual({ attempted: true, success: true });
    expect(result.mediaId).toBe('draft-1');
    expect(result.isUpdate).toBe(false);
  });

  it('should update an associated draft instead of creating a new one', async () => {
    const api = createMockApi();
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>x</p>'),
      processMathFormulas: vi.fn(async (html) => html),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: true })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    const result = await service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: '',
      draftMediaId: 'draft-existing',
      draftIndex: 0,
    });

    expect(api.updateDraft).toHaveBeenCalledWith('draft-existing', 0, expect.objectContaining({
      title: 'note-title',
    }));
    expect(api.createDraft).not.toHaveBeenCalled();
    expect(result.mediaId).toBe('draft-existing');
    expect(result.isUpdate).toBe(true);
  });

  it('should reuse material thumb media id without uploading cover', async () => {
    const api = createMockApi();
    const srcToBlob = vi.fn(async () => new Blob(['cover'], { type: 'image/png' }));
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob,
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>x</p>'),
      processMathFormulas: vi.fn(async (html) => html),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: false })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    await service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: '',
      sessionThumbMediaId: 'thumb-from-material',
      sessionDigest: '',
    });

    expect(srcToBlob).not.toHaveBeenCalled();
    expect(api.uploadCover).not.toHaveBeenCalled();
    expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      thumb_media_id: 'thumb-from-material',
    }));
  });

  it('should reuse cached uploaded cover media id across repeated syncs', async () => {
    const api = createMockApi();
    api.uploadCover = vi.fn(async () => ({ media_id: 'thumb-cached' }));
    const coverUploadCache = new Map();
    const srcToBlob = vi.fn(async () => new Blob(['same-cover'], { type: 'image/png' }));
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob,
      coverUploadCache,
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>x</p>'),
      processMathFormulas: vi.fn(async (html) => html),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: false })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    const payload = {
      account: { id: 'acc-1', appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'app://cover.png',
      sessionDigest: '',
    };

    await service.syncToDraft(payload);
    await service.syncToDraft(payload);

    expect(srcToBlob).toHaveBeenCalledTimes(2);
    expect(api.uploadCover).toHaveBeenCalledTimes(1);
    expect(api.createDraft).toHaveBeenNthCalledWith(2, expect.objectContaining({
      thumb_media_id: 'thumb-cached',
    }));
  });

  it('should re-upload cached cover when the source content changes', async () => {
    const api = createMockApi();
    api.uploadCover = vi
      .fn()
      .mockResolvedValueOnce({ media_id: 'thumb-v1' })
      .mockResolvedValueOnce({ media_id: 'thumb-v2' });
    const srcToBlob = vi
      .fn()
      .mockResolvedValueOnce({
        type: 'image/png',
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      })
      .mockResolvedValueOnce({
        type: 'image/png',
        arrayBuffer: async () => new Uint8Array([2]).buffer,
      });
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob,
      coverUploadCache: new Map(),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>x</p>'),
      processMathFormulas: vi.fn(async (html) => html),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: false })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });
    const payload = {
      account: { id: 'acc-1', appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'app://cover.png',
      sessionDigest: '',
    };

    await service.syncToDraft(payload);
    await service.syncToDraft(payload);

    expect(api.uploadCover).toHaveBeenCalledTimes(2);
    expect(api.createDraft).toHaveBeenNthCalledWith(1, expect.objectContaining({
      thumb_media_id: 'thumb-v1',
    }));
    expect(api.createDraft).toHaveBeenNthCalledWith(2, expect.objectContaining({
      thumb_media_id: 'thumb-v2',
    }));
  });

  it('should pass accountId cache context into image processing', async () => {
    const api = createMockApi();
    const createApi = vi.fn(() => api);
    const processAllImages = vi.fn(async () => '<p>x</p>');
    const service = createWechatSyncService({
      createApi,
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages,
      processMathFormulas: vi.fn(async () => '<p>x</p>'),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: false })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    await service.syncToDraft({
      account: { id: 'acc-1', appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: '',
    });

    expect(processAllImages).toHaveBeenCalledWith(
      '<p>x</p>',
      api,
      expect.any(Function),
      expect.objectContaining({
        accountId: 'acc-1',
        onImageFailure: expect.any(Function),
      })
    );
  });

  it('should include account-level publish defaults in draft article when configured', async () => {
    const api = createMockApi();
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>x</p>'),
      processMathFormulas: vi.fn(async () => '<p>x</p>'),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: false })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    await service.syncToDraft({
      account: {
        appId: 'wx1',
        appSecret: 'sec',
        author: 'author1',
        contentSourceUrl: 'https://example.com/source',
        openComment: true,
        onlyFansCanComment: true,
      },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: 'digest',
    });

    expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      content_source_url: 'https://example.com/source',
      need_open_comment: 1,
      only_fans_can_comment: 1,
    }));
    expect(api.createDraft).toHaveBeenCalledWith(expect.not.objectContaining({
      is_open_reward: expect.anything(),
    }));
    expect(api.createDraft).toHaveBeenCalledWith(expect.not.objectContaining({
      need_open_reprint: expect.anything(),
    }));
  });

  it('should throw when no cover source is available', async () => {
    const service = createWechatSyncService({
      createApi: vi.fn(() => createMockApi()),
      srcToBlob: vi.fn(),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(),
      processMathFormulas: vi.fn(),
      cleanHtmlForDraft: vi.fn(),
      cleanupConfiguredDirectory: vi.fn(),
      getFirstImageFromArticle: vi.fn(() => null),
    });

    await expect(service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: null,
      publishMeta: { coverSrc: null },
      sessionCoverBase64: '',
      sessionDigest: '',
    })).rejects.toThrow('未设置封面图，同步失败。请在弹窗中上传封面。');
  });

  it('should replace leftover base64 images with placeholders and still create draft', async () => {
    const api = createMockApi();
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p>x</p>'),
      processMathFormulas: vi.fn(async () => '<p>x</p>'),
      cleanHtmlForDraft: vi.fn(() => '<img src="data:image/png;base64,abc">'),
      cleanupConfiguredDirectory: vi.fn(async () => ({})),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    await service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 't' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: '',
    });

    expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('图片未同步，请在微信后台手动补传'),
    }));
  });

  it('should replace leftover non-WeChat image sources with placeholders and still create draft', async () => {
    const api = createMockApi();
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft: vi.fn(async (html) => html),
      processAllImages: vi.fn(async () => '<p><img src="assets/example-image.png"></p>'),
      processMathFormulas: vi.fn(async (html) => html),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({})),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    await service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<p>x</p>',
      activeFile: { basename: 't' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: '',
    });

    expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('图片未同步，请在微信后台手动补传：assets/example-image.png'),
    }));
  });

  it('replaceUnuploadedDraftImagesWithPlaceholders should allow WeChat CDN images only', () => {
    const output = replaceUnuploadedDraftImagesWithPlaceholders([
      '<p>',
      '<img src="https://mmbiz.qpic.cn/mmbiz_png/ok/0">',
      '<img src="http://mmbiz.qlogo.cn/logo/0">',
      '<img src="https://example.com/not-uploaded.png">',
      '<img src="assets/local.png">',
      '</p>',
    ].join(''));

    expect(output.imageSources).toEqual([
      'https://example.com/not-uploaded.png',
      'assets/local.png',
    ]);
    expect(output.html).toContain('https://mmbiz.qpic.cn/mmbiz_png/ok/0');
    expect(output.html).toContain('http://mmbiz.qlogo.cn/logo/0');
    expect(output.html).not.toContain('https://example.com/not-uploaded.png"');
    expect(output.html).toContain('图片未同步，请在微信后台手动补传');
  });

  it('should keep issue #23 fragment syncable by replacing invalid image srcs', () => {
    const fixture = fs.readFileSync(
      path.resolve(__dirname, 'fixtures/issue-23-invalid-content-fragment.html'),
      'utf8'
    );
    const output = replaceUnuploadedDraftImagesWithPlaceholders(fixture);

    expect(output.imageSources).toEqual(['Note', 'assets/example-image.png']);
    expect(output.html).toContain('https://mmbiz.qpic.cn/mmbiz_png/uploaded/0');
    expect(output.html).not.toContain('src="Note"');
    expect(output.html).not.toContain('src="assets/example-image.png"');
    expect(output.html).toContain('图片未同步，请在微信后台手动补传：Note');
    expect(output.html).toContain('图片未同步，请在微信后台手动补传：assets/example-image.png');
  });

  it('should preprocess draft html before image upload pipeline', async () => {
    const api = createMockApi();
    const prepareHtmlForDraft = vi.fn(async () => '<table><tr><td>code</td></tr></table><img src="data:image/png;base64,mermaid">');
    const processAllImages = vi.fn(async () => '<p>uploaded</p>');
    const service = createWechatSyncService({
      createApi: vi.fn(() => api),
      srcToBlob: vi.fn(async () => new Blob(['cover'], { type: 'image/png' })),
      prepareHtmlForDraft,
      processAllImages,
      processMathFormulas: vi.fn(async (html) => html),
      cleanHtmlForDraft: vi.fn((html) => html),
      cleanupConfiguredDirectory: vi.fn(async () => ({ attempted: false })),
      getFirstImageFromArticle: vi.fn(() => 'app://fallback-cover'),
    });

    await service.syncToDraft({
      account: { appId: 'wx1', appSecret: 'sec' },
      proxyUrl: '',
      currentHtml: '<section class="code-snippet__fix"></section>',
      activeFile: { basename: 'note-title' },
      publishMeta: { coverSrc: null },
      sessionCoverBase64: 'data:image/png;base64,abc',
      sessionDigest: '',
    });

    expect(prepareHtmlForDraft).toHaveBeenCalledWith('<section class="code-snippet__fix"></section>');
    expect(processAllImages).toHaveBeenCalledWith(
      '<table><tr><td>code</td></tr></table><img src="data:image/png;base64,mermaid">',
      api,
      expect.any(Function),
      expect.objectContaining({
        accountId: '',
        onImageFailure: expect.any(Function),
      })
    );
  });
});
