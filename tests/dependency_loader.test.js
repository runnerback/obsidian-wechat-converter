import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  getAvatarSrc,
  toThemeOptions,
  buildRenderRuntime,
  readEmbeddedOrFile,
} = require('../services/dependency-loader');

describe('Dependency Loader Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.window = {};
    delete global.markdownit;
    delete global.hljs;
    delete global.window.markdownit;
    delete global.window.hljs;
    delete global.window.ObsidianWechatMath;
    delete global.window.AppleTheme;
    delete global.window.AppleStyleConverter;
  });

  it('getAvatarSrc should honor watermark + base64 priority', () => {
    expect(getAvatarSrc({ enableWatermark: false, avatarBase64: 'a', avatarUrl: 'b' })).toBe('');
    expect(getAvatarSrc({ enableWatermark: true, avatarBase64: 'base64://x', avatarUrl: 'https://x' })).toBe('base64://x');
    expect(getAvatarSrc({ enableWatermark: true, avatarBase64: '', avatarUrl: 'https://x' })).toBe('https://x');
  });

  it('toThemeOptions should map settings fields', () => {
    const opts = toThemeOptions({
      theme: 'wechat',
      themeColor: 'blue',
      customColor: '#000',
      quoteCalloutStyleMode: 'neutral',
      fontFamily: 'serif',
      fontSize: 4,
      macCodeBlock: false,
      codeLineNumber: true,
      sidePadding: 24,
      coloredHeader: true,
    });

    expect(opts).toEqual({
      theme: 'wechat',
      themeColor: 'blue',
      customColor: '#000',
      quoteCalloutStyleMode: 'neutral',
      fontFamily: 'serif',
      fontSize: 4,
      macCodeBlock: false,
      codeLineNumber: true,
      sidePadding: 24,
      coloredHeader: true,
    });
  });

  it('buildRenderRuntime should construct runtime without dynamic script injection', async () => {
    const read = vi.fn(async () => {
      throw new Error('adapter.read should not be used by static runtime loading');
    });
    const exists = vi.fn(async () => {
      throw new Error('adapter.exists should not be used by static runtime loading');
    });
    const createElement = vi.spyOn(document, 'createElement');

    const settings = {
      theme: 'wechat',
      themeColor: 'blue',
      customColor: '#0366d6',
      fontFamily: 'sans-serif',
      fontSize: 3,
      macCodeBlock: true,
      codeLineNumber: true,
      sidePadding: 16,
      coloredHeader: false,
      enableWatermark: true,
      avatarBase64: 'data:image/png;base64,abc',
      avatarUrl: 'https://example.com/avatar.png',
      showImageCaption: true,
    };

    const runtime = await buildRenderRuntime({
      settings,
      app: { name: 'mock-app' },
      adapter: { read, exists },
      basePath: '/plugin',
    });

    expect(runtime.theme).toBeTruthy();
    expect(runtime.converter).toBeTruthy();
    expect(runtime.theme.themeName).toBe('wechat');
    expect(runtime.converter.avatarSrc).toBe('data:image/png;base64,abc');
    expect(runtime.converter.showImageCaption).toBe(true);
    expect(runtime.converter.md).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
    expect(exists).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalledWith('script');
  });

  it('buildRenderRuntime should not fallback to release-external adapter source files', async () => {
    const read = vi.fn(async (path) => {
      if (path.endsWith('/lib/markdown-it.min.js')) return '__MD__';
      if (path.endsWith('/lib/highlight.min.js')) return '__HLJS__';
      if (path.endsWith('/lib/mathjax-plugin.js')) return '__MATH__';
      if (path.endsWith('/themes/apple-theme.js')) return '__THEME__';
      if (path.endsWith('/converter.js')) return '__CONVERTER__';
      throw new Error(`Unexpected read path: ${path}`);
    });

    const exists = vi.fn(async (path) => path.endsWith('/lib/mathjax-plugin.js'));

    const settings = {
      theme: 'wechat',
      themeColor: 'blue',
      customColor: '#0366d6',
      fontFamily: 'sans-serif',
      fontSize: 3,
      macCodeBlock: true,
      codeLineNumber: true,
      sidePadding: 16,
      coloredHeader: false,
      enableWatermark: true,
      avatarBase64: 'data:image/png;base64,abc',
      avatarUrl: 'https://example.com/avatar.png',
      showImageCaption: true,
    };

    const runtime = await buildRenderRuntime({
      settings,
      app: { name: 'mock-app' },
      adapter: { read, exists },
      basePath: '/plugin',
    });

    expect(runtime.theme).toBeTruthy();
    expect(runtime.converter).toBeTruthy();
    expect(runtime.theme.themeName).toBe('wechat');
    expect(runtime.converter.avatarSrc).toBe('data:image/png;base64,abc');
    expect(runtime.converter.showImageCaption).toBe(true);
    expect(runtime.converter.md).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
    expect(exists).not.toHaveBeenCalled();
  });

  it('readEmbeddedOrFile should throw for missing required source without adapter', async () => {
    await expect(
      readEmbeddedOrFile({
        key: 'converter',
        path: '/missing/converter.js',
        embeddedScripts: {},
      })
    ).rejects.toThrow('Missing embedded script and file adapter');
  });
});
