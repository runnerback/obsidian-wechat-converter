/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: JS file handles dynamic API responses without strict typescript type annotations */
// services/feishu-settings.js
//
// Pure settings data helper functions for Feishu cloud document sync.
// Handles defaults creation, settings normalization, and upload history management.
// No DOM, no Obsidian API, no side effects.

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

function normalizeFeishuSyncSettings(value) {
  const source = value && typeof value === 'object' ? value : {};

  const uploadHistory = Array.isArray(source.uploadHistory)
    ? source.uploadHistory.map((item) => {
        if (!item || typeof item !== 'object') return null;
        return {
          title: typeof item.title === 'string' ? item.title : '无标题文章',
          url: typeof item.url === 'string' ? item.url : '',
          uploadTime: typeof item.uploadTime === 'string' ? item.uploadTime : '',
          docToken: typeof item.docToken === 'string' ? item.docToken : '',
          sourcePath: typeof item.sourcePath === 'string' ? item.sourcePath : '',
        };
      }).filter(Boolean)
    : [];

  return {
    enabled: source.enabled === true,
    appId: typeof source.appId === 'string' ? source.appId.trim() : '',
    appSecret: typeof source.appSecret === 'string' ? source.appSecret.trim() : '',
    folderToken: typeof source.folderToken === 'string' ? source.folderToken.trim() : '',
    userId: typeof source.userId === 'string' ? source.userId.trim() : '',
    enableSmartUpdate: source.enableSmartUpdate !== false,
    enableDoubleLinkMode: source.enableDoubleLinkMode === true,
    debugLoggingEnabled: source.debugLoggingEnabled === true,
    uploadHistory,
  };
}

function addFeishuUploadHistory(settings, item) {
  if (!settings || typeof settings !== 'object') return;
  if (!Array.isArray(settings.uploadHistory)) {
    settings.uploadHistory = [];
  }

  const normalizedItem = {
    title: typeof item.title === 'string' ? item.title : '无标题文章',
    url: typeof item.url === 'string' ? item.url : '',
    uploadTime: typeof item.uploadTime === 'string' ? item.uploadTime : new Date().toISOString(),
    docToken: typeof item.docToken === 'string' ? item.docToken : '',
    sourcePath: typeof item.sourcePath === 'string' ? item.sourcePath : '',
  };

  // Prevent duplicates by docToken or sourcePath
  settings.uploadHistory = settings.uploadHistory.filter(
    (x) => x.docToken !== normalizedItem.docToken && x.sourcePath !== normalizedItem.sourcePath
  );

  settings.uploadHistory.unshift(normalizedItem);
  
  // Cap at 100 entries to prevent settings file bloat
  if (settings.uploadHistory.length > 100) {
    settings.uploadHistory = settings.uploadHistory.slice(0, 100);
  }
}

function findFeishuHistoryByPath(settings, path) {
  if (!settings || !Array.isArray(settings.uploadHistory)) return null;
  const targetPath = String(path || '').trim();
  if (!targetPath) return null;
  return settings.uploadHistory.find((x) => x.sourcePath === targetPath) || null;
}

function updateFeishuHistoryPath(settings, oldPath, newPath) {
  if (!settings || !Array.isArray(settings.uploadHistory)) return false;
  const targetOld = String(oldPath || '').trim();
  const targetNew = String(newPath || '').trim();
  if (!targetOld || !targetNew) return false;

  let changed = false;
  settings.uploadHistory.forEach((x) => {
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
  addFeishuUploadHistory,
  findFeishuHistoryByPath,
  updateFeishuHistoryPath,
};
