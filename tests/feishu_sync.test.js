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
let syncNoteToFeishu;
let createDefaultFeishuSyncSettings;

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

  it('should convert Obsidian image syntax to standard Markdown image syntax', () => {
    const md = 'Embed ![[photo.png|My Photo]]';
    expect(convertObsidianImageSyntax(md)).toBe('Embed ![My Photo](photo.png)');
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
    });
    expect(images[1].isRemote).toBe(true);
    expect(images[2].fileName).toBe('wiki.png');
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
});
