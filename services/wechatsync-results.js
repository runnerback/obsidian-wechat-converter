const FALLBACK_WECHATSYNC_PLATFORMS = [
  { id: 'zhihu', name: '知乎' },
  { id: 'weibo', name: '微博' },
  { id: 'xiaohongshu', name: '小红书' },
  { id: 'juejin', name: '掘金' },
  { id: 'csdn', name: 'CSDN' },
  { id: 'jianshu', name: '简书' },
  { id: 'toutiao', name: '头条号' },
  { id: 'douyin', name: '抖音图文' },
  { id: 'bilibili', name: 'B站专栏' },
  { id: 'baijiahao', name: '百家号' },
  { id: 'yuque', name: '语雀' },
  { id: 'douban', name: '豆瓣' },
  { id: 'sohu', name: '搜狐号' },
  { id: 'xueqiu', name: '雪球' },
  { id: 'woshipm', name: '人人都是产品经理' },
  { id: 'dayu', name: '大鱼号' },
  { id: 'yidian', name: '一点号' },
  { id: '51cto', name: '51CTO' },
  { id: 'imooc', name: '慕课手记' },
  { id: 'oschina', name: '开源中国' },
  { id: 'segmentfault', name: '思否' },
  { id: 'cnblogs', name: '博客园' },
  { id: 'sohufocus', name: '搜狐焦点' },
  { id: 'x', name: 'X (Twitter)' },
  { id: 'eastmoney', name: '东方财富' },
  { id: 'smzdm', name: '什么值得买' },
  { id: 'netease', name: '网易号' },
  { id: 'wordpress', name: 'WordPress' },
  { id: 'typecho', name: 'Typecho' },
  { id: 'zip-download', name: 'Markdown 压缩包' },
];

function getFallbackWechatsyncPlatforms() {
  return FALLBACK_WECHATSYNC_PLATFORMS.map((platform) => ({ ...platform }));
}

function isPlatformNotFoundError(error = '') {
  return /platform not found|adapter not found|not found/i.test(String(error || ''));
}

function normalizeWechatsyncPlatform(platform = {}) {
  const id = String(platform.id || platform.type || platform.platform || '').trim();
  if (!id || id === 'weixin') return null;
  const nestedAuth = platform.auth && typeof platform.auth === 'object' ? platform.auth : {};
  const user = platform.user && typeof platform.user === 'object' ? platform.user : {};
  const authKnown = platform.authKnown === true
    || Object.prototype.hasOwnProperty.call(platform, 'isAuthenticated')
    || Object.prototype.hasOwnProperty.call(platform, 'authenticated')
    || Object.prototype.hasOwnProperty.call(platform, 'isAuth')
    || Object.prototype.hasOwnProperty.call(platform, 'loggedIn')
    || Object.prototype.hasOwnProperty.call(nestedAuth, 'isAuthenticated')
    || Object.prototype.hasOwnProperty.call(nestedAuth, 'authenticated')
    || Object.prototype.hasOwnProperty.call(nestedAuth, 'loggedIn')
    || typeof platform.status === 'string';
  return {
    id,
    name: String(platform.name || platform.title || platform.platformName || id),
    authKnown,
    authenticated: platform.isAuthenticated === true
      || platform.authenticated === true
      || platform.isAuth === true
      || platform.loggedIn === true
      || nestedAuth.isAuthenticated === true
      || nestedAuth.authenticated === true
      || nestedAuth.loggedIn === true
      || platform.status === 'authenticated'
      || platform.status === 'logged_in'
      || platform.status === '已登录',
    username: typeof platform.username === 'string'
      ? platform.username
      : (typeof platform.accountName === 'string'
        ? platform.accountName
        : (typeof nestedAuth.username === 'string'
          ? nestedAuth.username
          : (typeof user.name === 'string' ? user.name : ''))),
    error: typeof platform.error === 'string' ? platform.error : '',
  };
}

function normalizeWechatsyncCheckAuthResult(candidate = {}, auth = {}) {
  const error = typeof auth?.error === 'string' ? auth.error : '';
  if (isPlatformNotFoundError(error)) return null;
  return normalizeWechatsyncPlatform({
    ...auth,
    id: candidate.id,
    name: candidate.name,
    type: candidate.id,
    platform: candidate.id,
  });
}

async function probeWechatsyncPlatformsIndividually(bridge, options = {}) {
  const {
    candidates = getFallbackWechatsyncPlatforms(),
    timeoutMs = 6000,
    concurrency = 4,
    logger = console,
  } = options;
  const results = [];

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(async (candidate) => {
      try {
        const auth = await bridge.checkAuth(candidate.id, { timeoutMs });
        const normalized = normalizeWechatsyncCheckAuthResult(candidate, auth);
        logger.debug?.('[Wechatsync] fallback checkAuth result', {
          id: candidate.id,
          name: candidate.name,
          authenticated: normalized?.authenticated,
          error: auth?.error || '',
        });
        return normalized;
      } catch (error) {
        logger.debug?.('[Wechatsync] fallback checkAuth failed', {
          id: candidate.id,
          name: candidate.name,
          code: error?.code,
          message: error?.message || String(error),
        });
        return null;
      }
    }));
    results.push(...batchResults.filter(Boolean));
  }

  const byId = new Map();
  for (const platform of results) {
    if (!byId.has(platform.id)) byId.set(platform.id, platform);
  }
  return Array.from(byId.values());
}

function normalizeWechatsyncPlatformList(response) {
  const candidates = Array.isArray(response)
    ? response
    : (Array.isArray(response?.platforms)
      ? response.platforms
      : (Array.isArray(response?.result)
        ? response.result
        : (Array.isArray(response?.data) ? response.data : [])));

  return candidates
    .map((platform) => normalizeWechatsyncPlatform(platform))
    .filter(Boolean);
}

