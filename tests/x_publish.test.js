// X 草稿发布纯逻辑单测:正文复用小红书标记块、文件名/目录/article 组装
import { describe, it, expect } from 'vitest';
import {
  extractXBody,
  xCardFilename,
  findXPlatformId,
  buildXArticle,
} from '../services/x-publish.js';

describe('x-publish', () => {
  it('extractXBody 复用小红书「> 发布正文：」标记块', () => {
    const md = [
      '# 标题',
      '',
      '> 发布时复制下面这段作为笔记正文：',
      '',
      '这是推文正文第一段。',
      '第二行。',
      '',
      '> 下面是图卡：',
      '## 图一',
    ].join('\n');
    expect(extractXBody(md)).toBe('这是推文正文第一段。\n第二行。');
  });

  it('extractXBody 缺标记返回空串(调用方据此报错)', () => {
    expect(extractXBody('# 只有标题\n正文')).toBe('');
  });

  it('xCardFilename 用 synced-x-card_NN.png 命名', () => {
    expect(xCardFilename(0)).toBe('synced-x-card_00.png');
    expect(xCardFilename(12)).toBe('synced-x-card_12.png');
  });

  it('findXPlatformId 识别 id/name 为 x 或 twitter', () => {
    expect(findXPlatformId([{ id: 'x', name: 'X' }])).toBe('x');
    expect(findXPlatformId([{ id: 'twitter', name: 'Twitter' }])).toBe('twitter');
    expect(findXPlatformId([{ id: 'weixin', name: '公众号' }])).toBe('');
    expect(findXPlatformId(null)).toBe('');
  });

  it('buildXArticle: markdown=正文+图卡引用,assets 带 base64,封面=首图', () => {
    const article = buildXArticle({
      title: '我的推文',
      body: '推文正文',
      cards: [
        { base64: 'AAAA', size: 100 },
        { base64: 'BBBB', size: 200 },
      ],
      notePath: 'note.md',
    });
    expect(article.title).toBe('我的推文');
    expect(article.markdown).toContain('推文正文');
    expect(article.markdown).toContain('![synced-x-card_00.png](asset://image-0)');
    expect(article.markdown).toContain('![synced-x-card_01.png](asset://image-1)');
    expect(article.assets).toHaveLength(2);
    expect(article.assets[0]).toMatchObject({ id: 'image-0', filename: 'synced-x-card_00.png', base64: 'AAAA' });
    expect(article.cover).toBe('asset://image-0');
  });

  it('buildXArticle: 无图卡时封面为空', () => {
    const article = buildXArticle({ title: 't', body: 'b', cards: [] });
    expect(article.cover).toBe('');
    expect(article.assets).toHaveLength(0);
  });
});
