import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
const obsidianMock = require('obsidian');

// Mock requestUrl BEFORE requiring modules under test so they destructure the spy
obsidianMock.requestUrl = vi.fn();

let FeishuApiClient;
let stripYamlFrontmatter;
let parseYamlTitle;
let convertWikilinks;
let convertObsidianImageSyntax;
let extractImagesFromMarkdown;
let prepareLocalImagesForFeishu;
let syncNoteToFeishu;
let createDefaultFeishuSyncSettings;

function makePngBytes(width = 100, height = 50) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes.buffer;
}

beforeAll(async () => {
  globalThis.obsidian = obsidianMock;

  const apiMod = await import('../services/feishu-api.js');
  FeishuApiClient = apiMod.FeishuApiClient;

  const processorMod = await import('../services/feishu-markdown-processor.js');
  stripYamlFrontmatter = processorMod.stripYamlFrontmatter;
  parseYamlTitle = processorMod.parseYamlTitle;
  convertWikilinks = processorMod.convertWikilinks;
  convertObsidianImageSyntax = processorMod.convertObsidianImageSyntax;
  extractImagesFromMarkdown = processorMod.extractImagesFromMarkdown;

  const syncMod = await import('../services/feishu-sync.js');
  prepareLocalImagesForFeishu = syncMod.prepareLocalImagesForFeishu;
  syncNoteToFeishu = syncMod.syncNoteToFeishu;

  const settingsMod = await import('../services/feishu-settings.js');
  createDefaultFeishuSyncSettings = settingsMod.createDefaultFeishuSyncSettings;
});

describe('Feishu Markdown Processor', () => {
  it('should strip YAML frontmatter', () => {
    const md = '---\ntitle: "Test Title"\n---\n# Main Content';
    expect(stripYamlFrontmatter(md)).toBe('# Main Content');
  });

  it('should parse YAML title', () => {
    const md = '---\ntitle: "Test Title"\n---\n# Main Content';
    expect(parseYamlTitle(md)).toBe('Test Title');
  });

  it('should convert wikilinks with history matching', () => {
    const history = [{ title: 'Linked Note', url: 'https://feishu.cn/docx/token123' }];
    const md = 'Check [[Linked Note]] and [[Unlinked Note|Alias]]';
    expect(convertWikilinks(md, history)).toBe('Check [Linked Note](https://feishu.cn/docx/token123) and Alias');
  });

  it('should not convert Obsidian image embeds as normal wikilinks', () => {
    const md = 'Local ![[attachments/音乐卡点调整.png|音乐|510]] and [[Unlinked Note|Alias]]';
    expect(convertWikilinks(md, [])).toBe('Local ![[attachments/音乐卡点调整.png|音乐|510]] and Alias');
  });

  it('should convert Obsidian image syntax to standard Markdown image syntax', () => {
    const md = 'Embed ![[photo.png|My Photo]]';
    expect(convertObsidianImageSyntax(md)).toBe('Embed ![My Photo](photo.png)');
  });

  it('should ignore trailing wiki image size hints when converting Obsidian image syntax', () => {
    const md = 'Embed ![[photo.png|封面图|510]]';
    expect(convertObsidianImageSyntax(md)).toBe('Embed ![封面图](photo.png)');
  });

  it('should extract images from Markdown', () => {
    const md = '![Alt](local.png)\n![Remote](https://example.com/remote.jpg)\n![[wiki.png|Wiki]]';
    const images = extractImagesFromMarkdown(md);
    expect(images.length).toBe(3);
    expect(images[0]).toEqual({
      originalSrc: 'local.png',
      path: 'local.png',
      fileName: 'local.png',
      isRemote: false,
      sizeHint: null,
    });
    expect(images[1].isRemote).toBe(true);
    expect(images[2].fileName).toBe('wiki.png');
  });

  it('should extract width hints from markdown images', () => {
    const images = extractImagesFromMarkdown('![封面|320](local.png)\n![[wiki.png|插图|510]]');
    expect(images[0].sizeHint).toEqual({ width: 320, height: null });
    expect(images[1].sizeHint).toBeNull();
  });

  it('should extract asset image placeholders without regex stack overflow', () => {
    const images = extractImagesFromMarkdown('![Local](asset://image-1)');

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      originalSrc: 'asset://image-1',
      fileName: 'image-1',
      isRemote: false,
    });
  });
});

