// services/rednote-publish.js
//
// 小红书图卡发布的平台配置层:薄封装,纯逻辑全部委托到 card-publish.js。

import {
  extractCardBody,
  extractCardTitle,
  cardFilename,
  findPlatformId,
  syncCardsToPlatformFolder,
  buildCardArticle,
} from './card-publish.js';

/** 小红书正文标记:「> 发布正文：」标记块截取(与 X 共用同一约定) */
export const extractRednoteBody = extractCardBody;

/** 标题 = 第一个一级标题(# xxx);没有则空串(调用方回退文件名) */
export const extractRednoteTitle = extractCardTitle;

/**
 * 小红书图卡文件名:synced-rednote-card_00.png …
 * @param {number} index
 * @returns {string}
 */
export function rednoteCardFilename(index) {
  return cardFilename('rednote', index);
}

/**
 * 在扩展平台列表里找小红书的平台 id(id 含 xiaohongshu/xhs 或名称含「小红书」)。
 * @param {Array<{ id?: string, name?: string }>} platforms
 * @returns {string} 找不到返回空串
 */
export function findXiaohongshuPlatformId(platforms) {
  return findPlatformId(platforms, (id, name) =>
    id.includes('xiaohongshu') || id === 'xhs' || name.includes('小红书'));
}

/**
 * 把图卡写入笔记同目录的 sync-to-rednote/。
 * @param {Parameters<typeof syncCardsToPlatformFolder>[0]} app
 * @param {Parameters<typeof syncCardsToPlatformFolder>[1]} noteFile
 * @param {ArrayBuffer[]} buffers
 * @returns {Promise<string>}
 */
export async function syncCardsToRednoteFolder(app, noteFile, buffers) {
  return syncCardsToPlatformFolder(app, noteFile, buffers, 'rednote');
}

/**
 * 构造小红书桥接协议 article(图卡为 assets,正文为 markdown)。
 * @param {{ title: string, body: string, cards: Array<{ base64: string, size: number }>, notePath?: string }} params
 * @returns {{ title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }}
 */
export function buildRednoteArticle({ title, body, cards, notePath = '' }) {
  return buildCardArticle({ title, body, cards, notePath, prefix: 'rednote', sourceKind: 'rednote-card' });
}
