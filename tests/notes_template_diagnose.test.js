// 「备忘录」模板(NotesTemplate)渲染单测:模板切换时头部 DOM 正确重建
// (2026-07-13 排查「备忘录选项无效」时补充,保留作回归)
import { describe, it, expect } from 'vitest';
import { NotesTemplate } from '../rednote/imgTelplate/notesTemplate.ts';
import { DefaultTemplate } from '../rednote/imgTelplate/defaultTemplate.ts';

// 本测试专用的 Obsidian DOM 扩展(避开 helpers 里与全局 setCssStyles 的
// 只读属性冲突):仅补模板代码用到的 empty/addClass/setText/createEl
function applyExtensions(el) {
  if (!el || el.__diagExtApplied) return el;
  el.__diagExtApplied = true;
  if (!el.empty) el.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
  if (!el.addClass) el.addClass = function (c) { if (c) this.classList.add(c); return this; };
  if (!el.setText) el.setText = function (t) { this.textContent = t == null ? '' : String(t); };
  if (!el.createEl) el.createEl = function (tag, opts = {}) {
    const child = applyExtensions(document.createElement(tag));
    if (opts.cls) child.className = opts.cls;
    if (opts.text !== undefined) child.textContent = opts.text;
    if (opts.value !== undefined && 'value' in child) child.value = opts.value;
    if (opts.attr) Object.entries(opts.attr).forEach(([k, v]) => child.setAttribute(k, String(v)));
    this.appendChild(child);
    return child;
  };
  return el;
}

const fakeSettingsManager = {
  getSettings: () => ({
    notesTitle: '', showTime: true, showFooter: true,
    userAvatar: '', userName: '测试', userId: 'test',
  }),
  updateSettings: async () => {},
};

function buildPreview() {
  const previewEl = document.createElement('div');
  previewEl.className = 'red-preview-container';
  previewEl.innerHTML = `
    <div class="red-preview-container">
      <div class="red-image-preview">
        <div class="red-preview-header"></div>
        <div class="red-preview-content"><div class="red-content-container">
          <section class="red-content-section" data-index="0"><h1>页1</h1></section>
          <section class="red-content-section" data-index="1"><h1>页2</h1></section>
        </div></div>
        <div class="red-preview-footer"></div>
      </div>
    </div>`;
  previewEl.querySelectorAll('*').forEach(applyExtensions);
  applyExtensions(previewEl);
  return previewEl;
}

describe('备忘录模板诊断', () => {
  it('直接应用 notes 模板应渲染备忘录头部', () => {
    const el = buildPreview();
    new NotesTemplate(fakeSettingsManager, async () => {}).render(el);
    const header = el.querySelector('.red-preview-header');
    console.log('[场景1] header class =', header.className);
    console.log('[场景1] header html =', header.innerHTML.slice(0, 300));
    expect(header.classList.contains('red-notes-header')).toBe(true);
    expect(header.querySelector('.red-notes-bar')).toBeTruthy();
  });

  it('default → notes 切换应渲染备忘录头部', () => {
    const el = buildPreview();
    new DefaultTemplate(fakeSettingsManager, async () => {}).render(el);
    el.querySelectorAll('*').forEach(applyExtensions);
    console.log('[场景2] default 后 header html =', el.querySelector('.red-preview-header').innerHTML.slice(0, 200));
    new NotesTemplate(fakeSettingsManager, async () => {}).render(el);
    const header = el.querySelector('.red-preview-header');
    console.log('[场景2] 切 notes 后 class =', header.className, '| bar?', !!header.querySelector('.red-notes-bar'));
    expect(header.querySelector('.red-notes-bar')).toBeTruthy();
  });

  it('notes → default 切回应渲染用户信息头部(检查残留)', () => {
    const el = buildPreview();
    new NotesTemplate(fakeSettingsManager, async () => {}).render(el);
    el.querySelectorAll('*').forEach(applyExtensions);
    new DefaultTemplate(fakeSettingsManager, async () => {}).render(el);
    const header = el.querySelector('.red-preview-header');
    console.log('[场景3] 切回 default 后 class =', header.className, '| user-info?', !!header.querySelector('.red-user-info'));
    expect(header.querySelector('.red-user-info')).toBeTruthy();
  });
});
