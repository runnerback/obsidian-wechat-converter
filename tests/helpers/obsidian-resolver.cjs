// tests/helpers/obsidian-resolver.cjs
//
// Vitest 4 honors `resolve.alias` for ESM imports it transforms, while some
// legacy CommonJS tests still call `require('obsidian')` directly. The
// installed `obsidian` package ships only `.d.ts` type definitions, so those
// direct requires need to resolve to our mock implementation.
//
// Fix: monkey-patch `Module._resolveFilename` once per worker, before any
// test file runs, so every `require('obsidian')` resolves to our mock at
// `__mocks__/obsidian.js`. Wired in via `vitest.config.mjs` -> `setupFiles`.
//
// This keeps the existing alias semantics for ESM users and unblocks the
// CJS tests (settings_*, wechat_api, sync_modal_*, etc.) without touching
// node_modules or the production build.

const Module = require('module');
const path = require('path');

const mockPath = path.resolve(__dirname, '../../__mocks__/obsidian.js');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(request, parent, ...rest) {
  if (request === 'obsidian') {
    return mockPath;
  }
  return originalResolve.call(this, request, parent, ...rest);
};

function installSetCssStylesPrototype(Ctor) {
  if (!Ctor || Ctor.prototype.setCssStyles) return;
  Object.defineProperty(Ctor.prototype, 'setCssStyles', {
    configurable: true,
    value(styles = {}) {
      Object.entries(styles || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        this.style[key] = String(value);
      });
      return this;
    },
  });
}

installSetCssStylesPrototype(globalThis.HTMLElement);
installSetCssStylesPrototype(globalThis.SVGElement);
