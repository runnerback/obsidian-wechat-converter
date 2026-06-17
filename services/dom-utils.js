/** @returns {Document | null} */
export function getActiveDocument() {
  if (typeof window !== 'undefined' && window.activeDocument) return window.activeDocument;
  if (typeof window !== 'undefined' && window['document']) return window['document'];
  return null;
}

/** @returns {Window | null} */
export function getActiveWindow() {
  if (typeof window !== 'undefined' && window.activeWindow) return window.activeWindow;
  if (typeof window !== 'undefined' && window) return window;
  return null;
}

/**
 * @param {string} [html]
 * @returns {DocumentFragment | null}
 */
export function parseHtmlFragment(html = '') {
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

/**
 * @template {Element} T
 * @param {T | null | undefined} element
 * @param {string} [html]
 * @returns {T | null | undefined}
 */
export function appendHtmlFragment(element, html = '') {
  if (!element) return element;
  const fragment = parseHtmlFragment(html);
  if (fragment) {
    element.appendChild(fragment);
  }
  return element;
}

/**
 * @template {Element} T
 * @param {T | null | undefined} element
 * @param {string} [html]
 * @returns {T | null | undefined}
 */
export function setElementHtml(element, html = '') {
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

/**
 * @param {string} [tagName]
 * @param {string} [html]
 * @returns {HTMLElement | null}
 */
export function createHtmlContainer(tagName = 'div', html = '') {
  const doc = getActiveDocument();
  if (!doc) return null;
  const container = doc.createElement(tagName);
  setElementHtml(container, html);
  return container;
}

/**
 * @param {string} [html]
 * @returns {string}
 */
export function htmlToText(html = '') {
  const container = createHtmlContainer('div', html);
  return container ? (container.textContent || '') : '';
}