function normalizeWechatsyncAuthSnapshot(response = {}, fallbackPlatforms = []) {
  const source = response && typeof response === 'object' ? response : {};
  const fallbackById = new Map(
    (Array.isArray(fallbackPlatforms) ? fallbackPlatforms : [])
      .map((platform) => normalizeWechatsyncPlatform(platform))
      .filter(Boolean)
      .map((platform) => [platform.id, platform])
  );
  const platforms = normalizeWechatsyncPlatformList(source).map((platform) => {
    const fallback = fallbackById.get(platform.id) || {};
    return {
      ...fallback,
      ...platform,
      name: platform.name && platform.name !== platform.id ? platform.name : (fallback.name || platform.name),
    };
  });
  const checkedAt = Number.isFinite(Number(source.checkedAt))
    ? Number(source.checkedAt)
    : platforms.reduce((latest, platform) => {
      const candidate = Number(platform.checkedAt || platform.lastSuccessAt || platform.lastFailureAt || 0);
      return Number.isFinite(candidate) && candidate > latest ? candidate : latest;
    }, 0);
  return {
    source: typeof source.source === 'string' ? source.source : 'cache',
    checkedAt,
    platforms,
  };
}

function summarizeWechatsyncPlatformResponse(response) {
  const rawPlatforms = Array.isArray(response)
    ? response
    : (Array.isArray(response?.platforms)
      ? response.platforms
      : (Array.isArray(response?.result)
        ? response.result
        : (Array.isArray(response?.data) ? response.data : [])));
  const normalized = normalizeWechatsyncPlatformList(response);
  return {
    responseKind: Array.isArray(response) ? 'array' : typeof response,
    rawCount: rawPlatforms.length,
    normalizedCount: normalized.length,
    authenticatedCount: normalized.filter((platform) => platform.authenticated).length,
    platforms: normalized.map((platform) => ({
      id: platform.id,
      name: platform.name,
      authenticated: platform.authenticated,
      username: platform.username,
    })),
  };
}

function getWechatSyncResultPlatformId(result = {}) {
  return String(result.platform || result.id || result.type || '').trim();
}

function getWechatSyncResultError(result = {}) {
  return String(result.error || result.message || '').trim();
}

function getWechatSyncResultUrl(result = {}) {
  return String(result.postUrl || result.draftUrl || result.editUrl || result.url || result.link || '').trim();
}

function isWechatSyncAuthFailureMessage(message = '') {
  return /未登录|登录|auth|unauthori[sz]ed|forbidden|cookie|token|鉴权|401|403/i.test(String(message || ''));
}

function isWechatSyncConnectionFailure(error = {}) {
  return ['AUTH_FAILED', 'EXTENSION_NOT_CONNECTED', 'BRIDGE_UNAVAILABLE', 'PLATFORM_LIST_TIMEOUT'].includes(error?.code);
}

function normalizeWechatSyncResponseResults(result) {
  if (Array.isArray(result?.results)) return result.results.filter(Boolean);
  if (Array.isArray(result)) return result.filter(Boolean);
  if (result && typeof result === 'object' && 'success' in result) return [result];
  return [];
}

function getMultiPlatformResultSummary(results = [], requestedPlatformIds = [], fatalError = null) {
  const normalizedResults = normalizeWechatSyncResponseResults(results);
  const successResults = normalizedResults.filter((item) => item?.success === true);
  const failedResults = normalizedResults.filter((item) => item?.success === false);
  const authFailedResults = failedResults.filter((item) => isWechatSyncAuthFailureMessage(getWechatSyncResultError(item)));
  const totalCount = normalizedResults.length || requestedPlatformIds.length;
  return {
    normalizedResults,
    successResults,
    failedResults,
    authFailedResults,
    successCount: successResults.length,
    failedCount: failedResults.length,
    totalCount,
    isAllSuccess: totalCount > 0 && !fatalError && successResults.length === totalCount,
  };
}

function updateCachedPlatformsAfterSync(cachedPlatforms = [], results = []) {
  const byId = new Map();
  for (const platform of cachedPlatforms) {
    const normalized = normalizeWechatsyncPlatform(platform);
    if (normalized) byId.set(normalized.id, normalized);
  }

  for (const result of normalizeWechatSyncResponseResults(results)) {
    const platformId = getWechatSyncResultPlatformId(result);
    if (!platformId || platformId === 'weixin') continue;
    const previous = byId.get(platformId) || normalizeWechatsyncPlatform(result) || {
      id: platformId,
      name: platformId,
      authenticated: false,
    };
    const errorMessage = getWechatSyncResultError(result);

    if (result?.success === true) {
      byId.set(platformId, {
        ...previous,
        authenticated: true,
        error: '',
      });
      continue;
    }

    if (isWechatSyncAuthFailureMessage(errorMessage)) {
      byId.set(platformId, {
        ...previous,
        authenticated: false,
        error: errorMessage,
      });
    }
  }

  return Array.from(byId.values());
}

module.exports = {
  getFallbackWechatsyncPlatforms,
  getMultiPlatformResultSummary,
  getWechatSyncResultError,
  getWechatSyncResultPlatformId,
  getWechatSyncResultUrl,
  isWechatSyncAuthFailureMessage,
  isWechatSyncConnectionFailure,
  normalizeWechatSyncResponseResults,
  normalizeWechatsyncAuthSnapshot,
  normalizeWechatsyncCheckAuthResult,
  normalizeWechatsyncPlatformList,
  normalizeWechatsyncPlatform,
  probeWechatsyncPlatformsIndividually,
  summarizeWechatsyncPlatformResponse,
  updateCachedPlatformsAfterSync,
};
