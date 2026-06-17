function loadInputModule() {
  if (typeof globalThis.require !== 'function') {
    globalThis.require = require;
  }
  const inputModule = require('../../input.js');
  return inputModule && inputModule.default ? inputModule : {
    default: inputModule,
    ...inputModule,
  };
}

module.exports = {
  loadInputModule,
};
