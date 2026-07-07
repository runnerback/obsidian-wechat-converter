// 小红书图卡发布链路(services/rednote-publish.js)单测:
// 正文截取 / 标题截取 / article 组装 / sync-to-rednote 落盘(清空重写)。
import { describe, it, expect, vi } from 'vitest';
import {
  extractRednoteBody,
  extractRednoteTitle,
  rednoteCardFilename,
  syncCardsToRednoteFolder,
  buildRednoteArticle,
  findXiaohongshuPlatformId,
} from '../services/rednote-publish.js';

const SAMPLE = `# FSD市区实测：偏弱但能用🔍

> 发布时复制下面这段作为笔记正文：

自己拿Model Y实测了一圈市区FSD，说几个真实感受。🚗

先说优点：无保护左转是真果断。

#特斯拉FSD #智能驾驶

> 下面每个二级标题（##）＝ 一张图，可在 Obsidian 用 **Note to RED** 编辑后自行导出/调整：

## 先说结论🎯
内容一
`;

describe('extractRednoteBody - 截取小红书正文', () => {
  it('取第一个标记行之后到下一个引用行之前(不含标记)', () => {
    const body = extractRednoteBody(SAMPLE);
    expect(body.startsWith('自己拿Model Y实测了一圈市区FSD')).toBe(true);
    expect(body.endsWith('#特斯拉FSD #智能驾驶')).toBe(true);
    expect(body).not.toContain('发布时复制');
    expect(body).not.toContain('下面每个二级标题');
    expect(body).not.toContain('先说结论');
  });

  it('标记后没有下一个引用行时取到文末', () => {
    const md = '> 发布时复制下面这段作为笔记正文：\n\n正文A\n正文B\n';
    expect(extractRednoteBody(md)).toBe('正文A\n正文B');
  });

  it('半角冒号的标记也识别', () => {
    const md = '> 发布时复制下面这段作为笔记正文:\n正文';
    expect(extractRednoteBody(md)).toBe('正文');
  });

  it('找不到标记返回空串(不做兜底)', () => {
    expect(extractRednoteBody('# 标题\n普通内容')).toBe('');
    expect(extractRednoteBody('')).toBe('');
  });
});

describe('extractRednoteTitle - 标题截取', () => {
  it('取第一个 H1', () => {
    expect(extractRednoteTitle(SAMPLE)).toBe('FSD市区实测：偏弱但能用🔍');
  });
  it('无 H1 返回空串', () => {
    expect(extractRednoteTitle('## 二级\n内容')).toBe('');
  });
});

describe('buildRednoteArticle - 桥接 article 组装', () => {
  const cards = [
    { base64: 'AAA', size: 3 },
    { base64: 'BBB', size: 3 },
  ];

  it('assets 满足桥接校验字段(filename/mimeType/size/base64)且命名 card_XX', () => {
    const article = buildRednoteArticle({ title: 'T', body: '正文', cards, notePath: 'a/b.md' });
    expect(article.assets).toHaveLength(2);
    expect(article.assets[0]).toMatchObject({
      id: 'image-0',
      filename: 'synced-rednote-card_00.png',
      mimeType: 'image/png',
      size: 3,
      base64: 'AAA',
    });
    expect(article.assets[1].filename).toBe('synced-rednote-card_01.png');
  });

  it('markdown = 正文 + asset:// 图片引用;cover = 第一张卡', () => {
    const article = buildRednoteArticle({ title: 'T', body: '正文', cards });
    expect(article.markdown).toContain('正文');
    expect(article.markdown).toContain('![synced-rednote-card_00.png](asset://image-0)');
    expect(article.markdown).toContain('![synced-rednote-card_01.png](asset://image-1)');
    expect(article.cover).toBe('asset://image-0');
    expect(article.content).toContain('<img src="asset://image-0"');
  });
});

describe('findXiaohongshuPlatformId - 平台匹配', () => {
  it('按 id 含 xiaohongshu / 名称含小红书 匹配', () => {
    expect(findXiaohongshuPlatformId([{ id: 'zhihu', name: '知乎' }, { id: 'xiaohongshu', name: '小红书' }])).toBe('xiaohongshu');
    expect(findXiaohongshuPlatformId([{ id: 'xhs-web', name: 'RED' }])).toBe('');
    expect(findXiaohongshuPlatformId([{ id: 'xhs', name: 'RED' }])).toBe('xhs');
    expect(findXiaohongshuPlatformId([{ id: 'red-1', name: '小红书笔记' }])).toBe('red-1');
  });
  it('列表为空/无匹配返回空串', () => {
    expect(findXiaohongshuPlatformId([])).toBe('');
    expect(findXiaohongshuPlatformId(null)).toBe('');
  });
});

describe('rednoteCardFilename', () => {
  it('两位补零', () => {
    expect(rednoteCardFilename(0)).toBe('synced-rednote-card_00.png');
    expect(rednoteCardFilename(11)).toBe('synced-rednote-card_11.png');
  });
});

describe('syncCardsToRednoteFolder - 落盘(先清空再写)', () => {
  function makeApp({ existingChildren = null } = {}) {
    const folder = existingChildren ? { children: [...existingChildren] } : null;
    return {
      vault: {
        getAbstractFileByPath: vi.fn(() => folder),
        createFolder: vi.fn(async () => {}),
        createBinary: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
        adapter: { exists: vi.fn(async () => !!folder) },
      },
    };
  }

  const noteFile = { parent: { path: 'notes/文章目录/01 小红书' } };

  it('目录不存在时创建并写入 card_XX.png', async () => {
    const app = makeApp();
    const dir = await syncCardsToRednoteFolder(app, noteFile, [new ArrayBuffer(1), new ArrayBuffer(1)]);
    expect(dir).toBe('notes/文章目录/01 小红书/sync-to-rednote');
    expect(app.vault.createFolder).toHaveBeenCalledWith(dir);
    expect(app.vault.createBinary).toHaveBeenCalledTimes(2);
    expect(app.vault.createBinary.mock.calls[0][0]).toBe(`${dir}/synced-rednote-card_00.png`);
    expect(app.vault.createBinary.mock.calls[1][0]).toBe(`${dir}/synced-rednote-card_01.png`);
  });

  it('目录已存在时先清空其中文件再写入', async () => {
    const oldFiles = [{ path: 'x/synced-rednote-card_00.png' }, { path: 'x/other.jpg' }];
    const app = makeApp({ existingChildren: oldFiles });
    await syncCardsToRednoteFolder(app, noteFile, [new ArrayBuffer(1)]);
    expect(app.vault.delete).toHaveBeenCalledTimes(2);
    expect(app.vault.createFolder).not.toHaveBeenCalled();
    expect(app.vault.createBinary).toHaveBeenCalledTimes(1);
  });
});
