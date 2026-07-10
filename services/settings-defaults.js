// services/settings-defaults.js
//
// Plugin settings defaults + WeChat account publish-option helpers, extracted
// from input.js (Phase 4 groundwork). Kept as a leaf module so both input.js
// and the settings tab can import them without a circular dependency.

import { createEmptyDraftCache } from './wechat-draft-cache.js';
import { createDefaultMultiPlatformSyncSettings } from './wechatsync-settings.js';
import { createDefaultFeishuSyncSettings } from './feishu-settings.js';
import { createDefaultAiSettings } from './ai-layout.js';

// 默认设置
export const DEFAULT_SETTINGS = {
  theme: 'github',
  themeColor: 'blue',
  customColor: '#0366d6',
  quoteCalloutStyleMode: 'theme',
  fontFamily: 'sans-serif',
  fontSize: 3,
  macCodeBlock: true,
  codeLineNumber: true,
  avatarUrl: '',
  avatarBase64: '',  // Base64 编码的本地头像，优先级高于 avatarUrl
  enableWatermark: false,
  showImageCaption: true,  // 关闭水印时是否显示图片说明文字
  normalizeChinesePunctuation: true, // 默认开启：仅在渲染结果中将英文标点标准化为中文标点
  // 多账号支持
  wechatAccounts: [],  // [{ id, name, appId, appSecret }]
  defaultAccountId: '',
  // 代理设置
  proxyUrl: '',  // Cloudflare Worker 等代理地址
  clientId: '',  // 自动生成的本地设备唯一ID
  draftCache: createEmptyDraftCache(),
  // 预览设置
  usePhoneFrame: true, // 是否使用手机框预览
  // 渲染模式已切换为 native-only
  // 排版设置
  sidePadding: 16, // 页面两侧留白 (px)
  coloredHeader: false, // 标题是否使用主题色
  multiPlatformSync: createDefaultMultiPlatformSyncSettings(),
  feishuSync: createDefaultFeishuSyncSettings(),
  // 标题 AI 润色：复用 ai.defaultProviderId 那个 Provider 的 key/baseUrl，
  // 这里单独控制开关与模型质量（当前 DeepSeek：v4 pro / v4 flash(lite)）。
  titlePolishEnabled: true,
  titlePolishModel: 'deepseek-v4-pro',
  // 旧字段保留用于迁移检测
  wechatAppId: '',
  wechatAppSecret: '',
  ai: createDefaultAiSettings(),
};

// 账号上限
export const MAX_ACCOUNTS = 5;

export const DEFAULT_WECHAT_ACCOUNT_PUBLISH_OPTIONS = Object.freeze({
  contentSourceUrl: '',
  openComment: true,
  onlyFansCanComment: false,
});

/**
 * @param {{ contentSourceUrl?: unknown, openComment?: unknown, onlyFansCanComment?: unknown } | null} [account=null]
 * @returns {{ contentSourceUrl: string, openComment: boolean, onlyFansCanComment: boolean }}
 */
export function getWechatAccountPublishOptions(account = null) {
  return {
    contentSourceUrl: typeof account?.contentSourceUrl === 'string'
      ? account.contentSourceUrl
      : DEFAULT_WECHAT_ACCOUNT_PUBLISH_OPTIONS.contentSourceUrl,
    openComment: typeof account?.openComment === 'boolean'
      ? account.openComment
      : DEFAULT_WECHAT_ACCOUNT_PUBLISH_OPTIONS.openComment,
    onlyFansCanComment: typeof account?.onlyFansCanComment === 'boolean'
      ? account.onlyFansCanComment
      : DEFAULT_WECHAT_ACCOUNT_PUBLISH_OPTIONS.onlyFansCanComment,
  };
}

/**
 * @param {{ contentSourceUrl?: unknown, openComment?: unknown, onlyFansCanComment?: unknown }} [values={}]
 * @returns {{ contentSourceUrl: string, openComment: boolean, onlyFansCanComment: boolean }}
 */
export function normalizeWechatAccountPublishOptions(values = {}) {
  const contentSourceUrl = typeof values.contentSourceUrl === 'string'
    ? values.contentSourceUrl.trim()
    : '';
  const openComment = !!values.openComment;
  return {
    contentSourceUrl,
    openComment,
    onlyFansCanComment: openComment && !!values.onlyFansCanComment,
  };
}

// UI constants shared between the entry file and the settings tab module.
export const MULTI_PLATFORM_TAB_LABEL = '其他平台（小红书/知乎/抖音等）';
// 视图标题（ribbon / command / 视图 tab / 设置面板顶栏 共用）
export const APPLE_STYLE_VIEW_TITLE = 'Content Studio';
