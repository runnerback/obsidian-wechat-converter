/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: JS file handles dynamic API responses without strict typescript type annotations */
// services/feishu-sync.js
//
// High-level orchestrator for Feishu cloud documents synchronization.
// Integrates settings, preprocessor, and low-level API client.
// Uses Obsidian APIs (via injected 'app' dependency) and requestUrl.

import { getActiveWindowValue } from './dom-utils.js';
import { resolveArticleImages } from './article-image-assets.js';
import { FeishuApiClient } from './feishu-api.js';
import { createImageSummary, replaceFeishuImageBlocks } from './feishu-media-sync.js';
import {
  stripYamlFrontmatter,
  parseYamlTitle,
  convertWikilinks,
  getImageFileNameFromSrc,
} from './feishu-markdown-processor.js';
import { addFeishuUploadHistory, findFeishuHistoryByPath } from './feishu-settings.js';

const FEISHU_LOCAL_IMAGE_PLACEHOLDER_BASE = 'https://obsidian-wechat-converter.invalid/feishu-local-image';

/**
 * @param {{ id?: string, filename?: string }} asset
 * @returns {string}
 */
function createFeishuLocalImagePlaceholder(asset) {
  const rawName = String(asset?.filename || '').trim();
  const extensionMatch = rawName.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'png';
  return `${FEISHU_LOCAL_IMAGE_PLACEHOLDER_BASE}/${asset?.id || 'image'}.${extension}`;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Resolves local Obsidian image references for Feishu block replacement while
 * keeping the Markdown import source readable for Feishu's converter.
 * @param {any} app Obsidian App instance
 * @param {any} activeFile TFile
 * @param {string} markdown
 * @returns {Promise<{ markdown: string, assets: Array<{ id: string, filename: string, mimeType: string, base64: string }>, warnings: Array<{ message?: string, src?: string, filename?: string }>, references: Array<{ originalSrc: string, path: string, fileName: string, isRemote: boolean, sizeHint?: { width: number, height: number | null } | null }> }>}
 */
async function prepareLocalImagesForFeishu(app, activeFile, markdown) {
  const result = await resolveArticleImages(markdown, activeFile, {
    app,
    localImageSrcFactory: createFeishuLocalImagePlaceholder,
  });

  return {
    markdown: result.markdown,
    assets: result.assets || [],
    warnings: result.warnings || [],
    references: (result.references || []).map((ref) => {
      const resolvedSrc = String(ref?.resolvedSrc || ref?.originalSrc || '');
      const decodedPath = decodeURI(resolvedSrc);
      return {
        originalSrc: resolvedSrc,
        path: decodedPath,
        fileName: getImageFileNameFromSrc(String(ref?.originalSrc || resolvedSrc)),
        isRemote: /^https?:\/\//i.test(decodedPath) || decodedPath.startsWith('data:'),
        sizeHint: ref?.sizeHint || null,
      };
    }),
  };
}

/**
 * Orchestrates the sync flow.
 * @param {object} params
 * @param {any} params.app Obsidian App
 * @param {object} params.settings Feishu settings object
 * @param {any} params.activeFile TFile
 * @param {string} params.markdown Note content
 * @param {function} [params.onProgress] progress callback (stage, message)
 * @param {any} [params.requestUrl] requestUrl implementation
 * @returns {Promise<{ title: string, url: string, docToken: string, transferOwnerWarning?: string, imageSummary: { uploaded: number, skipped: number, failed: number, details: Array<{ filename: string, status: string, reason: string }> } }>}
 */
async function syncNoteToFeishu({ app, settings, activeFile, markdown, onProgress, requestUrl }) {
  const notify = (stage, msg) => {
    if (typeof onProgress === 'function') {
      onProgress(stage, msg);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic requestUrl extraction
  const obsidianApi = getActiveWindowValue('obsidian');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: dynamic requestUrl extraction
  const requestUrlImpl = requestUrl || (obsidianApi && typeof obsidianApi.requestUrl === 'function' ? obsidianApi.requestUrl : null);

  // 1. Resolve document title
  let title = parseYamlTitle(markdown);
  if (!title) title = activeFile.basename;
  title = title.substring(0, 250); // limit Feishu title length

  // 2. Initialize API client
  const client = new FeishuApiClient(settings.appId, settings.appSecret, requestUrlImpl);

  // 3. Fallback Folder Search for lost history
  let historyItem = findFeishuHistoryByPath(settings, activeFile.path);
  if (!historyItem) {
    notify('searching_folder', '正在检索飞书目标文件夹中是否存在同名文档...');
    try {
      const items = await client.listFolderItems(settings.folderToken);
      const matched = items.find((x) => x.name === title && x.type === 'docx');
      if (matched) {
        historyItem = {
          title,
          url: `https://open.feishu.cn/docx/${matched.token}`,
          docToken: matched.token,
          sourcePath: activeFile.path,
        };
        addFeishuUploadHistory(settings, historyItem);
        notify('searching_folder', '命中飞书同名文档，自动关联并恢复更新链路');
      }
    } catch (err) {
      console.warn('[飞书同步] 文件夹检索失败 (不影响正常创建):', err);
    }
  }

  // 4. Preprocess Markdown body
  let processedMd = stripYamlFrontmatter(markdown);
  processedMd = convertWikilinks(processedMd, settings.uploadHistory);
  const localImageResult = await prepareLocalImagesForFeishu(app, activeFile, processedMd);
  processedMd = localImageResult.markdown;
  const imageSummary = createImageSummary();
  for (const warning of localImageResult.warnings) {
    const detail = warning.filename || warning.src || '';
    console.warn('[飞书同步] 本地图片预处理跳过:', detail ? `${warning.message || '图片无法处理'} (${detail})` : warning.message || warning);
    imageSummary.skipped += 1;
    imageSummary.details.push({
      filename: warning.filename || warning.src || 'image',
      status: 'skipped',
      reason: warning.code || warning.message || 'image_prepare_warning',
    });
  }

  // 5. Check if it's a Smart Update or a New Document
  let docToken = '';
  let docUrl = '';

  const importAsNewDocument = async () => {
    notify('uploading_temp', '正在生成临时 Markdown 上传文件...');
    const textEncoder = new TextEncoder();
    const mdBase64 = arrayBufferToBase64(textEncoder.encode(processedMd).buffer);
    
    const tempFileToken = await client.uploadFile(title + '.md', mdBase64, settings.folderToken);
    
    notify('importing', '正在导入为飞书云文档...');
    const ticket = await client.createImportTask(title, tempFileToken, settings.folderToken);
    
    const result = await client.waitForImportTask(ticket);
    docToken = result.token;
    docUrl = result.url;

    // Delete temp file silently in the background
    client.deleteFile(tempFileToken, 'file').catch((err) => {
      console.warn('[飞书同步] 清理临时 MD 文件失败:', err);
    });

    historyItem = {
      title,
      url: docUrl,
      docToken: docToken,
      sourcePath: activeFile.path,
    };
  };

  if (historyItem && historyItem.docToken) {
    docToken = historyItem.docToken;
    docUrl = historyItem.url;

    try {
      // Smart Update: Delete child blocks and overwrite
      notify('deleting_blocks', '正在清空旧文档内容...');
      const blocks = await client.getDocumentBlocks(docToken);
      
      // Find direct children of root block (root block id = docToken)
      const childBlockIds = blocks
        .filter((x) => x.parent_id === docToken && x.block_id !== docToken)
        .map((x) => x.block_id);

      if (childBlockIds.length > 0) {
        await client.batchDeleteBlocks(docToken, docToken, 0, childBlockIds.length);
      }

      notify('importing', '正在转换并写入新内容...');
      const newBlocks = await client.convertMarkdownToBlocks(processedMd);
      
      // Chunk block insertions to Feishu's 50 blocks limit per request
      if (newBlocks && newBlocks.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < newBlocks.length; i += chunkSize) {
          const chunk = newBlocks.slice(i, i + chunkSize);
          notify('importing', `正在写入内容块 (${i + 1}/${newBlocks.length})...`);
          await client.createDocumentBlocks(docToken, docToken, i, chunk);
          if (i + chunkSize < newBlocks.length) {
            await new Promise((resolve) => window.setTimeout(resolve, 300)); // rate throttle
          }
        }
      }

      // Check if renamed locally and update Feishu document filename
      if (title !== historyItem.title) {
        notify('renaming', '正在更新飞书文档名称...');
        try {
          await client.renameFile(docToken, title);
          historyItem.title = title;
        } catch (err) {
          console.warn('[飞书同步] 重命名失败:', err);
        }
      }
    } catch (err) {
      console.warn('[飞书同步] 智能覆盖更新失败，降级为新建文档:', err);
      notify('importing', '更新旧文档失败，正在新建飞书文档...');
      await importAsNewDocument();
    }
  } else {
    await importAsNewDocument();
  }

  // 6. Image processing and patching
  const images = localImageResult.references || [];
  if (images.length > 0) {
    notify('processing_images', '正在扫描文档图片结构...');
    try {
      const replacementSummary = await replaceFeishuImageBlocks({
        app,
        client,
        docToken,
        images,
        assets: localImageResult.assets,
        onProgress: notify,
      });
      imageSummary.uploaded += replacementSummary.uploaded;
      imageSummary.skipped += replacementSummary.skipped;
      imageSummary.failed += replacementSummary.failed;
      imageSummary.details.push(...replacementSummary.details);
    } catch (err) {
      console.warn('[飞书同步] 图片后处理跳过，文档正文已导入:', err);
      imageSummary.failed += 1;
      imageSummary.details.push({
        filename: '文档图片结构',
        status: 'failed',
        reason: err?.message || String(err || 'image_post_process_failed'),
      });
    }
  }

  // 7. Non-blocking Ownership Transfer
  let transferOwnerWarning = '';
  if (settings.userId) {
    notify('transfer_owner', '正在转移文档所有权至配置用户...');
    try {
      await client.transferDocumentOwnership(docToken, settings.userId);
    } catch (err) {
      console.warn('[飞书同步] 文档所有权转移失败:', err);
      transferOwnerWarning = err.message || String(err);
    }
  }

  // 8. Update Settings History registry
  addFeishuUploadHistory(settings, historyItem);

  return {
    title,
    url: docUrl,
    docToken,
    transferOwnerWarning,
    imageSummary,
  };
}

export {
  prepareLocalImagesForFeishu,
  syncNoteToFeishu,
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- reason: resume typed linting after Feishu sync orchestration boundary */
