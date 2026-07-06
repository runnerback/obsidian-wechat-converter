import { describe, it, expect } from 'vitest';
import { stripTitleTimecode } from '../services/title-polish.js';

describe('stripTitleTimecode - 移除标题时间码 (MM-DD-HHMM)', () => {
  it('移除开头的半角时间码', () => {
    expect(stripTitleTimecode('(07-02-1936)FSD 入欧与土耳其市场预判')).toBe('FSD 入欧与土耳其市场预判');
  });

  it('移除开头的全角时间码', () => {
    expect(stripTitleTimecode('（07-02-1936）FSD 入欧')).toBe('FSD 入欧');
  });

  it('时间码后带空格时不留多余空格', () => {
    expect(stripTitleTimecode('(07-03-0940) 特斯拉周报')).toBe('特斯拉周报');
  });

  it('时间码出现在中间也移除', () => {
    expect(stripTitleTimecode('特斯拉(07-02-1936)周报')).toBe('特斯拉周报');
  });

  it('多个时间码全部移除', () => {
    expect(stripTitleTimecode('(07-02-1936)标题(07-03-0940)')).toBe('标题');
  });

  it('不含时间码的标题原样返回', () => {
    expect(stripTitleTimecode('FSD 入欧与土耳其市场预判')).toBe('FSD 入欧与土耳其市场预判');
  });

  it('不误伤非时间码的普通括号内容', () => {
    expect(stripTitleTimecode('特斯拉(欧洲版)周报')).toBe('特斯拉(欧洲版)周报');
    expect(stripTitleTimecode('(2024-01-01)非法格式')).toBe('(2024-01-01)非法格式');
  });

  it('空/无效输入返回空串', () => {
    expect(stripTitleTimecode('')).toBe('');
    expect(stripTitleTimecode(null)).toBe('');
    expect(stripTitleTimecode(undefined)).toBe('');
  });
});
