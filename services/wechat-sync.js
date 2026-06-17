import { createHtmlContainer, getActiveDocument } from './dom-utils.js';

/**
 * @typedef {{ mediaId: string, fingerprint?: string, uploadedAt?: number }} CoverCacheEntry
 * @typedef {{ src: string, message?: string }} ImageUploadFailure
 * @typedef {{
 *   id?: string,
 *   appId: string,
 *   appSecret: string,
 *   author?: string,
 *   contentSourceUrl?: string,
 *   openComment?: boolean,
 *   onlyFansCanComment?: boolean,
 * }} WechatAccountLike
 * @typedef {{ title?: string, coverSrc?: string }} PublishMetaLike
 * @typedef {{ basename?: string }} ActiveFileLike
 * @typedef {{ title: string, content: string, thumb_media_id: string, author: string, digest: string, content_source_url?: string, need_open_comment?: number, only_fans_can_comment?: number }} DraftArticleLike
 * @typedef {{
 *   uploadCover: (blob: Blob) => Promise<{ media_id?: string }>,
 *   updateDraft: (mediaId: string, draftIndex: number, article: DraftArticleLike) => Promise<unknown>,
 *   createDraft: (article: DraftArticleLike) => Promise<{ media_id?: string }>,
 * }} WechatDraftApiLike
 * @typedef {{
 *   createApi: (appId: string, appSecret: string, proxyUrl?: string) => WechatDraftApiLike,
 *   srcToBlob: (src: string) => Promise<Blob>,
 *   coverUploadCache?: Map<string, string | CoverCacheEntry> | null,
 *   processAllImages: (html: string, api: WechatDraftApiLike, progressCallback: (current: number, total: number) => void, options: { accountId: string, onImageFailure: (failures: ImageUploadFailure[]) => void }) => Promise<string>,
 *   processMathFormulas: (html: string, api: WechatDraftApiLike, progressCallback: (current: number, total: number) => void) => Promise<string>,
 *   prepareHtmlForDraft?: (html: string) => Promise<string>,
 *   cleanHtmlForDraft: (html: string) => string,
 *   cleanupConfiguredDirectory: (activeFile?: ActiveFileLike | null) => Promise<unknown>,
 *   getFirstImageFromArticle: () => string,
 * }} WechatSyncDeps
 * @typedef {{
 *   account: WechatAccountLike,
 *   proxyUrl?: string,
 *   currentHtml: string,
 *   activeFile?: ActiveFileLike | null,
 *   publishMeta?: PublishMetaLike | null,
 *   sessionTitle?: string,
 *   sessionCoverBase64?: string,
 *   sessionThumbMediaId?: string,
 *   sessionDigest?: string,
 *   draftMediaId?: string,
 *   draftIndex?: number,
 *   onStatus?: (stage: string) => void,
 *   onImageProgress?: (current: number, total: number) => void,
 *   onMathProgress?: (current: number, total: number) => void,
 * }} SyncToDraftOptions
 */

/**
 * @param {string} html
 * @returns {{ html: string, imageSources: string[] }}
 */
