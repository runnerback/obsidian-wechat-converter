// RedPreviewController 模板切换集成测试:mount → setTemplate 全链路
// (2026-07-13 排查「备忘录选项无效」时补充,保留作回归)
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

describe('备忘录模板·控制器链路诊断', () => {
  let controller;
  let container;

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
    const { settingsManager, themeManager } = await createRednoteManagers(app, hostPlugin);

    const { RedPreviewController } = await import('../rednote/view.ts');
    const host = { registerEvent: () => {}, register: () => {} };
    controller = new RedPreviewController(app, host, themeManager, settingsManager);

    container = document.createElement('div');
    document.body.appendChild(container);
    await controller.mount(container);
  });

  it('mount 后默认模板应渲染用户信息头部', () => {
    const header = container.querySelector('.red-preview-header');
    console.log('[集成] mount 后 header =', header ? header.outerHTML.slice(0, 200) : 'null');
    expect(header).toBeTruthy();
  });

  it('setTemplate(notes) 后应出现备忘录头部', async () => {
    await controller.setTemplate('notes');
    const header = container.querySelector('.red-preview-header');
    const bar = container.querySelector('.red-notes-bar');
    console.log('[集成] setTemplate 后 header class =', header?.className, '| bar?', !!bar);
    console.log('[集成] header html =', header?.innerHTML.slice(0, 300));
    expect(bar).toBeTruthy();
  });

  it('切回 default 应恢复用户信息头部', async () => {
    await controller.setTemplate('default');
    const userInfo = container.querySelector('.red-user-info');
    const bar = container.querySelector('.red-notes-bar');
    console.log('[集成] 切回 default: user-info?', !!userInfo, '| notes-bar 残留?', !!bar);
    expect(userInfo).toBeTruthy();
  });
});
