/**
 * @typedef {{ requestUrl?: Function | null, endpoint?: string, timeoutMs?: number, maxImageBytes?: number }} KrokiRenderOptions
 */

const DEFAULT_KROKI_MERMAID_PNG_ENDPOINT = 'https://kroki.io/mermaid/png';
const DEFAULT_KROKI_TIMEOUT_MS = 15000;
const DEFAULT_KROKI_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * @param {unknown} binary
 * @returns {Uint8Array}
 */
function toUint8Array(binary) {
  if (binary instanceof Uint8Array) return binary;
  if (binary instanceof ArrayBuffer) return new Uint8Array(binary);
  if (ArrayBuffer.isView(binary)) {
    return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
  }
  return new Uint8Array(0);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
  if (globalThis.Buffer && typeof globalThis.Buffer.from === 'function') {
    return globalThis.Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

/**
 * @param {unknown} response
 * @returns {Promise<Uint8Array>}
 */
async function readResponseBytes(response) {
  const record = response && typeof response === 'object'
    ? /** @type {{ arrayBuffer?: unknown, raw?: unknown, buffer?: unknown }} */ (response)
    : {};
  if (typeof record.arrayBuffer === 'function') {
    return toUint8Array(await record.arrayBuffer());
  }
  return toUint8Array(record.arrayBuffer || record.raw || record.buffer);
}

/**
 * @param {unknown} headers
 * @param {string} name
 * @returns {string}
 */
function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const target = String(name || '').toLowerCase();
  const source = /** @type {Record<string, unknown>} */ (headers);
  const key = Object.keys(source).find((item) => item.toLowerCase() === target);
  return key ? String(source[key] || '') : '';
}

/**
 * @param {unknown} endpoint
 * @returns {string}
 */
function normalizeKrokiEndpoint(endpoint) {
  const value = String(endpoint || DEFAULT_KROKI_MERMAID_PNG_ENDPOINT).trim();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error('Kroki 渲染服务必须使用 HTTPS');
    }
    return url.toString();
  } catch (error) {
    if (error?.message === 'Kroki 渲染服务必须使用 HTTPS') throw error;
    throw new Error('Kroki 渲染服务地址无效');
  }
}

/**
 * @param {unknown} source
 * @param {KrokiRenderOptions} [options]
 * @returns {Promise<string>}
 */
async function renderMermaidWithKroki(source, options = {}) {
  const mermaidSource = String(source || '').trim();
  if (!mermaidSource) return '';
  const requestUrl = options.requestUrl;
  if (typeof requestUrl !== 'function') {
    throw new Error('当前环境缺少 requestUrl，无法远端渲染 Mermaid');
  }

  const endpoint = normalizeKrokiEndpoint(options.endpoint);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_KROKI_TIMEOUT_MS;
  const maxImageBytes = Number(options.maxImageBytes) > 0
    ? Number(options.maxImageBytes)
    : DEFAULT_KROKI_MAX_IMAGE_BYTES;
  let timeoutId = 0;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error('Kroki Mermaid 渲染超时'));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      Promise.resolve(requestUrl({
        url: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'image/png',
        },
        body: JSON.stringify({
          diagram_source: mermaidSource,
        }),
        throw: false,
      })),
      timeoutPromise,
    ]);
    const status = Number(response?.status || 0);
    if (status >= 400) {
      throw new Error(`Kroki Mermaid 渲染失败 (${status})`);
    }
    const bytes = await readResponseBytes(response);
    if (!bytes.byteLength) {
      throw new Error('Kroki Mermaid 渲染失败 (empty body)');
    }
    if (bytes.byteLength > maxImageBytes) {
      throw new Error(`Kroki Mermaid 渲染图片过大 (${bytes.byteLength} bytes)`);
    }
    const contentType = getHeaderValue(response?.headers, 'content-type') || 'image/png';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error('Kroki Mermaid 渲染返回了非图片内容');
    }
    return `data:image/png;base64,${bytesToBase64(bytes)}`;
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }
}

export {
  DEFAULT_KROKI_MAX_IMAGE_BYTES,
  DEFAULT_KROKI_MERMAID_PNG_ENDPOINT,
  normalizeKrokiEndpoint,
  renderMermaidWithKroki,
};