export function replaceUnuploadedDraftImagesWithPlaceholders(html) {
  const activeDocument = getActiveDocument();
  if (!activeDocument) {
    return { html, imageSources: [] };
  }

  const div = createHtmlContainer('div', html || '');
  if (!div) return { html, imageSources: [] };
  /** @type {string[]} */
  const imageSources = [];

  Array.from(div.querySelectorAll('img')).forEach((img) => {
    const src = String(img.getAttribute('src') || '').trim();
    const isWechatImage = /^https?:\/\/mmbiz\.qpic\.cn\//i.test(src)
        || /^https?:\/\/mmbiz\.qlogo\.cn\//i.test(src);
    if (src && isWechatImage) return;

    imageSources.push(src);
    const placeholder = activeDocument.createElement('p');
    const missingImagePlaceholderStyle = 'margin:12px 0;padding:10px 12px;border:1px dashed #d0d7de;border-radius:6px;color:#8c6d1f;background:#fff8e5;font-size:13px;line-height:1.7;';
    placeholder.setAttribute('style', missingImagePlaceholderStyle);
    placeholder.textContent = src
      ? `图片未同步，请在微信后台手动补传：${src}`
      : '图片未同步，请在微信后台手动补传。';
    img.replaceWith(placeholder);
  });

  return {
    html: div.innerHTML,
    imageSources,
  };
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hashBytesFNV1a(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * @param {Blob | null | undefined} blob
 * @returns {Promise<string>}
 */
async function computeBlobFingerprint(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') return 'unknown';
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const contentHash = hashBytesFNV1a(bytes);
  const type = blob.type || 'application/octet-stream';
  return `${type}:${bytes.length}:${contentHash}`;
}

/**
 * @param {Map<string, string | CoverCacheEntry> | null | undefined} cache
 * @param {string} key
 * @returns {CoverCacheEntry | null}
 */
function getCachedCoverEntry(cache, key) {
  if (!cache || !cache.has(key)) return null;
  const value = cache.get(key);
  if (typeof value === 'string') {
    return { mediaId: value, fingerprint: '' };
  }
  if (value && typeof value === 'object' && typeof value.mediaId === 'string') {
    return {
      mediaId: value.mediaId,
      fingerprint: typeof value.fingerprint === 'string' ? value.fingerprint : '',
      uploadedAt: typeof value.uploadedAt === 'number' ? value.uploadedAt : undefined,
    };
  }
  return null;
}

/**
 * @param {WechatAccountLike} account
 * @param {string} coverSrc
 * @returns {string}
 */
function buildCoverUploadCacheKey(account, coverSrc) {
  const namespace = String(account?.id || account?.appId || '').trim();
  return `${namespace}::cover::${String(coverSrc || '')}`;
}

/**
 * @param {WechatSyncDeps} deps
 */
export function createWechatSyncService(deps) {
  const {
    createApi,
    srcToBlob,
    coverUploadCache = null,
    processAllImages,
    processMathFormulas,
    prepareHtmlForDraft = async (html) => html,
    cleanHtmlForDraft,
    cleanupConfiguredDirectory,
    getFirstImageFromArticle,
  } = deps;

  return {
    /**
     * @param {SyncToDraftOptions} options
     */
    async syncToDraft({
      account,
      proxyUrl,
      currentHtml,
      activeFile,
      publishMeta,
      sessionTitle,
      sessionCoverBase64,
      sessionThumbMediaId,
      sessionDigest,
      draftMediaId,
      draftIndex = 0,
      onStatus,
      onImageProgress,
      onMathProgress,
    }) {
      const api = createApi(account.appId, account.appSecret, proxyUrl);
      /** @type {ImageUploadFailure[]} */
      const imageUploadFailures = [];

      let thumbMediaId = typeof sessionThumbMediaId === 'string'
        ? sessionThumbMediaId.trim()
        : '';
      if (!thumbMediaId) {
        if (onStatus) onStatus('cover');
        const coverSrc = sessionCoverBase64 || publishMeta?.coverSrc || getFirstImageFromArticle();
        if (!coverSrc) {
          throw new Error('未设置封面图，同步失败。请在弹窗中上传封面。');
        }

        const coverBlob = await srcToBlob(coverSrc);
        const fingerprint = await computeBlobFingerprint(coverBlob);
        const coverCacheKey = buildCoverUploadCacheKey(account, coverSrc);
        const cachedCover = getCachedCoverEntry(coverUploadCache, coverCacheKey);
        if (
          cachedCover &&
          cachedCover.fingerprint &&
          cachedCover.fingerprint === fingerprint &&
          cachedCover.mediaId &&
          (!cachedCover.uploadedAt || Date.now() - cachedCover.uploadedAt < 2.5 * 24 * 60 * 60 * 1000)
        ) {
          thumbMediaId = cachedCover.mediaId;
        } else {
          const coverRes = await api.uploadCover(coverBlob);
          thumbMediaId = coverRes.media_id;
          if (coverUploadCache && thumbMediaId) {
            coverUploadCache.set(coverCacheKey, {
              mediaId: thumbMediaId,
              fingerprint,
              uploadedAt: Date.now(),
            });
          }
        }
      }

      let draftHtml = await prepareHtmlForDraft(currentHtml);

      if (onStatus) onStatus('images');
      let processedHtml = await processAllImages(draftHtml, api, (current, total) => {
        if (onImageProgress) onImageProgress(current, total);
      }, {
        accountId: account.id || '',
        onImageFailure: (failures) => {
          if (Array.isArray(failures)) imageUploadFailures.push(...failures);
        },
      });

      if (processedHtml.includes('mjx-container') || processedHtml.includes('<svg')) {
        if (onStatus) onStatus('math');
        processedHtml = await processMathFormulas(processedHtml, api, (current, total) => {
          if (onMathProgress) onMathProgress(current, total);
        });
      }

      const cleanedResult = replaceUnuploadedDraftImagesWithPlaceholders(cleanHtmlForDraft(processedHtml));
      const cleanedHtml = cleanedResult.html;

      const title = String(sessionTitle || publishMeta?.title || activeFile?.basename || '无标题文章');
      const article = {
        title: title.substring(0, 64),
        content: cleanedHtml,
        thumb_media_id: thumbMediaId,
        author: account.author || '',
        digest: sessionDigest || '一键同步自 Obsidian',
      };
      const contentSourceUrl = String(account.contentSourceUrl || '').trim();
      if (contentSourceUrl) {
        article.content_source_url = contentSourceUrl;
      }
      if (typeof account.openComment === 'boolean') {
        article.need_open_comment = account.openComment ? 1 : 0;
      }
      if (typeof account.onlyFansCanComment === 'boolean') {
        article.only_fans_can_comment = account.onlyFansCanComment ? 1 : 0;
      }

      if (onStatus) onStatus('draft');
      const normalizedDraftMediaId = typeof draftMediaId === 'string' ? draftMediaId.trim() : '';
      const isUpdate = !!normalizedDraftMediaId;
      let mediaId = '';

      if (isUpdate) {
        await api.updateDraft(normalizedDraftMediaId, draftIndex, article);
        mediaId = normalizedDraftMediaId;
      } else {
        const draftRes = await api.createDraft(article);
        mediaId = draftRes?.media_id || '';
      }

      const cleanupResult = await cleanupConfiguredDirectory(activeFile);

      return {
        article,
        mediaId,
        isUpdate,
        draftIndex,
        cleanupResult,
        imageUploadFailures,
        placeholderImageSources: cleanedResult.imageSources,
      };
    },
  };
}
