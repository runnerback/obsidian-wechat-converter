/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- reason: JS module integrates dynamic Feishu block responses and Obsidian file objects */
// services/feishu-media-sync.js
//
// Feishu docx image replacement adapter. It consumes prepared local image
// assets and leaves remote images to Feishu's import pipeline.

/**
 * @typedef {{ originalSrc: string, path: string, fileName: string, isRemote: boolean, sizeHint?: { width: number, height: number | null } | null }} FeishuMarkdownImageLike
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
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | null}
 */
function getPngDimensions(bytes) {
  if (bytes.length < 24) return null;
  if (
    bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47
    || bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (!width || !height) return null;
  return { width, height };
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | null}
 */
function getGifDimensions(bytes) {
  if (bytes.length < 10) return null;
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== 'GIF') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  if (!width || !height) return null;
  return { width, height };
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | null}
 */
function getJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) return null;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (!width || !height) return null;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | null}
 */
function getWebpDimensions(bytes) {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunk === 'VP8X' && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return width && height ? { width, height } : null;
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return width && height ? { width, height } : null;
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const bits = view.getUint32(21, true);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return width && height ? { width, height } : null;
  }
  return null;
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | null}
 */
function getImageDimensions(bytes) {
  return getPngDimensions(bytes)
    || getGifDimensions(bytes)
    || getJpegDimensions(bytes)
    || getWebpDimensions(bytes);
}

/**
 * Keep the original image dimensions when replacing Feishu image blocks so
 * authors can resize freely inside Feishu without inheriting Obsidian preview
 * width hints.
 *
 * @param {Uint8Array} bytes
 * @param {{ width: number, height: number | null } | null | undefined} _sizeHint
 * @returns {{ width: number, height?: number } | null}
 */
function buildReplacementSize(bytes, _sizeHint) {
  const original = getImageDimensions(bytes);
  if (!original || !original.width || !original.height) return null;
  return {
    width: Math.round(original.width),
    height: Math.round(original.height),
  };
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
      onProgress('processing_images', `正在同步正文图片 (${i + 1}/${localImageItems.length})...`);
    }

    if (!block) {
      addImageDetail(summary, filename, 'skipped', 'feishu_image_block_missing');
      continue;
    }

    try {
      const bytes = await readAssetBytes(app, asset);
      const replacementSize = buildReplacementSize(bytes, image?.sizeHint || null);
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
          ...(replacementSize?.width ? { width: replacementSize.width } : {}),
          ...(replacementSize?.height ? { height: replacementSize.height } : {}),
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
