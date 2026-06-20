/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- reason: JS module integrates dynamic Feishu block responses and Obsidian file objects */
// services/feishu-media-sync.js
//
// Feishu docx image replacement adapter. It consumes prepared local image
// assets and leaves remote images to Feishu's import pipeline.

/**
 * @typedef {{ originalSrc: string, path: string, fileName: string, isRemote: boolean }} FeishuMarkdownImageLike
 * @typedef {{ id: string, filename: string, mimeType: string, base64?: string, source?: { vaultRelativePath?: string, originalSrc?: string } }} FeishuLocalImageAssetLike
 * @typedef {{ uploaded: number, skipped: number, failed: number, details: Array<{ filename: string, status: string, reason: string }> }} FeishuImageSummary
 */

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
 * @returns {FeishuImageSummary}
 */
function createImageSummary() {
  return {
    uploaded: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };
}

/**
 * @param {FeishuImageSummary} summary
 * @param {string} filename
 * @param {string} status
 * @param {string} reason
 */
function addImageDetail(summary, filename, status, reason) {
  summary.details.push({ filename, status, reason });
  if (status === 'uploaded') summary.uploaded += 1;
  else if (status === 'skipped') summary.skipped += 1;
  else summary.failed += 1;
}

/**
 * @param {unknown} app
 * @param {FeishuLocalImageAssetLike} asset
 * @returns {Promise<Uint8Array>}
 */
async function readAssetBytes(app, asset) {
  const vaultRelativePath = asset?.source?.vaultRelativePath || '';
  const file = vaultRelativePath && app?.vault?.getAbstractFileByPath
    ? app.vault.getAbstractFileByPath(vaultRelativePath)
    : null;
  if (!file) {
    throw new Error(`找不到本地图片文件: ${vaultRelativePath || asset.filename}`);
  }
  return toUint8Array(await app.vault.readBinary(file));
}

/**
 * @param {FeishuMarkdownImageLike} image
 * @param {FeishuLocalImageAssetLike[]} assets
 * @returns {FeishuLocalImageAssetLike | null}
 */
function findLocalAssetForImage(image, assets) {
  const originalSrc = String(image?.originalSrc || '');
  if (originalSrc.startsWith('asset://')) {
    return assets.find((asset) => originalSrc === `asset://${asset.id}`) || null;
  }
  return assets.find((asset) => (
    asset?.source?.placeholderSrc === originalSrc ||
    asset?.source?.originalSrc === originalSrc ||
    asset?.source?.vaultRelativePath === image.path
  )) || null;
}

/**
 * @param {{
 *   app: unknown,
 *   client: { getDocumentBlocks: Function, uploadImageMaterialBytes: Function, updateBlock: Function },
 *   docToken: string,
 *   images: FeishuMarkdownImageLike[],
 *   assets: FeishuLocalImageAssetLike[],
 *   onProgress?: Function,
 * }} params
 * @returns {Promise<FeishuImageSummary>}
 */
async function replaceFeishuImageBlocks({ app, client, docToken, images, assets, onProgress }) {
  const summary = createImageSummary();
  const imageItems = (images || []).map((image, index) => ({
    image,
    imageIndex: index,
    asset: findLocalAssetForImage(image, assets || []),
  }));
  const localImageItems = imageItems.filter((item) => item.asset);
  if (localImageItems.length === 0) return summary;

  const blocks = await client.getDocumentBlocks(docToken);
  const imageBlocks = (blocks || []).filter((block) => block.block_type === 27);

  for (let i = 0; i < localImageItems.length; i++) {
    const { image, imageIndex, asset } = localImageItems[i];
    const block = imageBlocks[imageIndex];
    const filename = asset?.filename || image.fileName || 'image';

    if (typeof onProgress === 'function') {
      onProgress('processing_images', `正在同步正文图片 (${i + 1}/${localImageItems.length}): ${filename}...`);
    }

    if (!block) {
      addImageDetail(summary, filename, 'skipped', 'feishu_image_block_missing');
      continue;
    }

    try {
      const bytes = await readAssetBytes(app, asset);
      const imageToken = await client.uploadImageMaterialBytes(
        filename,
        bytes,
        docToken,
        block.block_id,
        asset.mimeType || 'application/octet-stream'
      );

      await client.updateBlock(docToken, block.block_id, {
        replace_image: {
          token: imageToken,
          align: 2,
        },
      });
      addImageDetail(summary, filename, 'uploaded', 'ok');
    } catch (err) {
      console.error(`[飞书同步] 图片 ${filename} 同步失败:`, err);
      const reason = err && typeof err === 'object' && 'message' in err ? err.message : String(err || 'unknown_error');
      addImageDetail(summary, filename, 'failed', reason);
    }
  }

  return summary;
}

export {
  createImageSummary,
  replaceFeishuImageBlocks,
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- reason: resume typed linting after Feishu media adapter boundary */
