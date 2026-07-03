// services/input-utils.js
//
// Pure, dependency-free helper functions extracted verbatim from input.js
// (Phase 1 of the input.js split). No coupling to Obsidian API singletons,
// module globals, or view state — safe to import anywhere.

/**
 * @param {unknown} error
 * @returns {import('./types.js').ReadableErrorLike | Error}
 */
export function toReadableError(error) {
  if (error instanceof Error) return /** @type {any} */ (error);
  if (error && typeof error === 'object') {
    const record = /** @type {{ message?: unknown, isFatal?: unknown, isProxyAuth?: unknown }} */ (error);
    return {
      message: typeof record.message === 'string' ? record.message : String(error),
      isFatal: record.isFatal === true,
      isProxyAuth: record.isProxyAuth === true,
    };
  }
  return { message: String(error || '') };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function toRecord(value) {
  return isRecord(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function toAiLayoutState(value) {
  return isRecord(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function toAiLayoutJson(value) {
  return isRecord(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function toAiLayoutBlock(value) {
  return isRecord(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function toAiLayoutGenerationMeta(value) {
  return isRecord(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function toAiLayoutSelection(value) {
  return isRecord(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {Record<string, any>}
 */
export function toAiLayoutFamilyStates(value) {
  if (!isRecord(value)) return {};
  return /** @type {Record<string, any>} */ (value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function toOptionalText(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * @param {unknown} value
 * @returns {HTMLImageElement[]}
 */
export function toImageElements(value) {
  if (!value || typeof value !== 'object' || typeof value[Symbol.iterator] !== 'function') return [];
  /** @type {HTMLImageElement[]} */
  const images = [];
  for (const item of value) {
    if (item instanceof HTMLImageElement) images.push(item);
  }
  return images;
}

/**
 * @param {unknown} element
 * @param {string} className
 */
export function removeElementClass(element, className) {
  if (element instanceof HTMLElement) element.classList.remove(className);
}

/**
 * @param {unknown} value
 * @returns {number | undefined}
 */
export function toOptionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function parseJsonRecord(value) {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    return toRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

/**
 * @param {unknown} response
 * @returns {import('./types.js').RequestUrlResponseLike}
 */
export function normalizeRequestUrlResponse(response) {
  const record = toRecord(response);
  const status = toOptionalNumber(record.status) ?? 200;
  const headers = /** @type {Record<string, string>} */ (toRecord(record.headers));
  return {
    status,
    json: record.json,
    text: toOptionalText(record.text),
    arrayBuffer: typeof record.arrayBuffer === 'function' ? /** @type {() => Promise<ArrayBuffer>} */ (record.arrayBuffer.bind(response)) : undefined,
    headers,
  };
}

/**
 * @param {import('./types.js').RequestUrlResponseLike} response
 * @returns {Record<string, unknown>}
 */
export function getResponseJsonRecord(response) {
  return toRecord(response.json);
}

/**
 * @param {import('./types.js').RequestUrlResponseLike} response
 * @returns {string}
 */
export function getProxyErrorMessage(response) {
  const body = isRecord(response.json) ? response.json : parseJsonRecord(response.text);
  const bodyError = body.error;
  if (typeof bodyError === 'string' && bodyError) return bodyError;
  return response.text || `Request failed, status ${response.status}`;
}

/**
 * @param {string} message
 * @param {boolean} isAuthFailure
 * @returns {Error & { isProxyAuth?: boolean, isFatal?: boolean }}
 */
export function createProxyError(message, isAuthFailure) {
  const error = /** @type {Error & { isProxyAuth?: boolean, isFatal?: boolean }} */ (new Error(message));
  if (isAuthFailure) {
    error.isProxyAuth = true;
    error.isFatal = true;
  }
  return error;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
export function formatWechatApiError(data) {
  const errmsg = typeof data.errmsg === 'string' ? data.errmsg : JSON.stringify(data);
  const errcode = data.errcode ?? 'N/A';
  return `${errmsg} (${errcode})`;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {boolean}
 */
export function hasWechatUploadResult(data) {
  return typeof data.media_id === 'string' || typeof data.url === 'string';
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function readBlobAsBase64Payload(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file data'));
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const source = String(dataUrl || '');
  const match = source.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/i);
  if (!match) {
    throw new Error('无效的 data URL 图片来源');
  }
  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const payload = match[3] || '';
  let binary;
  if (isBase64) {
    binary = atob(payload);
  } else {
    binary = decodeURIComponent(payload);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Wait for a number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Generate a short unique id.
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

// 辅助函数：并发控制 (p-limit 简化版)
/**
 * @template T
 * @template R
 * @param {T[]} array
 * @param {(item: T) => Promise<R> | R} mapper
 * @param {number} [concurrency]
 * @returns {Promise<R[]>}
 */
export async function pMap(array, mapper, concurrency = 3) {
  /** @type {Promise<R>[]} */
  const results = [];
  /** @type {Promise<void>[]} */
  const executing = [];
  let isFailed = false;
  for (const item of array) {
    if (isFailed) break;
    const p = Promise.resolve().then(() => mapper(item));
    results.push(p);
    // Fix: Ensure cleanup happens regardless of success or failure
    // If error occurs, mark as failed to stop scheduling new tasks
    const e = p.catch(() => { isFailed = true; }).then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}
