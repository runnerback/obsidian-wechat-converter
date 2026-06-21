// services/feishu-settings.js
//
// Pure settings data helper functions for Feishu cloud document sync.
// Handles defaults creation, settings normalization, and upload history management.
// No DOM, no Obsidian API, no side effects.

/**
 * @typedef {{ title: string, url: string, uploadTime: string, docToken: string, sourcePath: string }} FeishuUploadHistoryItemLike
 * @typedef {{ enabled: boolean, appId: string, appSecret: string, folderToken: string, userId: string, enableSmartUpdate: boolean, enableDoubleLinkMode: boolean, debugLoggingEnabled: boolean, uploadHistory: FeishuUploadHistoryItemLike[] }} FeishuSyncSettingsLike
 */

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function toRecord(value) {
  return value && typeof value === 'object'
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function toStringWithFallback(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

/**
 * @param {string} token
 * @returns {boolean}
 */
function isSafeFeishuDocToken(token) {
  return /^[A-Za-z0-9_-]{8,}$/.test(String(token || '').trim());
}

/**
 * @param {URL} parsedUrl
 * @returns {boolean}
 */
function isFeishuDocHost(parsedUrl) {
  const hostname = parsedUrl.hostname.toLowerCase();
  return hostname === 'feishu.cn'
    || hostname.endsWith('.feishu.cn')
    || hostname === 'larksuite.com'
    || hostname.endsWith('.larksuite.com');
}

/**
 * Extracts a Feishu docx token from a pasted URL or a plain token.
 * @param {unknown} value
 * @returns {{ docToken: string, url: string } | null}
 */
function parseFeishuDocUrlOrToken(value) {
  const input = toTrimmedString(value);
  if (!input) return null;

  const urlMatch = input.match(/\/docx\/([A-Za-z0-9_-]+)/);
  const plainToken = isSafeFeishuDocToken(input) ? input : '';
  const docToken = urlMatch ? urlMatch[1] : plainToken;
  if (!isSafeFeishuDocToken(docToken)) return null;

  if (urlMatch) {
    try {
      const parsedUrl = new URL(input);
      if (!isFeishuDocHost(parsedUrl)) return null;
      return {
        docToken,
        url: `${parsedUrl.origin}/docx/${docToken}`,
      };
    } catch (err) {
      return null;
    }
  }

  return {
    docToken,
    url: `https://open.feishu.cn/docx/${docToken}`,
  };
}

function createDefaultFeishuSyncSettings() {
  return {
    enabled: false,
    appId: '',
    appSecret: '',
    folderToken: '',
    userId: '', // Required for transferring ownership from Bot to User
    enableSmartUpdate: true,
    enableDoubleLinkMode: false,
    debugLoggingEnabled: false,
    uploadHistory: [], // [{ title, url, uploadTime, docToken, sourcePath }]
  };
}

/**
 * @param {unknown} value
 * @returns {FeishuSyncSettingsLike}
 */
function normalizeFeishuSyncSettings(value) {
  const source = toRecord(value);
  const rawUploadHistory = source.uploadHistory;

  const uploadHistory = Array.isArray(rawUploadHistory)
    ? rawUploadHistory.map((item) => {
        const historyItem = toRecord(item);
        if (!Object.keys(historyItem).length) return null;
        return {
          title: toStringWithFallback(historyItem.title, '无标题文章'),
          url: toStringWithFallback(historyItem.url),
          uploadTime: toStringWithFallback(historyItem.uploadTime),
          docToken: toStringWithFallback(historyItem.docToken),
          sourcePath: toStringWithFallback(historyItem.sourcePath),
        };
      }).filter(Boolean)
    : [];

  return {
    enabled: source.enabled === true,
    appId: toTrimmedString(source.appId),
    appSecret: toTrimmedString(source.appSecret),
    folderToken: toTrimmedString(source.folderToken),
    userId: toTrimmedString(source.userId),
    enableSmartUpdate: source.enableSmartUpdate !== false,
    enableDoubleLinkMode: source.enableDoubleLinkMode === true,
    debugLoggingEnabled: source.debugLoggingEnabled === true,
    uploadHistory,
  };
}

/**
 * @param {unknown} settings
 * @param {unknown} item
 * @returns {void}
 */
function addFeishuUploadHistory(settings, item) {
  const targetSettings = toRecord(settings);
  if (!Object.keys(targetSettings).length) return;
  const rawUploadHistory = targetSettings.uploadHistory;
  if (!Array.isArray(rawUploadHistory)) {
    targetSettings.uploadHistory = [];
  }
  const uploadHistory = /** @type {FeishuUploadHistoryItemLike[]} */ (targetSettings.uploadHistory);
  const sourceItem = toRecord(item);

  const normalizedItem = {
    title: toStringWithFallback(sourceItem.title, '无标题文章'),
    url: toStringWithFallback(sourceItem.url),
    uploadTime: toStringWithFallback(sourceItem.uploadTime, new Date().toISOString()),
    docToken: toStringWithFallback(sourceItem.docToken),
    sourcePath: toStringWithFallback(sourceItem.sourcePath),
  };

  // Prevent duplicates by docToken or sourcePath
  targetSettings.uploadHistory = uploadHistory.filter(
    (x) => x.docToken !== normalizedItem.docToken && x.sourcePath !== normalizedItem.sourcePath
  );

  /** @type {FeishuUploadHistoryItemLike[]} */ (targetSettings.uploadHistory).unshift(normalizedItem);
  
  // Cap at 100 entries to prevent settings file bloat
  if (targetSettings.uploadHistory.length > 100) {
    targetSettings.uploadHistory = /** @type {FeishuUploadHistoryItemLike[]} */ (targetSettings.uploadHistory).slice(0, 100);
  }
}

/**
 * Rebinds one Obsidian note path to a specific Feishu docx URL/token.
 * @param {unknown} settings
 * @param {unknown} sourcePath
 * @param {unknown} value URL, plain token, or object containing url/docToken/title
 * @returns {FeishuUploadHistoryItemLike | null}
 */
function rebindFeishuHistoryByPath(settings, sourcePath, value) {
  const source = toRecord(value);
  const targetPath = toTrimmedString(sourcePath);
  if (!targetPath) return null;

  const parsed = parseFeishuDocUrlOrToken(source.url || source.docToken || value);
  if (!parsed) return null;

  const historyItem = {
    title: toStringWithFallback(source.title, '无标题文章'),
    url: parsed.url,
    uploadTime: toStringWithFallback(source.uploadTime, new Date().toISOString()),
    docToken: parsed.docToken,
    sourcePath: targetPath,
  };
  addFeishuUploadHistory(settings, historyItem);
  return historyItem;
}

/**
 * @param {unknown} settings
 * @param {unknown} path
 * @returns {FeishuUploadHistoryItemLike | null}
 */
function findFeishuHistoryByPath(settings, path) {
  const source = toRecord(settings);
  if (!Array.isArray(source.uploadHistory)) return null;
  const targetPath = String(path || '').trim();
  if (!targetPath) return null;
  return /** @type {FeishuUploadHistoryItemLike[]} */ (source.uploadHistory).find((x) => x.sourcePath === targetPath) || null;
}

/**
 * @param {unknown} settings
 * @param {unknown} path
 * @returns {boolean}
 */
function removeFeishuHistoryByPath(settings, path) {
  const source = toRecord(settings);
  if (!Array.isArray(source.uploadHistory)) return false;
  const targetPath = String(path || '').trim();
  if (!targetPath) return false;

  const history = /** @type {FeishuUploadHistoryItemLike[]} */ (source.uploadHistory);
  const nextHistory = history.filter((item) => item.sourcePath !== targetPath);
  if (nextHistory.length === history.length) return false;

  source.uploadHistory = nextHistory;
  return true;
}

/**
 * @param {unknown} settings
 * @param {unknown} oldPath
 * @param {unknown} newPath
 * @returns {boolean}
 */
function updateFeishuHistoryPath(settings, oldPath, newPath) {
  const source = toRecord(settings);
  if (!Array.isArray(source.uploadHistory)) return false;
  const targetOld = String(oldPath || '').trim();
  const targetNew = String(newPath || '').trim();
  if (!targetOld || !targetNew) return false;

  let changed = false;
  /** @type {FeishuUploadHistoryItemLike[]} */ (source.uploadHistory).forEach((x) => {
    if (x.sourcePath === targetOld) {
      x.sourcePath = targetNew;
      changed = true;
    }
  });
  return changed;
}

export {
  createDefaultFeishuSyncSettings,
  normalizeFeishuSyncSettings,
  parseFeishuDocUrlOrToken,
  addFeishuUploadHistory,
  rebindFeishuHistoryByPath,
  findFeishuHistoryByPath,
  removeFeishuHistoryByPath,
  updateFeishuHistoryPath,
};
