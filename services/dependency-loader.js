function getRuntimeGlobal() {
  if (typeof window !== 'undefined' && window) return window;
  return null;
}

function assignRuntimeGlobal(name, value) {
  const runtimeGlobal = getRuntimeGlobal();
  if (runtimeGlobal) {
    runtimeGlobal[name] = value;
    if (runtimeGlobal.window && runtimeGlobal.window !== runtimeGlobal) {
      runtimeGlobal.window[name] = value;
    }
  }
}

function loadRuntimeDependencies() {
  const runtimeGlobal = getRuntimeGlobal();
  if (!runtimeGlobal) {
    throw new Error('Runtime global object is required to load converter dependencies');
  }

  if (typeof runtimeGlobal.markdownit === 'undefined') {
    assignRuntimeGlobal('markdownit', require('../lib/markdown-it.min.js'));
  }

  if (typeof runtimeGlobal.hljs === 'undefined') {
    assignRuntimeGlobal('hljs', require('../lib/highlight.min.js'));
  }

  if (typeof runtimeGlobal.ObsidianWechatMath === 'undefined') {
    require('../lib/mathjax-plugin.js');
    const mathPlugin = runtimeGlobal.ObsidianWechatMath
      || (runtimeGlobal.window && runtimeGlobal.window.ObsidianWechatMath);
    if (typeof mathPlugin !== 'undefined') {
      assignRuntimeGlobal('ObsidianWechatMath', mathPlugin);
    }
  }

  if (typeof runtimeGlobal.AppleTheme === 'undefined') {
    assignRuntimeGlobal('AppleTheme', require('../themes/apple-theme.js'));
  }

  if (typeof runtimeGlobal.AppleStyleConverter === 'undefined') {
    assignRuntimeGlobal('AppleStyleConverter', require('../converter.js'));
  }

  if (typeof runtimeGlobal.AppleTheme === 'undefined') throw new Error('AppleTheme failed to load');
  if (typeof runtimeGlobal.AppleStyleConverter === 'undefined') throw new Error('AppleStyleConverter failed to load');
}

function getAvatarSrc(settings = {}) {
  if (!settings.enableWatermark) return '';
  return settings.avatarBase64 || settings.avatarUrl || '';
}

function toThemeOptions(settings = {}) {
  return {
    theme: settings.theme,
    themeColor: settings.themeColor,
    customColor: settings.customColor,
    quoteCalloutStyleMode: settings.quoteCalloutStyleMode,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    macCodeBlock: settings.macCodeBlock,
    codeLineNumber: settings.codeLineNumber,
    sidePadding: settings.sidePadding,
    coloredHeader: settings.coloredHeader,
  };
}

async function readEmbeddedOrFile({
  key,
  adapter,
  path,
  required = true,
  logger = console,
  embeddedScripts = {},
}) {
  const embedded = embeddedScripts && typeof embeddedScripts[key] === 'string'
    ? embeddedScripts[key]
    : '';
  if (embedded) return embedded;

  if (!adapter || typeof adapter.read !== 'function') {
    if (required) {
      throw new Error(`Missing embedded script and file adapter for dependency: ${key}`);
    }
    return '';
  }

  if (!required && adapter.exists && typeof adapter.exists === 'function') {
    try {
      if (!(await adapter.exists(path))) return '';
    } catch (error) {
      logger.error(`Dependency exists() check failed for ${path}:`, error);
      return '';
    }
  }

  return adapter.read(path);
}

async function buildRenderRuntime({
  settings,
  app,
  adapter,
  basePath,
}) {
  if (adapter || basePath) {
    // Keep the signature stable for existing callers, but runtime loading is now static.
  }
  loadRuntimeDependencies();

  const runtimeGlobal = getRuntimeGlobal();
  const ThemeCtor = runtimeGlobal && runtimeGlobal.AppleTheme;
  const ConverterCtor = runtimeGlobal && runtimeGlobal.AppleStyleConverter;

  if (!ThemeCtor) throw new Error('AppleTheme failed to load');
  if (!ConverterCtor) throw new Error('AppleStyleConverter failed to load');

  const theme = new ThemeCtor(toThemeOptions(settings));
  const converter = new ConverterCtor(
    theme,
    getAvatarSrc(settings),
    settings.showImageCaption,
    app
  );
  await converter.initMarkdownIt();

  return { theme, converter };
}

module.exports = {
  getAvatarSrc,
  toThemeOptions,
  buildRenderRuntime,
  loadRuntimeDependencies,
  readEmbeddedOrFile,
};
