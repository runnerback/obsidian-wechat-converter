// services/x-publish.js
//
// X(Twitter)图卡发布的平台配置层:薄封装,纯逻辑全部委托到 card-publish.js。
// 推文正文不做 280 字截断——由生成端按 X 规则处理,这里原样传。

import {
  extractCardBody,
  cardFilename,
  findPlatformId,
  syncCardsToPlatformFolder,
  buildCardArticle,
} from './card-publish.js';

/** 推文正文标记与小红书一致(同一份「> 发布正文：」约定) */
export const extractXBody = extractCardBody;

/**
 * X 图卡文件名:synced-x-card_00.png …
 * @param {number} index
 * @returns {string}
 */
export function xCardFilename(index) {
  return cardFilename('x', index);
}

/**
 * 在扩展平台列表里找 X 的平台 id(id/name 为 x 或 twitter)。
 * @param {Array<{ id?: string, name?: string }>} platforms
 * @returns {string} 找不到返回空串
 */
export function findXPlatformId(platforms) {
  return findPlatformId(platforms, (id, name) =>
    id === 'x' || id === 'twitter' || name === 'x' || name === 'twitter');
}

/**
 * 把图卡写入笔记同目录的 sync-to-x/。
 * @param {Parameters<typeof syncCardsToPlatformFolder>[0]} app
 * @param {Parameters<typeof syncCardsToPlatformFolder>[1]} noteFile
 * @param {ArrayBuffer[]} buffers
 * @returns {Promise<string>}
 */
export async function syncCardsToXFolder(app, noteFile, buffers) {
  return syncCardsToPlatformFolder(app, noteFile, buffers, 'x');
}

/**
 * 构造 X 桥接协议 article(图卡为附件,正文为 markdown)。
 * @param {{ title: string, body: string, cards: Array<{ base64: string, size: number }>, notePath?: string }} params
 * @returns {{ title: string, markdown: string, content: string, cover: string, assets: Array<Record<string, unknown>> }}
 */
export function buildXArticle({ title, body, cards, notePath = '' }) {
  return buildCardArticle({ title, body, cards, notePath, prefix: 'x', sourceKind: 'x-card' });
}
