import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { preprocessMarkdownForNative } from '../services/native-renderer';

describe('Task List Rendering & Styling', () => {
  let converter;

  beforeAll(async () => {
    if (typeof window === 'undefined') {
      global.window = global;
    }

    global.markdownit = require('../lib/markdown-it.min.js');
    global.hljs = require('../lib/highlight.min.js');
    require('../lib/mathjax-plugin.js');

    const themeCode = fs.readFileSync(path.resolve(__dirname, '../themes/apple-theme.js'), 'utf8');
    const converterCode = fs.readFileSync(path.resolve(__dirname, '../converter.js'), 'utf8');
    (0, eval)(themeCode);
    (0, eval)(converterCode);

    const theme = new window.AppleTheme({
      theme: 'wechat',
      themeColor: 'blue',
      fontSize: 3,
      macCodeBlock: true,
      codeLineNumber: true,
      sidePadding: 16,
      coloredHeader: false,
    });

    converter = new window.AppleStyleConverter(theme, '', true, null, '');
    await converter.initMarkdownIt();
  });

  it('should render unchecked task list item correctly with custom styled checkbox and list-style: none', async () => {
    const input = '- [ ] 待办任务事项';
    const preprocessed = preprocessMarkdownForNative(input);
    expect(preprocessed).toBe('- ☐ 待办任务事项');

    const html = await converter.convert(preprocessed);
    
    // Check that list-style-type: none and margin-left: -20px are applied to the <li> element
    expect(html).toContain('list-style-type: none');
    expect(html).toContain('margin-left: -20px');

    // Check that the checkbox is styled in a span with the theme color
    expect(html).toContain('<span style="display: inline-block; font-size: 1.15em; font-weight: bold; margin-right: 6px; vertical-align: -0.05em; color: #0366d6; line-height: 1;">☐</span>');
    expect(html).toContain('待办任务事项');
  });

  it('should render checked task list item correctly with strikethrough and gray color for text', async () => {
    const input = '- [x] 已完成任务事项';
    const preprocessed = preprocessMarkdownForNative(input);
    expect(preprocessed).toBe('- ☑ 已完成任务事项');

    const html = await converter.convert(preprocessed);

    // Check list item styling
    expect(html).toContain('list-style-type: none');
    expect(html).toContain('margin-left: -20px');

    // Check checkbox styling
    expect(html).toContain('<span style="display: inline-block; font-size: 1.15em; font-weight: bold; margin-right: 6px; vertical-align: -0.05em; color: #8f959e; line-height: 1;">☑</span>');
    
    // Check text is wrapped with strikethrough and gray color
    expect(html).toContain('<span style="text-decoration: line-through; color: #8f959e;">已完成任务事项</span>');
  });

  it('should render checked task list item containing bold text correctly', async () => {
    const input = '- [x] **重要** 任务事项';
    const preprocessed = preprocessMarkdownForNative(input);
    const html = await converter.convert(preprocessed);

    // Check checkbox styling
    expect(html).toContain('<span style="display: inline-block; font-size: 1.15em; font-weight: bold; margin-right: 6px; vertical-align: -0.05em; color: #8f959e; line-height: 1;">☑</span>');
    
    // Check that both strong text and regular text are wrapped inside the strikethrough span
    expect(html).toContain('<span style="text-decoration: line-through; color: #8f959e;"><strong');
    expect(html).toContain('重要</strong> 任务事项</span>');
  });
});
