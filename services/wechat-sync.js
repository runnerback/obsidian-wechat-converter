const { createHtmlContainer } = require('./dom-utils');

function replaceUnuploadedDraftImagesWithPlaceholders(html) {
  if (typeof document === 'undefined') {
    return { html, imageSources: [] };
  }

  const div = createHtmlContainer('div', html || '');
  const imageSources = [];

  Array.from(div.querySelectorAll('img')).forEach((img) => {
    const src = String(img.getAttribute('src') || '').trim();
    const isWechatImage = /^https?:\/\/mmbiz\.qpic\.cn\//i.test(src)
        || /^https?:\/\/mmbiz\.qlogo\.cn\//i.test(src);
    if (src && isWechatImage) return;

    imageSources.push(src);
    const placeholder = document.createElement('p');
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

function hashBytesFNV1a(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function computeBlobFingerprint(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') return 'unknown';
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const contentHash = hashBytesFNV1a(bytes);
  const type = blob.type || 'application/octet-stream';
  return `${type}:${bytes.length}:${contentHash}`;
}

function getCachedCoverEntry(cache, key) {
  if (!cache || !cache.has(key)) return null;
  const value = cache.get(key);
  if (typeof value === 'string') {
    return { mediaId: value, fingerprint: '' };
  }
  if (value && typeof value === 'object' && typeof value.mediaId === 'string') {
    return value;
  }
  return null;
}

function buildCoverUploadCacheKey(account, coverSrc) {
  const namespace = String(account?.id || account?.appId || '').trim();
  return `${namespace}::cover::${String(coverSrc || '')}`;
}

function createWechatSyncService(deps) {
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
      const imageUploadFailures = [];

      let thumbMediaId = typeof sessionThumbMediaId === 'string'
        ? sessionThumbMediaId.trim()
        : '';
      if (!thumbMediaId) {
        if (onStatus) onStatus('cover');
        const coverSrc = sessionCoverBase64 || publishMeta.coverSrc || getFirstImageFromArticle();
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

      const title = sessionTitle || publishMeta?.title || activeFile?.basename || '无标题文章';
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

module.exports = {
  replaceUnuploadedDraftImagesWithPlaceholders,
  createWechatSyncService,
};
