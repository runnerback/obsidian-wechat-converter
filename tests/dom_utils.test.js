import { describe, it, expect, afterEach } from 'vitest';

const {
  createHtmlContainer,
  findAllElements,
  getActiveWindowValue,
  parseHtmlFragment,
  setElementHtml,
} = require('../services/dom-utils');

describe('DOM utilities', () => {
  const originalDOMParser = global.DOMParser;

  afterEach(() => {
    global.DOMParser = originalDOMParser;
  });

  it('parses normal article markup with DOMParser', () => {
    const fragment = parseHtmlFragment('<section><p>正文</p><strong>重点</strong></section>');

    expect(fragment.childNodes.length).toBe(1);
    expect(fragment.querySelector('p')?.textContent).toBe('正文');
    expect(fragment.querySelector('strong')?.textContent).toBe('重点');
  });

  it('returns an empty fragment for empty input', () => {
    const fragment = parseHtmlFragment('');

    expect(fragment.childNodes.length).toBe(0);
  });

  it('does not fall back to createContextualFragment when DOMParser is unavailable', () => {
    const originalCreateRange = document.createRange;
    global.DOMParser = undefined;
    document.createRange = () => {
      throw new Error('createRange should not be used');
    };

    try {
      const container = createHtmlContainer('div', '<p>unsafe fallback should not run</p>');

      expect(container).not.toBeNull();
      expect(container.childNodes.length).toBe(0);
    } finally {
      document.createRange = originalCreateRange;
    }
  });

  it('replaces existing children using parsed fragments', () => {
    const container = document.createElement('div');
    container.textContent = '旧内容';

    setElementHtml(container, '<p>新内容</p>');

    expect(container.textContent).toBe('新内容');
    expect(container.querySelector('p')).not.toBeNull();
  });

  it('finds matching elements without relying on direct querySelectorAll calls', () => {
    const container = createHtmlContainer('div', '<p class="target">A</p><section><p>B</p><p class="target">C</p></section>');

    const matches = findAllElements(container, '.target');

    expect(matches.map((el) => el.textContent)).toEqual(['A', 'C']);
  });

  it('uses Obsidian-style findAll when provided by the element', () => {
    const first = document.createElement('span');
    const second = document.createElement('span');
    const host = {
      findAll(selector) {
        return selector === '.chip' ? [first, 'not-an-element', second] : [];
      },
    };

    expect(findAllElements(host, '.chip')).toEqual([first, second]);
  });

  it('reads values from the active window helper', () => {
    window.__domUtilsTestValue = 'ok';

    try {
      expect(getActiveWindowValue('__domUtilsTestValue')).toBe('ok');
    } finally {
      delete window.__domUtilsTestValue;
    }
  });
});
