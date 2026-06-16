/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports -- DOM helpers are the typed boundary for activeDocument/window compatibility in JS files. */
function getActiveDocument() {
  if (typeof window !== 'undefined' && window.activeDocument) return window.activeDocument;
  if (typeof window !== 'undefined' && window['document']) return window['document'];
  return null;
}

function getActiveWindow() {
  if (typeof window !== 'undefined' && window.activeWindow) return window.activeWindow;
  if (typeof window !== 'undefined' && window) return window;
  return null;
}

function parseHtmlFragment(html = '') {
  const doc = getActiveDocument();
  if (!doc) {
    return null;
  }

  const fragment = doc.createDocumentFragment();
  const source = String(html || '');
  if (!source) return fragment;

  if (typeof DOMParser === 'function') {
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    while (parsed.body.firstChild) {
      fragment.appendChild(parsed.body.firstChild);
    }
    return fragment;
  }

  return fragment;
}

function appendHtmlFragment(element, html = '') {
  if (!element) return element;
  const fragment = parseHtmlFragment(html);
  if (fragment) {
    element.appendChild(fragment);
  }
  return element;
}

function setElementHtml(element, html = '') {
  if (!element) return element;
  const fragment = parseHtmlFragment(html);
  if (typeof element.replaceChildren === 'function') {
    element.replaceChildren();
  } else {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
  if (fragment) {
    element.appendChild(fragment);
  }
  return element;
}

function createHtmlContainer(tagName = 'div', html = '') {
  const doc = getActiveDocument();
  if (!doc) return null;
  const container = doc.createElement(tagName);
  setElementHtml(container, html);
  return container;
}

function htmlToText(html = '') {
  const container = createHtmlContainer('div', html);
  return container ? (container.textContent || '') : '';
}

module.exports = {
  appendHtmlFragment,
  createHtmlContainer,
  getActiveDocument,
  getActiveWindow,
  htmlToText,
  parseHtmlFragment,
  setElementHtml,
};
