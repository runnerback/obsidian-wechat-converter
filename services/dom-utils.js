function parseHtmlFragment(html = '') {
  if (typeof document === 'undefined') {
    return null;
  }

  const fragment = document.createDocumentFragment();
  const source = String(html || '');
  if (!source) return fragment;

  if (typeof DOMParser === 'function') {
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    while (parsed.body.firstChild) {
      fragment.appendChild(parsed.body.firstChild);
    }
    return fragment;
  }

  const range = document.createRange();
  range.selectNode(document.body);
  return range.createContextualFragment(source);
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
  if (typeof document === 'undefined') return null;
  const container = document.createElement(tagName);
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
  htmlToText,
  parseHtmlFragment,
  setElementHtml,
};