describe('Feishu Api Client', () => {
  beforeEach(() => {
    obsidianMock.requestUrl.mockReset();
    obsidianMock.requestUrl.mockResolvedValue({
      status: 200,
      json: { code: 0, msg: 'success', tenant_access_token: 't-123456', expire: 7200 }
    });
  });

  it('should fetch and cache access token', async () => {
    const client = new FeishuApiClient('appid', 'appsecret');
    const token = await client.getAccessToken();
    expect(token).toBe('t-123456');
    expect(obsidianMock.requestUrl).toHaveBeenCalledTimes(1);

    // Call again, should return cached token
    const cachedToken = await client.getAccessToken();
    expect(cachedToken).toBe('t-123456');
    expect(obsidianMock.requestUrl).toHaveBeenCalledTimes(1);
  });

  it('should handle list folder items', async () => {
    obsidianMock.requestUrl.mockResolvedValue({
      status: 200,
      json: {
        code: 0,
        data: {
          files: [
            { type: 'docx', name: 'My Doc', token: 'doc_token_abc' }
          ]
        }
      }
    });

    const client = new FeishuApiClient('appid', 'appsecret');
    client.accessToken = 't-123';
    client.tokenExpiry = Date.now() + 100000;

    const items = await client.listFolderItems('folder_token_xyz');
    expect(items.length).toBe(1);
    expect(items[0]).toEqual({
      type: 'docx',
      name: 'My Doc',
      token: 'doc_token_abc'
    });
  });

  it('should expose Feishu HTTP error details instead of a generic 400', async () => {
    obsidianMock.requestUrl.mockResolvedValue({
      status: 400,
      json: {
        code: 99991663,
        msg: 'invalid multipart payload',
        request_id: 'req-debug-1',
      },
      text: '',
    });

    const client = new FeishuApiClient('appid', 'appsecret', obsidianMock.requestUrl);
    client.accessToken = 't-123';
    client.tokenExpiry = Date.now() + 100000;

    await expect(client.uploadFile('test.md', 'IyBUZXN0', 'folder-token')).rejects.toThrow(
      '上传飞书临时 Markdown 文件 请求失败，HTTP 400：code 99991663, invalid multipart payload, request_id req-debug-1'
    );
    expect(obsidianMock.requestUrl.mock.calls[0][0].throw).toBe(false);
  });

  it('should safely report non-json Feishu HTTP errors', async () => {
    const response = {
      status: 404,
      text: '404 page not found',
    };
    Object.defineProperty(response, 'json', {
      get() {
        throw new SyntaxError('Unexpected non-whitespace character after JSON');
      },
    });
    obsidianMock.requestUrl.mockResolvedValue(response);

    const client = new FeishuApiClient('appid', 'appsecret', obsidianMock.requestUrl);
    client.accessToken = 't-123';
    client.tokenExpiry = Date.now() + 100000;

    await expect(client.batchDeleteBlocks('doc-token', 'doc-token', 0, 1)).rejects.toThrow(
      '批量删除飞书文档块 请求失败，HTTP 404：404 page not found'
    );
  });

  it('should upload markdown with the original .md filename in multipart payload', async () => {
    obsidianMock.requestUrl.mockResolvedValue({
      status: 200,
      json: { code: 0, data: { file_token: 'temp_file_token' } },
    });

    const client = new FeishuApiClient('appid', 'appsecret', obsidianMock.requestUrl);
    client.accessToken = 't-123';
    client.tokenExpiry = Date.now() + 100000;

    await client.uploadFile('测试.md', 'IyBUZXN0', 'folder-token');

    const request = obsidianMock.requestUrl.mock.calls[0][0];
    const bodyText = new TextDecoder().decode(new Uint8Array(request.body));
    expect(bodyText).toContain('filename="测试.md"');
    expect(bodyText).toContain('Content-Type: text/markdown; charset=utf-8');
    expect(request.throw).toBe(false);
  });

  it('should upload image material with binary bytes and the real mime type', async () => {
    obsidianMock.requestUrl.mockResolvedValue({
      status: 200,
      json: { code: 0, data: { file_token: 'image_token_1' } },
    });

    const client = new FeishuApiClient('appid', 'appsecret', obsidianMock.requestUrl);
    client.accessToken = 't-123';
    client.tokenExpiry = Date.now() + 100000;

    await client.uploadImageMaterialBytes(
      'local.png',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      'doc-token',
      'image-block-id',
      'image/png'
    );

    const request = obsidianMock.requestUrl.mock.calls[0][0];
    const bodyText = new TextDecoder().decode(new Uint8Array(request.body));
    expect(bodyText).toContain('name="parent_type"');
    expect(bodyText).toContain('docx_image');
    expect(bodyText).toContain('name="parent_node"');
    expect(bodyText).toContain('image-block-id');
    expect(bodyText).toContain('filename="local.png"');
    expect(bodyText).toContain('Content-Type: image/png');
    expect(request.throw).toBe(false);
  });

  it('should transfer document ownership with Feishu userid member type', async () => {
    obsidianMock.requestUrl.mockResolvedValue({
      status: 200,
      json: { code: 0, msg: 'success' },
    });

    const client = new FeishuApiClient('appid', 'appsecret', obsidianMock.requestUrl);
    client.accessToken = 't-123';
    client.tokenExpiry = Date.now() + 100000;

    await client.transferDocumentOwnership('doc-token', 'ou-user-123');

    const request = obsidianMock.requestUrl.mock.calls[0][0];
    expect(request.url).toContain('/drive/v1/permissions/doc-token/members/transfer_owner');
    expect(JSON.parse(request.body)).toEqual({
      member_id: 'ou-user-123',
      member_type: 'userid',
    });
  });
});

