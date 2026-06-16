/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports -- Draft cache persists dynamic WeChat draft metadata from plugin settings. */
const { normalizeVaultPath } = require('./path-utils');

const DRAFT_CACHE_VERSION = 1;

function createEmptyDraftCache() {
  return {
    version: DRAFT_CACHE_VERSION,
    articles: {},
  };
}

function normalizeDraftEntry(entry, fallbackPath = '') {
  if (!entry || typeof entry !== 'object') return null;

  const mediaId = typeof entry.mediaId === 'string'
    ? entry.mediaId.trim()
    : typeof entry.media_id === 'string'
      ? entry.media_id.trim()
      : '';
  if (!mediaId) return null;

  const sourcePath = normalizeVaultPath(
    typeof entry.sourcePath === 'string' && entry.sourcePath
      ? entry.sourcePath
      : fallbackPath
  );
  if (!sourcePath) return null;

  const index = Number.isInteger(entry.index) && entry.index >= 0 ? entry.index : 0;
  const updatedAt = Number.isFinite(entry.updatedAt) && entry.updatedAt > 0
    ? entry.updatedAt
    : 0;

  return {
    sourcePath,
    mediaId,
    accountId: typeof entry.accountId === 'string' ? entry.accountId.trim() : '',
    title: typeof entry.title === 'string' ? entry.title : '',
    index,
    updatedAt,
  };
}

function normalizeDraftCache(rawCache) {
  const normalized = createEmptyDraftCache();
  let changed = false;

  if (!rawCache || typeof rawCache !== 'object' || Array.isArray(rawCache)) {
    return {
      cache: normalized,
      changed: rawCache !== undefined && rawCache !== null,
    };
  }

  const sourceArticles = rawCache.version === DRAFT_CACHE_VERSION && rawCache.articles && typeof rawCache.articles === 'object'
    ? rawCache.articles
    : rawCache;

  if (sourceArticles !== rawCache.articles || rawCache.version !== DRAFT_CACHE_VERSION) {
    changed = true;
  }

  for (const [rawPath, rawEntry] of Object.entries(sourceArticles)) {
    const sourcePath = normalizeVaultPath(rawPath);
    const entry = normalizeDraftEntry(rawEntry, sourcePath);
    if (!entry) {
      changed = true;
      continue;
    }

    normalized.articles[entry.sourcePath] = entry;
    if (entry.sourcePath !== rawPath || JSON.stringify(entry) !== JSON.stringify(rawEntry)) {
      changed = true;
    }
  }

  const expected = JSON.stringify(normalized);
  if (expected !== JSON.stringify(rawCache)) {
    changed = true;
  }

  return { cache: normalized, changed };
}

function getDraftAssociation(settings, sourcePath, accountId = '') {
  const path = normalizeVaultPath(sourcePath || '');
  if (!path) return null;

  const { cache } = normalizeDraftCache(settings?.draftCache);
  const entry = cache.articles[path] || null;
  if (!entry) return null;

  const expectedAccountId = typeof accountId === 'string' ? accountId.trim() : '';
  if (expectedAccountId && entry.accountId && entry.accountId !== expectedAccountId) {
    return null;
  }

  return { ...entry };
}

function setDraftAssociation(settings, association) {
  if (!settings || typeof settings !== 'object') return createEmptyDraftCache();
  const sourcePath = normalizeVaultPath(association?.sourcePath || association?.filePath || '');
  const entry = normalizeDraftEntry({ ...association, sourcePath }, sourcePath);
  const { cache } = normalizeDraftCache(settings.draftCache);

  if (entry) {
    cache.articles[entry.sourcePath] = {
      ...entry,
      updatedAt: entry.updatedAt || Date.now(),
    };
  }

  settings.draftCache = cache;
  return cache;
}

function clearDraftAssociation(settings, sourcePath) {
  if (!settings || typeof settings !== 'object') return createEmptyDraftCache();
  const path = normalizeVaultPath(sourcePath || '');
  const { cache } = normalizeDraftCache(settings.draftCache);
  if (path) delete cache.articles[path];
  settings.draftCache = cache;
  return cache;
}

module.exports = {
  DRAFT_CACHE_VERSION,
  createEmptyDraftCache,
  normalizeDraftCache,
  getDraftAssociation,
  setDraftAssociation,
  clearDraftAssociation,
};
