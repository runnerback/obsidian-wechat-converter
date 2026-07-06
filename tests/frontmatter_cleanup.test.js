import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadInputModule } = require('./helpers/input-module.cjs');
describe('AppleStyleView - Frontmatter Meta & Configured Directory Cleanup', () => {
  let AppleStyleView;
  let WechatAPI;
  let view;
  let plugin;
  let frontmatter;
  let files;
  let activeFile;

  beforeEach(() => {
    vi.resetModules();
    const obsidianMock = require('obsidian');
    if (obsidianMock?.Notice?.prototype) {
      if (typeof obsidianMock.Notice.prototype.setMessage !== 'function') {
        obsidianMock.Notice.prototype.setMessage = function noop() {};
      }
      if (typeof obsidianMock.Notice.prototype.hide !== 'function') {
        obsidianMock.Notice.prototype.hide = function noop() {};
      }
    }

    const inputModule = loadInputModule();
    AppleStyleView = inputModule.AppleStyleView;
    WechatAPI = inputModule.WechatAPI;

    plugin = {
      settings: {
        cleanupAfterSync: false,
        cleanupUseSystemTrash: true,
        cleanupDirTemplate: '',
        wechatAccounts: [{
          id: 'acc1',
          name: '测试号',
          appId: 'appid',
          appSecret: 'appsecret',
          author: 'tester',
        }],
        defaultAccountId: 'acc1',
        proxyUrl: '',
      },
    };

    view = new AppleStyleView(null, plugin);
    activeFile = { path: 'published/post.md', basename: 'post' };
    frontmatter = {
      title: '这是 frontmatter 标题',
      excerpt: '这是 frontmatter 摘要',
      cover: 'published/post_img/post-cover.jpg',
      cover_dir: 'published/post_img',
    };

    files = new Map([
      ['published/post_img/post-cover.jpg', { path: 'published/post_img/post-cover.jpg', extension: 'jpg' }],
      ['published/post_img', { path: 'published/post_img' }],
      ['published/single-file.jpg', { path: 'published/single-file.jpg', extension: 'jpg' }],
    ]);

    view.app = {
      metadataCache: {
        getFileCache: vi.fn(() => ({ frontmatter })),
      },
      vault: {
        configDir: '.obsidian',
        getAbstractFileByPath: vi.fn((p) => files.get(p) || null),
        getResourcePath: vi.fn((file) => `app://local/${file.path}`),
        read: vi.fn().mockResolvedValue(''),
        modify: vi.fn().mockResolvedValue(undefined),
        trash: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      fileManager: {
        processFrontMatter: vi.fn(async (_file, updater) => {
          updater(frontmatter);
        }),
      },
      workspace: {
        getActiveFile: vi.fn(() => activeFile),
      },
    };
  });

  it('should read excerpt/cover/cover_dir and resolve cover resource from frontmatter', () => {
    const meta = view.getFrontmatterPublishMeta(activeFile);

    expect(meta.title).toBe('这是 frontmatter 标题');
    expect(meta.excerpt).toBe('这是 frontmatter 摘要');
    expect(meta.cover).toBe('published/post_img/post-cover.jpg');
    expect(meta.cover_dir).toBe('published/post_img');
    expect(meta.coverSrc).toBe('app://local/published/post_img/post-cover.jpg');
  });

  it('should fallback to lastActiveFile when active file is unavailable', () => {
    view.lastActiveFile = activeFile;
    view.app.workspace.getActiveFile = vi.fn(() => null);

    const contextFile = view.getPublishContextFile();

    expect(contextFile).toBe(activeFile);
  });

  it('should fallback silently when frontmatter cover path cannot be resolved', () => {
    files.delete('published/post_img/post-cover.jpg');

    const meta = view.getFrontmatterPublishMeta(activeFile);

    expect(meta.excerpt).toBe('这是 frontmatter 摘要');
    expect(meta.coverSrc).toBeNull();
  });

  it('should read frontmatter keys with case variants', () => {
    frontmatter = {
      Title: '大小写标题',
      Excerpt: '大小写摘要',
      Cover: 'published/post_img/post-cover.jpg',
      CoverDIR: 'published/post_img',
    };
    view.app.metadataCache.getFileCache = vi.fn(() => ({ frontmatter }));

    const meta = view.getFrontmatterPublishMeta(activeFile);
    expect(meta.title).toBe('大小写标题');
    expect(meta.excerpt).toBe('大小写摘要');
    expect(meta.cover).toBe('published/post_img/post-cover.jpg');
    expect(meta.cover_dir).toBe('published/post_img');
  });

  it('should resolve cleanup directory with {{note}} placeholder', () => {
    plugin.settings.cleanupDirTemplate = 'published/{{note}}_img';
    const resolved = view.resolveCleanupDirPath(activeFile);

    expect(resolved.path).toBe('published/post_img');
    expect(resolved.warning).toBeUndefined();
  });

  it('should return warning when {{note}} exists but no active file', () => {
    plugin.settings.cleanupDirTemplate = 'published/{{note}}_img';
    const resolved = view.resolveCleanupDirPath(null);

    expect(resolved.path).toBe('');
    expect(resolved.warning).toContain('{{note}}');
  });

  it('should enforce cleanup dir safety guards', () => {
    expect(view.isSafeCleanupDirPath('published/post_img')).toBe(true);
    expect(view.isSafeCleanupDirPath('published/../secret')).toBe(false);
    expect(view.isSafeCleanupDirPath('.obsidian')).toBe(false);
    expect(view.isSafeCleanupDirPath('')).toBe(false);
  });

  it('should block the active Obsidian config dir when the vault uses a custom configDir', () => {
    view.app.vault.configDir = '.config/obsidian-mobile';

    expect(view.isSafeCleanupDirPath('.config/obsidian-mobile')).toBe(false);
    expect(view.isSafeCleanupDirPath('.config/obsidian-mobile/plugins')).toBe(false);
    expect(view.isSafeCleanupDirPath('.obsidian')).toBe(true);
  });

  it('cleanupConfiguredDirectory is a no-op after the feature was removed', async () => {
    // 「发送成功后自动清理资源」功能已移除：无论旧配置如何，都不再删除任何目录。
    plugin.settings.cleanupAfterSync = true;
    plugin.settings.cleanupUseSystemTrash = true;
    plugin.settings.cleanupDirTemplate = 'published/{{note}}_img';

    const result = await view.cleanupConfiguredDirectory(activeFile);

    expect(result).toEqual({ attempted: false });
    expect(view.app.vault.trash).not.toHaveBeenCalled();
  });

  it('should clear frontmatter paths when cleanup dir matches by tail path', async () => {
    frontmatter = {
      excerpt: '摘要',
      cover: 'published/img/post-cover.jpg',
      cover_dir: 'published/img',
    };
    view.app.metadataCache.getFileCache = vi.fn(() => ({ frontmatter }));

    await view.clearInvalidPublishMetaAfterCleanup(activeFile, 'Wechat/published/img');

    expect(frontmatter.cover).toBe('');
    expect(frontmatter.cover_dir).toBe('');
  });

  it('should fallback to text-based frontmatter cleanup on Obsidian versions without processFrontMatter', async () => {
    delete view.app.fileManager.processFrontMatter;
    view.app.vault.read.mockResolvedValue([
      '---',
      'title: Example',
      'cover: published/post_img/post-cover.jpg',
      'cover_dir: published/post_img',
      'excerpt: keep me',
      '---',
      '',
      'Body',
    ].join('\n'));

    const warning = await view.clearInvalidPublishMetaAfterCleanup(activeFile, 'published/post_img');

    expect(warning).toBeNull();
    expect(view.app.vault.modify).toHaveBeenCalledWith(activeFile, [
      '---',
      'title: Example',
      "cover: ''",
      "cover_dir: ''",
      'excerpt: keep me',
      '---',
      '',
      'Body',
    ].join('\n'));
  });

  it('should not clear remote/data URL values in frontmatter after cleanup', async () => {
    frontmatter = {
      excerpt: '摘要',
      cover: 'https://cdn.example.com/published/img/post-cover.jpg',
      cover_dir: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
    };
    view.app.metadataCache.getFileCache = vi.fn(() => ({ frontmatter }));

    await view.clearInvalidPublishMetaAfterCleanup(activeFile, 'Wechat/published/img');

    expect(frontmatter.cover).toBe('https://cdn.example.com/published/img/post-cover.jpg');
    expect(frontmatter.cover_dir).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA');
  });

  it('should trigger cleanup only after createDraft succeeds', async () => {
    plugin.settings.cleanupAfterSync = true;
    plugin.settings.cleanupDirTemplate = 'published/{{note}}_img';

    view.currentHtml = '<p>正文</p>';
    view.selectedAccountId = 'acc1';
    view.sessionDigest = '摘要';

    view.getFrontmatterPublishMeta = vi.fn(() => ({
      excerpt: '摘要',
      cover: 'published/post_img/post-cover.jpg',
      cover_dir: 'published/post_img',
      coverSrc: 'app://local/published/post_img/post-cover.jpg',
    }));
    view.getFirstImageFromArticle = vi.fn(() => 'app://local/published/post_img/post-cover.jpg');
    view.srcToBlob = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    view.processAllImages = vi.fn().mockResolvedValue('<p>正文</p>');
    view.cleanHtmlForDraft = vi.fn((html) => html);
    view.cleanupConfiguredDirectory = vi.fn().mockResolvedValue({ attempted: true, success: true });

    const uploadCoverSpy = vi.spyOn(WechatAPI.prototype, 'uploadCover').mockResolvedValue({ media_id: 'mid_1' });
    const createDraftSpy = vi.spyOn(WechatAPI.prototype, 'createDraft').mockResolvedValue({});

    await view.onSyncToWechat();

    expect(createDraftSpy).toHaveBeenCalledTimes(1);
    expect(view.cleanupConfiguredDirectory).toHaveBeenCalledTimes(1);
    expect(createDraftSpy.mock.invocationCallOrder[0]).toBeLessThan(view.cleanupConfiguredDirectory.mock.invocationCallOrder[0]);

    uploadCoverSpy.mockRestore();
    createDraftSpy.mockRestore();
  });

  it('should not trigger cleanup when createDraft fails', async () => {
    plugin.settings.cleanupAfterSync = true;
    plugin.settings.cleanupDirTemplate = 'published/{{note}}_img';

    view.currentHtml = '<p>正文</p>';
    view.selectedAccountId = 'acc1';

    view.getFrontmatterPublishMeta = vi.fn(() => ({
      excerpt: '摘要',
      cover: 'published/post_img/post-cover.jpg',
      cover_dir: 'published/post_img',
      coverSrc: 'app://local/published/post_img/post-cover.jpg',
    }));
    view.getFirstImageFromArticle = vi.fn(() => 'app://local/published/post_img/post-cover.jpg');
    view.srcToBlob = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    view.processAllImages = vi.fn().mockResolvedValue('<p>正文</p>');
    view.cleanHtmlForDraft = vi.fn((html) => html);
    view.cleanupConfiguredDirectory = vi.fn();

    const uploadCoverSpy = vi.spyOn(WechatAPI.prototype, 'uploadCover').mockResolvedValue({ media_id: 'mid_1' });
    const createDraftSpy = vi.spyOn(WechatAPI.prototype, 'createDraft').mockRejectedValue(new Error('create failed'));

    await view.onSyncToWechat();

    expect(createDraftSpy).toHaveBeenCalledTimes(1);
    expect(view.cleanupConfiguredDirectory).not.toHaveBeenCalled();

    uploadCoverSpy.mockRestore();
    createDraftSpy.mockRestore();
  });

  it('should use lastActiveFile for sync when active file is unavailable', async () => {
    view.currentHtml = '<p>正文</p>';
    view.selectedAccountId = 'acc1';
    view.lastActiveFile = activeFile;
    view.app.workspace.getActiveFile = vi.fn(() => null);

    const publishMetaSpy = vi.spyOn(view, 'getFrontmatterPublishMeta');
    view.srcToBlob = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    view.processAllImages = vi.fn().mockResolvedValue('<p>正文</p>');
    view.cleanHtmlForDraft = vi.fn((html) => html);
    view.getFirstImageFromArticle = vi.fn(() => 'app://local/published/post_img/post-cover.jpg');

    const uploadCoverSpy = vi.spyOn(WechatAPI.prototype, 'uploadCover').mockResolvedValue({ media_id: 'mid_1' });
    const createDraftSpy = vi.spyOn(WechatAPI.prototype, 'createDraft').mockResolvedValue({});

    await view.onSyncToWechat();

    expect(publishMetaSpy).toHaveBeenCalledWith(activeFile);
    expect(createDraftSpy).toHaveBeenCalledTimes(1);

    uploadCoverSpy.mockRestore();
    createDraftSpy.mockRestore();
  });
});