describe('Feishu Sync Coordinator', () => {
  let app;
  let settings;
  let activeFile;

  beforeEach(() => {
    settings = createDefaultFeishuSyncSettings();
    settings.appId = 'app-id';
    settings.appSecret = 'app-secret';
    settings.folderToken = 'folder-token';

    activeFile = {
      path: 'notes/test-note.md',
      basename: 'test-note',
    };

    app = {
      metadataCache: {
        getFirstLinkpathDest: vi.fn(),
      },
      vault: {
        readBinary: vi.fn(),
      },
    };

    obsidianMock.requestUrl.mockReset();
    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { json: { code: 0, data: { ticket: 'ticket_123' } } };
        } else {
          return { json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
        }
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { json: { code: 0, msg: 'success' } };
      }
      if (url.includes('files?folder_token')) {
        return { json: { code: 0, data: { files: [] } } };
      }
      return { json: { code: 0 } };
    });
  });

  it('should prepare local Markdown images as Feishu replacement assets', async () => {
    const localFile = {
      path: 'notes/attachments/local.png',
      name: 'local.png',
      extension: 'png',
      bytes: makePngBytes(100, 50),
    };
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => (
      linkpath === 'attachments/local.png' ? localFile : null
    ));
    app.vault.getAbstractFileByPath = vi.fn((filePath) => (
      filePath === 'notes/attachments/local.png' ? localFile : null
    ));
    app.vault.getResourcePath = vi.fn(() => 'app://local/local.png');
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    const result = await prepareLocalImagesForFeishu(
      app,
      activeFile,
      '# Test\n![Local](attachments/local.png)\n![Remote](https://cdn.example.com/a.png)'
    );

    expect(result.warnings).toEqual([]);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      filename: 'local.png',
      mimeType: 'image/png',
      base64: 'iVBORw0KGgoAAAAAAAAAAAAAAGQAAAAy',
    });
    expect(result.markdown).toContain('![Local](https://obsidian-wechat-converter.invalid/feishu-local-image/image-1.png)');
    expect(result.markdown).toContain('![Remote](https://cdn.example.com/a.png)');
  });

  it('should prepare Obsidian wiki image embeds with Chinese paths for Feishu replacement', async () => {
    const localFile = {
      path: 'notes/attachments/音乐卡点调整.png',
      name: '音乐卡点调整.png',
      extension: 'png',
      bytes: makePngBytes(100, 50),
    };
    app.metadataCache.getFirstLinkpathDest.mockReturnValue(localFile);
    app.vault.getAbstractFileByPath = vi.fn(() => null);
    app.vault.getResourcePath = vi.fn(() => 'app://local/music.png');
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    const result = await prepareLocalImagesForFeishu(
      app,
      activeFile,
      '![[attachments/音乐卡点调整.png|音乐|510]]'
    );

    expect(result.warnings).toEqual([]);
    expect(result.assets[0]).toMatchObject({
      filename: '音乐卡点调整.png',
      base64: 'iVBORw0KGgoAAAAAAAAAAAAAAGQAAAAy',
    });
    expect(result.markdown).toBe('![音乐](https://obsidian-wechat-converter.invalid/feishu-local-image/image-1.png)');
  });

  it('should skip local GIF files before reading binary for Feishu stability', async () => {
    const gifFile = {
      path: 'notes/attachments/demo.gif',
      name: 'demo.gif',
      extension: 'gif',
      bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38]).buffer,
    };
    app.metadataCache.getFirstLinkpathDest.mockReturnValue(gifFile);
    app.vault.getAbstractFileByPath = vi.fn(() => gifFile);

    const result = await prepareLocalImagesForFeishu(
      app,
      activeFile,
      '![Gif](attachments/demo.gif)'
    );

    expect(result.assets).toHaveLength(0);
    expect(result.markdown).toBe('![Gif](attachments/demo.gif)');
    expect(result.warnings.map((warning) => warning.code)).toEqual(['image_unsupported_for_target']);
    expect(app.vault.readBinary).not.toHaveBeenCalled();
  });

  it('should leave missing local images unchanged and report a warning', async () => {
    app.metadataCache.getFirstLinkpathDest.mockReturnValue(null);
    app.vault.getAbstractFileByPath = vi.fn(() => null);

    const result = await prepareLocalImagesForFeishu(
      app,
      activeFile,
      '![Missing](attachments/missing.png)'
    );

    expect(result.markdown).toBe('![Missing](attachments/missing.png)');
    expect(result.warnings.map((warning) => warning.code)).toEqual(['image_local_missing']);
  });

  it('should import new note successfully', async () => {
    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# Test Note\nSome text.',
    });

    expect(result.docToken).toBe('doc_token_456');
    expect(result.url).toBe('https://feishu.cn/docx/doc_token_456');
    expect(settings.uploadHistory.length).toBe(1);
    expect(settings.uploadHistory[0].docToken).toBe('doc_token_456');
  });

  it('should use the Obsidian file basename as the default Feishu document title', async () => {
    await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# 一级标题\nSome text.',
    });

    const importTaskRequest = obsidianMock.requestUrl.mock.calls.find((call) => (
      call[0].url.includes('import_tasks') && call[0].method === 'POST'
    ))[0];
    expect(JSON.parse(importTaskRequest.body).file_name).toBe('test-note');
  });

  it('should perform smart update for previously synced note', async () => {
    settings.uploadHistory = [{
      title: 'test-note',
      url: 'https://feishu.cn/docx/doc_token_456',
      docToken: 'doc_token_456',
      sourcePath: 'notes/test-note.md',
      uploadTime: '2026-06-19T00:00:00Z',
    }];

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('blocks?page_size')) {
        // Return existing children blocks
        return {
          json: {
            code: 0,
            data: {
              items: [
                { block_id: 'block_child_1', parent_id: 'doc_token_456', block_type: 1 }
              ]
            }
          }
        };
      }
      if (url.includes('children/batch_delete')) {
        return { json: { code: 0 } };
      }
      if (url.includes('blocks/convert')) {
        return { json: { code: 0, data: { blocks: [{ block_type: 2, text: {} }] } } };
      }
      if (url.includes('children?document_revision_id')) {
        return { json: { code: 0 } };
      }
      return { json: { code: 0 } };
    });

    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# test-note\nUpdated content.',
    });

    expect(result.docToken).toBe('doc_token_456');
    expect(settings.uploadHistory.length).toBe(1);
    const calls = obsidianMock.requestUrl.mock.calls;
    expect(calls.some(c => c[0].url.includes('batch_delete'))).toBe(true);
    expect(calls.some(c => c[0].url.includes('children?document_revision_id'))).toBe(true);
  });

  it('should keep the imported document when image block scanning fails after import', async () => {
    const localFile = {
      path: 'notes/attachments/local.png',
      name: 'local.png',
      extension: 'png',
      bytes: makePngBytes(640, 320),
    };
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => (
      linkpath === 'attachments/local.png' ? localFile : null
    ));
    app.vault.getAbstractFileByPath = vi.fn((filePath) => (
      filePath === 'notes/attachments/local.png' ? localFile : null
    ));
    app.vault.getResourcePath = vi.fn(() => 'app://local/local.png');
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 404,
          json: { code: 404, msg: 'document block not found' },
          text: '',
        };
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# Test Note\n![Local](attachments/local.png)',
    });

    expect(result.docToken).toBe('doc_token_456');
    expect(result.url).toBe('https://feishu.cn/docx/doc_token_456');
    expect(settings.uploadHistory.length).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[飞书同步] 图片后处理跳过，文档正文已导入:',
      expect.any(Error)
    );
    expect(result.imageSummary.failed).toBe(1);
    warnSpy.mockRestore();
  });

  it('should upload prepared local image assets and replace Feishu image blocks', async () => {
    const localFile = {
      path: 'notes/attachments/local.png',
      name: 'local.png',
      extension: 'png',
      bytes: makePngBytes(100, 50),
    };
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => (
      linkpath === 'attachments/local.png' ? localFile : null
    ));
    app.vault.getAbstractFileByPath = vi.fn((filePath) => (
      filePath === 'notes/attachments/local.png' ? localFile : null
    ));
    app.vault.getResourcePath = vi.fn(() => 'app://local/local.png');
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 200,
          json: {
            code: 0,
            data: {
              items: [{ block_id: 'image_block_1', parent_id: 'doc_token_456', block_type: 27 }],
            },
          },
        };
      }
      if (url.includes('medias/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'image_token_1' } } };
      }
      if (url.includes('/blocks/image_block_1')) {
        return { status: 200, json: { code: 0, data: {} } };
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# Test Note\n![Local](attachments/local.png)',
    });

    expect(result.docToken).toBe('doc_token_456');
    expect(result.imageSummary).toMatchObject({
      uploaded: 1,
      skipped: 0,
      failed: 0,
    });
    const calls = obsidianMock.requestUrl.mock.calls.map((call) => call[0]);
    const markdownUpload = calls.find((request) => request.url.includes('files/upload_all'));
    const markdownBody = new TextDecoder().decode(new Uint8Array(markdownUpload.body));
    expect(markdownBody).toContain('![Local](https://obsidian-wechat-converter.invalid/feishu-local-image/image-1.png)');
    expect(calls.some((request) => request.url.includes('medias/upload_all'))).toBe(true);
    expect(calls.some((request) => request.url.includes('/blocks/image_block_1') && request.method === 'PATCH')).toBe(true);
    const imagePatch = calls.find((request) => request.url.includes('/blocks/image_block_1') && request.method === 'PATCH');
    expect(JSON.parse(imagePatch.body).replace_image).toEqual({
      token: 'image_token_1',
      width: 100,
      height: 50,
      align: 2,
    });
    const imageUpload = calls.find((request) => request.url.includes('medias/upload_all'));
    const imageUploadBody = new TextDecoder().decode(new Uint8Array(imageUpload.body));
    expect(imageUploadBody).toContain('Content-Type: image/png');
  });

  it('should leave remote images to Feishu import without re-uploading them', async () => {
    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        throw new Error('remote images should not trigger image block replacement');
      }
      return { status: 200, json: { code: 0 } };
    });

    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# Test Note\n![Remote](https://cdn.example.com/a.png)',
    });

    expect(result.imageSummary).toEqual({
      uploaded: 0,
      skipped: 0,
      failed: 0,
      details: [],
    });
    const calls = obsidianMock.requestUrl.mock.calls.map((call) => call[0]);
    expect(calls.some((request) => request.url.includes('medias/upload_all'))).toBe(false);
  });

  it('should replace local images at their original markdown image block positions', async () => {
    const localFile = {
      path: 'notes/attachments/local.png',
      name: 'local.png',
      extension: 'png',
      bytes: makePngBytes(640, 320),
    };
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => (
      linkpath === 'attachments/local.png' ? localFile : null
    ));
    app.vault.getAbstractFileByPath = vi.fn((filePath) => (
      filePath === 'notes/attachments/local.png' ? localFile : null
    ));
    app.vault.getResourcePath = vi.fn(() => 'app://local/local.png');
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 200,
          json: {
            code: 0,
            data: {
              items: [
                { block_id: 'remote_image_block', parent_id: 'doc_token_456', block_type: 27 },
                { block_id: 'local_image_block', parent_id: 'doc_token_456', block_type: 27 },
              ],
            },
          },
        };
      }
      if (url.includes('medias/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'image_token_1' } } };
      }
      if (url.includes('/blocks/local_image_block')) {
        return { status: 200, json: { code: 0, data: {} } };
      }
      if (url.includes('/blocks/remote_image_block')) {
        throw new Error('remote image block must not be replaced by local image upload');
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: [
        '# Test Note',
        '![Remote](https://cdn.example.com/a.png)',
        '![Local](attachments/local.png)',
      ].join('\n'),
    });

    expect(result.imageSummary).toMatchObject({
      uploaded: 1,
      skipped: 0,
      failed: 0,
    });
    const calls = obsidianMock.requestUrl.mock.calls.map((call) => call[0]);
    expect(calls.some((request) => request.url.includes('/blocks/remote_image_block'))).toBe(false);
    expect(calls.some((request) => request.url.includes('/blocks/local_image_block') && request.method === 'PATCH')).toBe(true);
    const imagePatch = calls.find((request) => request.url.includes('/blocks/local_image_block') && request.method === 'PATCH');
    expect(JSON.parse(imagePatch.body).replace_image).toEqual({
      token: 'image_token_1',
      width: 640,
      height: 320,
      align: 2,
    });
  });

  it('should keep wiki image and relative image replacements aligned after a remote image', async () => {
    const wikiFile = {
      path: 'notes/attachments/音乐卡点调整.png',
      name: '音乐卡点调整.png',
      extension: 'png',
      bytes: makePngBytes(1000, 500),
    };
    const relativeFile = {
      path: 'notes/attachments/打工.png',
      name: '打工.png',
      extension: 'png',
      bytes: makePngBytes(800, 400),
    };
    const gifFile = {
      path: 'notes/测试.gif',
      name: '测试.gif',
      extension: 'gif',
      bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38]).buffer,
    };
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => {
      if (linkpath === 'attachments/音乐卡点调整.png') return wikiFile;
      if (linkpath === 'attachments/打工.png') return relativeFile;
      if (linkpath === '测试.gif') return gifFile;
      return null;
    });
    app.vault.getAbstractFileByPath = vi.fn((filePath) => {
      if (filePath === 'notes/attachments/音乐卡点调整.png') return wikiFile;
      if (filePath === 'notes/attachments/打工.png') return relativeFile;
      if (filePath === 'notes/测试.gif') return gifFile;
      return null;
    });
    app.vault.getResourcePath = vi.fn((file) => `app://local/${encodeURIComponent(file.path)}`);
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 200,
          json: {
            code: 0,
            data: {
              items: [
                { block_id: 'remote_image_block', parent_id: 'doc_token_456', block_type: 27 },
                { block_id: 'wiki_image_block', parent_id: 'doc_token_456', block_type: 27 },
                { block_id: 'relative_image_block', parent_id: 'doc_token_456', block_type: 27 },
                { block_id: 'gif_image_block', parent_id: 'doc_token_456', block_type: 27 },
              ],
            },
          },
        };
      }
      if (url.includes('medias/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: url.includes('token-two') ? 'image_token_2' : 'image_token_1' } } };
      }
      if (url.includes('/blocks/wiki_image_block') || url.includes('/blocks/relative_image_block')) {
        return { status: 200, json: { code: 0, data: {} } };
      }
      if (url.includes('/blocks/remote_image_block') || url.includes('/blocks/gif_image_block')) {
        throw new Error('non-local prepared image block must not be replaced');
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: [
        '# Test Note',
        '![Remote](https://cdn.example.com/a.png)',
        '![[attachments/音乐卡点调整.png|音乐|510]]',
        '![测试](attachments/打工.png)',
        '![不对](测试.gif)',
      ].join('\n'),
    });

    expect(result.imageSummary).toMatchObject({
      uploaded: 2,
      skipped: 1,
      failed: 0,
    });
    const calls = obsidianMock.requestUrl.mock.calls.map((call) => call[0]);
    const markdownUpload = calls.find((request) => request.url.includes('files/upload_all'));
    const markdownBody = new TextDecoder().decode(new Uint8Array(markdownUpload.body));
    expect(markdownBody).toContain('![音乐](https://obsidian-wechat-converter.invalid/feishu-local-image/image-1.png)');
    expect(markdownBody).toContain('![测试](https://obsidian-wechat-converter.invalid/feishu-local-image/image-2.png)');
    expect(calls.some((request) => request.url.includes('/blocks/remote_image_block'))).toBe(false);
    expect(calls.some((request) => request.url.includes('/blocks/wiki_image_block') && request.method === 'PATCH')).toBe(true);
    expect(calls.some((request) => request.url.includes('/blocks/relative_image_block') && request.method === 'PATCH')).toBe(true);
    expect(calls.some((request) => request.url.includes('/blocks/gif_image_block'))).toBe(false);
    const wikiPatch = calls.find((request) => request.url.includes('/blocks/wiki_image_block') && request.method === 'PATCH');
    expect(JSON.parse(wikiPatch.body).replace_image).toEqual({
      token: 'image_token_1',
      width: 1000,
      height: 500,
      align: 2,
    });
    const relativePatch = calls.find((request) => request.url.includes('/blocks/relative_image_block') && request.method === 'PATCH');
    expect(JSON.parse(relativePatch.body).replace_image).toEqual({
      token: 'image_token_1',
      width: 800,
      height: 400,
      align: 2,
    });
  });

  it('should report Feishu image progress without exposing filenames', async () => {
    const localFile = {
      path: 'notes/attachments/local.png',
      name: 'local.png',
      extension: 'png',
      bytes: makePngBytes(640, 320),
    };
    app.metadataCache.getFirstLinkpathDest.mockImplementation((linkpath) => (
      linkpath === 'attachments/local.png' ? localFile : null
    ));
    app.vault.getAbstractFileByPath = vi.fn((filePath) => (
      filePath === 'notes/attachments/local.png' ? localFile : null
    ));
    app.vault.getResourcePath = vi.fn(() => 'app://local/local.png');
    app.vault.readBinary.mockImplementation(async (file) => file.bytes);

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 200,
          json: {
            code: 0,
            data: {
              items: [{ block_id: 'image_block_1', parent_id: 'doc_token_456', block_type: 27 }],
            },
          },
        };
      }
      if (url.includes('medias/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'image_token_1' } } };
      }
      if (url.includes('/blocks/image_block_1')) {
        return { status: 200, json: { code: 0, data: {} } };
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const progressMessages = [];
    await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# Test Note\n![Local|320](attachments/local.png)',
      onProgress: (_stage, message) => {
        progressMessages.push(message);
      },
    });

    expect(progressMessages).toContain('正在同步正文图片 (1/1)...');
    expect(progressMessages.some((message) => String(message).includes('local.png'))).toBe(false);
  });

  it('should not upload skipped local GIF placeholders during Feishu image post-processing', async () => {
    const gifFile = {
      path: 'notes/attachments/demo.gif',
      name: 'demo.gif',
      extension: 'gif',
      bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38]).buffer,
    };
    app.metadataCache.getFirstLinkpathDest.mockReturnValue(gifFile);
    app.vault.getAbstractFileByPath = vi.fn(() => gifFile);

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'doc_token_456', url: 'https://feishu.cn/docx/doc_token_456' } } } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 200,
          json: {
            code: 0,
            data: {
              items: [{ block_id: 'image_block_1', parent_id: 'doc_token_456', block_type: 27 }],
            },
          },
        };
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# Test Note\n![Gif](attachments/demo.gif)',
    });

    expect(result.docToken).toBe('doc_token_456');
    expect(result.imageSummary.skipped).toBe(1);
    expect(result.imageSummary.failed).toBe(0);
    expect(app.vault.readBinary).not.toHaveBeenCalled();
    const calls = obsidianMock.requestUrl.mock.calls.map((call) => call[0]);
    expect(calls.some((request) => request.url.includes('medias/upload_all'))).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should fall back to creating a new document when smart update deletion fails', async () => {
    settings.uploadHistory = [{
      title: 'test-note',
      url: 'https://feishu.cn/docx/old_doc_token',
      docToken: 'old_doc_token',
      sourcePath: 'notes/test-note.md',
      uploadTime: '2026-06-19T00:00:00Z',
    }];

    obsidianMock.requestUrl.mockImplementation(async (options) => {
      const url = options.url || '';
      if (url.includes('tenant_access_token')) {
        return { status: 200, json: { code: 0, tenant_access_token: 't-123', expire: 7200 } };
      }
      if (url.includes('blocks?page_size')) {
        return {
          status: 200,
          json: {
            code: 0,
            data: {
              items: [
                { block_id: 'old_child_1', parent_id: 'old_doc_token', block_type: 1 },
              ],
            },
          },
        };
      }
      if (url.includes('children/batch_delete')) {
        return {
          status: 404,
          text: '404 page not found',
        };
      }
      if (url.includes('files/upload_all')) {
        return { status: 200, json: { code: 0, data: { file_token: 'temp_file_token' } } };
      }
      if (url.includes('import_tasks')) {
        if (options.method === 'POST') {
          return { status: 200, json: { code: 0, data: { ticket: 'ticket_123' } } };
        }
        return { status: 200, json: { code: 0, data: { result: { job_status: 0, token: 'new_doc_token', url: 'https://feishu.cn/docx/new_doc_token' } } } };
      }
      if (url.includes('permissions') && url.includes('transfer_owner')) {
        return { status: 200, json: { code: 0, msg: 'success' } };
      }
      return { status: 200, json: { code: 0 } };
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await syncNoteToFeishu({
      app,
      settings,
      activeFile,
      markdown: '# test-note\nUpdated content.',
    });

    expect(result.docToken).toBe('new_doc_token');
    expect(result.url).toBe('https://feishu.cn/docx/new_doc_token');
    expect(settings.uploadHistory[0].docToken).toBe('new_doc_token');
    expect(warnSpy).toHaveBeenCalledWith(
      '[飞书同步] 智能覆盖更新失败，降级为新建文档:',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
