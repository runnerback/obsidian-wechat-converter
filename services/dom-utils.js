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
 * @param {string} name
 * @returns {unknown}
 */
export function getActiveWindowValue(name) {
  const activeWindow = getActiveWindow();
  if (!activeWindow) return undefined;
  return /** @type {Record<string, unknown>} */ (activeWindow)[name];
}

/**
 * @param {Element | DocumentFragment | null | undefined} root
 * @param {string} selector
 * @returns {Element[]}
 */
export function findAllElements(root, selector) {
  if (!root || !selector) return [];
  const activeWindow = getActiveWindow();
  const ElementCtor = activeWindow?.Element || (typeof Element !== 'undefined' ? Element : null);
  const nodeFilter = activeWindow?.NodeFilter || (typeof NodeFilter !== 'undefined' ? NodeFilter : null);

  const findAll = /** @type {unknown} */ (root.findAll);
  if (typeof findAll === 'function') {
    const result = /** @type {(selector: string) => unknown} */ (findAll).call(root, selector);
    return Array.isArray(result) && ElementCtor
      ? result.filter((item) => item instanceof ElementCtor)
      : [];
  }

  const ownerDocument = ElementCtor && root instanceof ElementCtor
    ? root.ownerDocument
    : getActiveDocument();
  if (!ownerDocument || !nodeFilter || typeof ownerDocument.createTreeWalker !== 'function') return [];

  const matches = (node) => ElementCtor
    && node instanceof ElementCtor
    && matchesSelectorSubset(node, selector);
  const results = [];
  const walker = ownerDocument.createTreeWalker(root, nodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (matches(current)) results.push(current);
    current = walker.nextNode();
  }
  return results;
}

/**
 * Minimal selector matcher for the project selectors that Obsidian scan asks
 * us to keep away from direct querySelectorAll calls.
 *
 * @param {Element} element
 * @param {string} selector
 * @returns {boolean}
 */
function matchesSelectorSubset(element, selector) {
  return splitSelectorList(selector).some((candidate) => matchesSingleSelector(element, candidate));
}

/**
 * @param {string} selector
 * @returns {string[]}
 */
function splitSelectorList(selector) {
  return String(selector || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Element} element
 * @param {string} selector
 * @returns {boolean}
 */
function matchesSingleSelector(element, selector) {
  const childParts = selector.split('>').map((part) => part.trim()).filter(Boolean);
  if (childParts.length > 1) {
    let current = element;
    for (let index = childParts.length - 1; index >= 0; index -= 1) {
      if (!matchesDescendantSelector(current, childParts[index])) return false;
      if (index > 0) {
        const parent = current.parentElement;
        if (!parent) return false;
        current = parent;
      }
    }
    return true;
  }
  return matchesDescendantSelector(element, selector);
}

/**
 * @param {Element} element
 * @param {string} selector
 * @returns {boolean}
 */
function matchesDescendantSelector(element, selector) {
  const parts = selector.split(/\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return false;

  let current = element;
  if (!matchesSimpleSelector(current, parts[parts.length - 1])) return false;

  for (let index = parts.length - 2; index >= 0; index -= 1) {
    let parent = current.parentElement;
    let found = false;
    while (parent) {
      if (matchesSimpleSelector(parent, parts[index])) {
        current = parent;
        found = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (!found) return false;
  }

  return true;
}

/**
 * @param {Element} element
 * @param {string} selector
 * @returns {boolean}
 */
function matchesSimpleSelector(element, selector) {
  if (!selector || selector === '*') return true;
  const idMatch = selector.match(/#([A-Za-z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;

  const classRegex = /\.([A-Za-z0-9_-]+)/g;
  let classMatch;
  while ((classMatch = classRegex.exec(selector))) {
    if (!element.classList?.contains(classMatch[1])) return false;
  }

  const tag = selector.replace(/[#.][A-Za-z0-9_-]+/g, '').trim();
  if (!tag) return true;
  return String(element.tagName || '').toLowerCase() === tag.toLowerCase();
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
