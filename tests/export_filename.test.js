// 导出文件名清洗:移除 emoji/全角标点等特殊符号,空格统一转 _,保证落盘正常显示
import { describe, it, expect } from 'vitest';
import { sanitizeExportFilename } from '../rednote/downloadManager.ts';

describe('sanitizeExportFilename', () => {
  it('移除 emoji 与全角标点,空格转 _(用户实测用例)', () => {
    expect(sanitizeExportFilename('赛博皮卡智驾实测🚀FSD v14到底多能打？'))
      .toBe('赛博皮卡智驾实测_FSD_v14到底多能打');
  });

  it('保留中英文/数字/-/_,空格全部转 _', () => {
    expect(sanitizeExportFilename('我的笔记 note-01_final')).toBe('我的笔记_note-01_final');
  });

  it('连续特殊符号折叠为单个 _ 并去首尾', () => {
    expect(sanitizeExportFilename('!!标题：《测试》!!')).toBe('标题_测试');
  });

  it('结果不含空格', () => {
    expect(sanitizeExportFilename('a b  c　d')).not.toMatch(/\s/);
  });

  it('全部被清掉时回退默认名', () => {
    expect(sanitizeExportFilename('🚀🎉！？')).toBe('小红书笔记');
  });
});
