// 「备忘录」主题(memo)集成测试:mount → setTheme 全链路
// 覆盖:memo 专属头部渲染 / 切回默认主题恢复用户信息头部 / 预设主题合并迁移
import { describe, it, expect, beforeAll } from 'vitest';
import { MarkdownRenderer } from 'obsidian';

// Obsidian 运行时会给所有 HTMLElement 打上 DOM 扩展;测试环境补齐
function patchGlobalDom() {
  const proto = globalThis.HTMLElement.prototype;
  const define = (name, fn) => {
    if (!proto[name]) Object.defineProperty(proto, name, { configurable: true, value: fn });
  };
  define('empty', function () { while (this.firstChild) this.removeChild(this.firstChild); });
  define('addClass', function (c) { if (c) this.classList.add(c); return this; });
  define('removeClass', function (c) { if (c) this.classList.remove(c); return this; });
  define('setText', function (t) { this.textContent = t == null ? '' : String(t); });
  define('createEl', function (tag, opts = {}) {
    const child = document.createElement(tag);
    if (opts.cls) child.className = opts.cls;
    if (opts.text !== undefined) child.textContent = opts.text;
    if (opts.value !== undefined && 'value' in child) child.value = opts.value;
    if (opts.attr) Object.entries(opts.attr).forEach(([k, v]) => child.setAttribute(k, String(v)));
    this.appendChild(child);
    return child;
  });
  define('createDiv', function (opts = {}) { return this.createEl('div', opts); });
  define('createSpan', function (opts = {}) { return this.createEl('span', opts); });
}

describe('备忘录主题(memo)', () => {
  let controller;
  let container;
  let settingsManager;

  beforeAll(async () => {
    patchGlobalDom();
    // view.ts 走 MarkdownRenderer.render(app, md, el, path, component)
    MarkdownRenderer.render = async (_app, _content, el) => {
      el.innerHTML = '<h2>标题一</h2><p>内容1</p><h2>标题二</h2><p>内容2</p>';
    };

    const fakeFile = { path: 'a.md', extension: 'md' };
    const app = {
      workspace: { on: () => ({}), getActiveFile: () => fakeFile },
      vault: { on: () => ({}), cachedRead: async () => '# x' },
    };
    const hostPlugin = { settings: {}, saveSettings: async () => {} };

    const { createRednoteManagers } = await import('../rednote/index.ts');
    const managers = await createRednoteManagers(app, hostPlugin);
    settingsManager = managers.settingsManager;

    const { RedPreviewController } = await import('../rednote/view.ts');
    const host = { registerEvent: () => {}, register: () => {} };
    controller = new RedPreviewController(app, host, managers.themeManager, settingsManager);

    container = document.createElement('div');
    document.body.appendChild(container);
    await controller.mount(container);
  });

  it('memo 主题应出现在预设主题列表中', () => {
    const options = controller.getThemeOptions();
    expect(options.some(o => o.value === 'memo' && o.label === '备忘录')).toBe(true);
  });

  it('mount 后默认主题应渲染用户信息头部', () => {
    expect(container.querySelector('.red-user-info')).toBeTruthy();
    expect(container.querySelector('.red-memo-bar')).toBeNull();
  });

  it('setTheme(memo) 后应渲染备忘录专属头部', async () => {
    await controller.setTheme('memo');
    const header = container.querySelector('.red-preview-header');
    expect(header.classList.contains('red-memo-header')).toBe(true);
    // 模拟状态栏:时间 + 信号/WiFi/电池
    expect(container.querySelector('.red-memo-status-time')?.textContent).toMatch(/^\d{1,2}:\d{2}$/);
    expect(container.querySelectorAll('.red-memo-sicon').length).toBe(3);
    // 导航条 + 日期行
    expect(container.querySelector('.red-memo-bar')).toBeTruthy();
    expect(container.querySelector('.red-memo-back')?.textContent).toBe('备忘录');
    expect(container.querySelector('.red-memo-date')).toBeTruthy();
    // 用户信息头部被替换
    expect(container.querySelector('.red-user-info')).toBeNull();
    // 卡片挂纸张颗粒纹理类
    expect(container.querySelector('.red-image-preview')?.classList.contains('red-memo-paper')).toBe(true);
  });

  it('切回 default 应恢复用户信息头部且无 memo 残留', async () => {
    await controller.setTheme('default');
    expect(container.querySelector('.red-user-info')).toBeTruthy();
    expect(container.querySelector('.red-memo-bar')).toBeNull();
    expect(container.querySelector('.red-memo-header')).toBeNull();
    expect(container.querySelector('.red-memo-paper')).toBeNull();
  });

  it('老用户 data.json 里的主题快照应自动补入 memo 预设', async () => {
    // 模拟旧数据:themes 已持久化且不含 memo
    const { SettingsManager } = await import('../rednote/settings/settings.ts');
    const legacyPlugin = {
      settings: {
        rednote: {
          themes: [{ id: 'default', name: '默认主题', isPreset: true, isVisible: false, styles: {} }],
        },
      },
      saveSettings: async () => {},
    };
    const sm = new SettingsManager(legacyPlugin);
    await sm.loadSettings();
    const memo = sm.getTheme('memo');
    expect(memo).toBeTruthy();
    // 已存在的预设按代码刷新样式,但保留用户的可见性开关
    const def = sm.getTheme('default');
    expect(def.isVisible).toBe(false);
    expect(def.styles.imagePreview).toBeTruthy();
  });
});
