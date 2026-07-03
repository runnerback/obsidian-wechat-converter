/**
 * @typedef {{ cls?: string, text?: string, value?: string | number, type?: string, href?: string, title?: string, placeholder?: string, checked?: boolean, style?: string, attr?: Record<string, unknown> }} ElementCreateOptionsLike
 * @typedef {HTMLElement & {
 *   createEl: (tag: string, options?: ElementCreateOptionsLike) => ObsidianElementLike,
 *   createDiv: (options?: ElementCreateOptionsLike) => ObsidianElementLike,
 *   createSpan: (options?: ElementCreateOptionsLike) => ObsidianElementLike,
 *   empty: () => void,
 *   addClass: (className: string) => void,
 *   removeClass: (className: string) => void,
 *   toggleClass: (className: string, enabled: boolean) => void,
 *   setCssStyles?: (styles: Record<string, string | number>) => void,
 *   setText?: (text: string) => void,
 *   appendText?: (text: string) => void
 * }} ObsidianElementLike
 * @typedef {ObsidianElementLike & { value: string, checked: boolean, disabled: boolean, selected: boolean }} ObsidianInputLike
 * @typedef {{ base64?: string, mimeType?: string }} WechatsyncAssetLike
 * @typedef {{ getValue?: () => string, getSelection?: () => string, replaceSelection?: (value: string) => void }} EditorLike
 * @typedef {{ path?: string, name?: string, basename?: string }} TFileLike
 * @typedef {{ file?: TFileLike | null, editor?: EditorLike, contentEl: ObsidianElementLike }} MarkdownViewLike
 * @typedef {{ type?: string, state?: Record<string, unknown>, icon?: string, title?: string, active?: boolean }} ViewStateLike
 * @typedef {{ open?: () => void, view?: unknown, getViewState?: () => ViewStateLike, setViewState?: (state: ViewStateLike) => Promise<void> }} LeafLike
 * @typedef {{ on: (name: string, callback: (...args: unknown[]) => unknown) => unknown, getActiveViewOfType: (viewType: unknown) => MarkdownViewLike | null, getActiveFile?: () => TFileLike | null, getLeavesOfType: (viewType: string) => LeafLike[], getRightLeaf: (split?: boolean) => LeafLike | null, getLeaf?: (type?: string | boolean) => LeafLike | null, onLayoutReady: (callback: () => void) => void, revealLeaf?: (leaf: unknown) => Promise<void>, setActiveLeaf?: (leaf: unknown, options?: Record<string, unknown>) => void }} WorkspaceLike
 * @typedef {{ adapter?: unknown, configDir?: string, on?: (name: string, callback: (...args: unknown[]) => unknown) => unknown, getConfig?: (key: string) => unknown, getAbstractFileByPath?: (path: string) => unknown, getResourcePath?: (file: unknown) => string, trash?: (file: unknown, useSystemTrash?: boolean) => Promise<void>, delete?: (file: unknown, force?: boolean) => Promise<void>, read?: (file: unknown) => Promise<string>, modify?: (file: unknown, data: string) => Promise<void> }} VaultLike
 * @typedef {{ processFrontMatter?: (file: unknown, callback: (frontmatter: Record<string, unknown>) => void) => Promise<void> }} FileManagerLike
 * @typedef {{ getFileCache?: (file: unknown) => { frontmatter?: Record<string, unknown> } | null }} MetadataCacheLike
 * @typedef {{ activeTab?: Record<string, unknown>, open?: () => void, openTabById?: (id: string) => void }} AppSettingLike
 * @typedef {{ vault: VaultLike, workspace: WorkspaceLike, fileManager?: FileManagerLike, metadataCache?: MetadataCacheLike, setting?: AppSettingLike, isMobile?: boolean }} AppLike
 * @typedef {{ id: string, name: string, callback?: () => unknown, editorCallback?: (editor: EditorLike) => unknown }} CommandLike
 * @typedef {{ app: AppLike, manifest?: { id?: string, version?: string, dir?: string }, registerEvent: (event: unknown) => void, registerView: (viewType: string, factory: (leaf: LeafLike) => unknown) => void, addRibbonIcon: (icon: string, title: string, callback: () => unknown) => unknown, addCommand: (command: CommandLike) => void, addSettingTab: (tab: unknown) => void, loadData: () => Promise<unknown>, saveData: (data: unknown) => Promise<void> }} PluginBaseLike
 * @typedef {{ app: AppLike, containerEl: ObsidianElementLike, registerEvent: (event: unknown) => void }} ItemViewBaseLike
 * @typedef {{ app: AppLike, containerEl: ObsidianElementLike }} SettingTabBaseLike
 * @typedef {{ titleEl: ObsidianElementLike, contentEl: ObsidianElementLike, modalEl?: ObsidianElementLike, open: () => void, close: () => void, onClose?: () => void }} ModalLike
 * @typedef {{ setValue: (value: boolean) => ToggleComponentLike, onChange: (callback: (value: boolean) => unknown) => ToggleComponentLike }} ToggleComponentLike
 * @typedef {{ inputEl?: ObsidianElementLike, setPlaceholder: (value: string) => TextComponentLike, setValue: (value: string) => TextComponentLike, onChange: (callback: (value: string) => unknown) => TextComponentLike }} TextComponentLike
 * @typedef {{ addOption: (value: string, label: string) => DropdownComponentLike, setValue: (value: string) => DropdownComponentLike, onChange: (callback: (value: string) => unknown) => DropdownComponentLike }} DropdownComponentLike
 * @typedef {{ setButtonText: (value: string) => ButtonComponentLike, onClick: (callback: () => unknown) => ButtonComponentLike, setDestructive?: () => ButtonComponentLike, setWarning?: () => ButtonComponentLike }} ButtonComponentLike
 * @typedef {{ setName: (value: string) => SettingComponentLike, setDesc: (value: string) => SettingComponentLike, setHeading: () => SettingComponentLike, addToggle: (callback: (toggle: ToggleComponentLike) => unknown) => SettingComponentLike, addText: (callback: (text: TextComponentLike) => unknown) => SettingComponentLike, addDropdown: (callback: (dropdown: DropdownComponentLike) => unknown) => SettingComponentLike, addButton: (callback: (button: ButtonComponentLike) => unknown) => SettingComponentLike }} SettingComponentLike
 * @typedef {{ setMessage: (message: string) => void, hide: () => void }} NoticeLike
 * @typedef {{ value: string, label: string }} ThemeOptionLike
 * @typedef {{ value: string, color: string }} ThemeColorOptionLike
 * @typedef {{ getThemeList: () => ThemeOptionLike[], getColorList: () => ThemeColorOptionLike[] }} AppleThemeApiLike
 * @typedef {{ new (...args: unknown[]): unknown }} ConstructorLike
 * @typedef {{ Plugin: new (...args: unknown[]) => PluginBaseLike, MarkdownView: ConstructorLike, ItemView: new (...args: unknown[]) => ItemViewBaseLike, Notice: new (message: string, timeout?: number) => NoticeLike, Platform: Record<string, unknown>, PluginSettingTab: new (...args: unknown[]) => SettingTabBaseLike, Setting: new (containerEl: ObsidianElementLike | HTMLElement) => SettingComponentLike, Modal?: new (app: AppLike) => ModalLike, setIcon?: (element: HTMLElement, icon: string) => void, requestUrl?: (options: Record<string, unknown>) => Promise<unknown>, request?: (options: Record<string, unknown>) => Promise<unknown>, MarkdownRenderer?: unknown }} ObsidianApiLike
 * @typedef {{ id: string, name: string, appId: string, appSecret: string, author?: string, contentSourceUrl?: string, openComment?: boolean, onlyFansCanComment?: boolean }} WechatAccountLike
 * @typedef {{ sourcePath?: string, mediaId?: string, index?: number }} DraftAssociationLike
 * @typedef {{ modal?: ModalLike, isProxyAuth?: boolean, draftAssociation?: DraftAssociationLike }} SyncModalOptionsLike
 * @typedef {{ mediaId: string, url?: string, name?: string }} WechatMaterialSelectionLike
 * @typedef {{ media_id?: string, mediaId?: string, url?: string, name?: string }} WechatMaterialItemLike
 * @typedef {{ item?: WechatMaterialItemLike[], total_count?: number, item_count?: number, fromCache?: boolean, [key: string]: unknown }} WechatMaterialPageLike
 * @typedef {{ cachedAt: number, data: WechatMaterialPageLike }} WechatMaterialCacheEntryLike
 * @typedef {{ coverBase64?: string, thumbMediaId?: string, materialCover?: WechatMaterialSelectionLike | null, title?: string, digest?: string }} ArticleSessionStateLike
 * @typedef {{ id?: string, platform?: string, name?: string, status?: string, success?: boolean, url?: string, error?: string, message?: string, [key: string]: unknown }} WechatsyncPlatformResultLike
 * @typedef {{ found?: boolean, title?: string, platforms?: WechatsyncPlatformResultLike[], [key: string]: unknown }} WechatsyncTaskSnapshotLike
 * @typedef {{ skippedPlatforms?: unknown[], publishedPlatforms?: unknown[], platforms?: unknown[], quotaBlocked?: boolean, reason?: string, message?: string, [key: string]: unknown }} WechatsyncQuotaResultLike
 * @typedef {{ start: () => Promise<unknown>, stop?: () => Promise<void>, waitForConnection?: (timeoutMs?: number) => Promise<unknown>, openSyncTask?: (taskId: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>, getSyncTaskLink?: (taskId: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>, getSyncTask?: (taskId: string, options?: Record<string, unknown>) => Promise<WechatsyncTaskSnapshotLike | Record<string, unknown>> }} WechatSyncBridgeServiceLike
 * @typedef {{ warning?: string, attempted?: boolean, success?: boolean, cleanedPath?: string }} CleanupResultLike
 * @typedef {{ src?: string, [key: string]: unknown }} ImageUploadFailureLike
 * @typedef {{ cleanupResult?: CleanupResultLike, imageUploadFailures?: ImageUploadFailureLike[], placeholderImageSources?: string[], mediaId?: string, isUpdate?: boolean, draftIndex?: number, [key: string]: unknown }} WechatDraftSyncResultLike
 * @typedef {{ account: WechatAccountLike, proxyUrl?: string, currentHtml: string, activeFile?: TFileLike | null, publishMeta?: Record<string, unknown> | null, sessionTitle?: string, sessionCoverBase64?: string, sessionThumbMediaId?: string, sessionDigest?: string, draftMediaId?: string, draftIndex?: number, onStatus?: (stage: string) => void, onImageProgress?: (current: number, total: number) => void, onMathProgress?: (current: number, total: number) => void }} WechatSyncToDraftOptionsLike
 * @typedef {{ syncToDraft: (options: WechatSyncToDraftOptionsLike) => Promise<WechatDraftSyncResultLike> }} WechatSyncServiceLike
 * @typedef {{ mediaId?: string, fingerprint?: string, [key: string]: unknown }} CoverCacheEntry
 * @typedef {{ url?: string, [key: string]: unknown }} ImageCacheEntry
 * @typedef {{ url?: string, [key: string]: unknown }} SvgUploadCacheEntry
 * @typedef {{ ok: boolean, markdown?: string, sourcePath?: string }} MarkdownSourceResultLike
 * @typedef {{ showLoading?: boolean, loadingText?: string, loadingDelay?: number, sourceOverride?: { markdown?: string, sourcePath?: string } | null }} ConvertCurrentOptionsLike
 * @typedef {{ sourcePath?: string, settings?: PluginSettingsLike | Record<string, unknown> }} RenderCandidateContextLike
 * @typedef {{ id: string, name: string, kind: string, baseUrl: string, apiKey: string, model: string, enabled?: boolean }} AiProviderLike
 * @typedef {{ enabled: boolean, defaultLayoutFamily: string, defaultColorPalette: string, defaultProviderId: string, customColor?: string, includeImagesInLayout?: boolean, requestTimeoutMs?: number, providers: AiProviderLike[], articleLayoutsByPath: Record<string, unknown> }} AiSettingsLike
 * @typedef {{ theme: string, themeColor: string, customColor: string, quoteCalloutStyleMode: string, fontFamily: string, fontSize: number, macCodeBlock: boolean, codeLineNumber: boolean, avatarUrl: string, avatarBase64: string, enableWatermark: boolean, showImageCaption: boolean, normalizeChinesePunctuation: boolean, wechatAccounts: WechatAccountLike[], defaultAccountId: string, proxyUrl: string, clientId: string, draftCache: unknown, usePhoneFrame: boolean, sidePadding: number, coloredHeader: boolean, cleanupAfterSync: boolean, cleanupUseSystemTrash: boolean, cleanupDirTemplate: string, multiPlatformSync: unknown, wechatAppId: string, wechatAppSecret: string, ai: AiSettingsLike, [key: string]: unknown }} PluginSettingsLike
 * @typedef {{ update: (values: Record<string, unknown>) => void }} ThemeRuntimeLike
 * @typedef {{ updateConfig?: (values: Record<string, unknown>) => void, reinit?: () => void, initMarkdownIt?: () => Promise<void> }} ConverterRuntimeLike
 * @typedef {{ renderForPreview: (markdown: string, context: { sourcePath: string, settings: PluginSettingsLike }) => Promise<string> }} RenderPipelineLike
 * @typedef {{ updateAiToolbarState?: () => void, refreshAiLayoutPanel?: () => void }} ConverterViewRefreshLike
 * @typedef {PluginBaseLike & { settings: PluginSettingsLike, obsidianApi?: ObsidianApiLike, _wechatSyncBridgeService?: WechatSyncBridgeServiceLike, _wechatSyncBridgeCacheKey?: string, _lastSaveSettingsErrorAt?: number, openConverter: () => Promise<void>, openExternalUrl?: (url: string) => boolean, getConverterView?: () => unknown, getWechatSyncBridgeService?: () => WechatSyncBridgeServiceLike, saveSettings: () => Promise<boolean>, getArticleLayoutState?: (sourcePath: string, selection?: AiLayoutSelectionLike | Record<string, unknown>) => AiLayoutStateLike | null, saveArticleLayoutState?: (sourcePath: string, nextState: AiLayoutStateLike | Record<string, unknown>, selection?: AiLayoutSelectionLike | Record<string, unknown>) => Promise<AiLayoutStateLike | null> }} AppleStylePluginLike
 * @typedef {{ settings?: PluginSettingsLike | Record<string, unknown> }} PluginWithSettingsLike
 * @typedef {{ setDestructive?: () => unknown, setWarning?: () => unknown }} ButtonCompatLike
 * @typedef {{ renderSettingsContent?: () => void, [key: string]: unknown }} SettingTabCompatLike
 * @typedef {{ commandName: string, zhTitle: string, enTitle: string, zhPlaceholder: string[], enPlaceholder: string[], zhNotice: string, enNotice: string }} ImageSwipeCopyLike
 * @typedef {{ message: string, isFatal?: boolean, isProxyAuth?: boolean }} ReadableErrorLike
 * @typedef {{ method?: string, body?: string, headers?: Record<string, string>, contentType?: string, throw?: boolean }} RequestUrlOptionsLike
 * @typedef {{ status: number, json?: unknown, text: string, arrayBuffer?: () => Promise<ArrayBuffer>, headers: Record<string, string> }} RequestUrlResponseLike
 * @typedef {{ checkbox: ObsidianInputLike, toggle: ObsidianElementLike }} CaptionToggleStateLike
 * @typedef {{ layoutFamily?: string, colorPalette?: string }} AiLayoutSelectionLike
 * @typedef {{ type?: string, sectionIndex?: number, title?: string, caseLabel?: string, text?: string, caption?: string, buttonText?: string, imageId?: string, [key: string]: unknown }} AiLayoutBlockLike
 * @typedef {{ blocks?: AiLayoutBlockLike[], selection?: AiLayoutSelectionLike, resolved?: AiLayoutSelectionLike, articleType?: string, stylePack?: string, recommendedLayoutFamily?: string, recommendedColorPalette?: string, layoutFamily?: string, title?: string, summary?: string, [key: string]: unknown }} AiLayoutJsonLike
 * @typedef {{ source?: string, originalIndex?: number, blockKey?: string, type?: string, label?: string, index?: number, [key: string]: unknown }} AiLayoutBlockOriginLike
 * @typedef {{ providerName?: string, providerModel?: string, blockOrigins?: AiLayoutBlockOriginLike[], schemaValidation?: AiSchemaValidationLike, executionMode?: string, fallbackUsed?: boolean, fallbackBlockCount?: number, [key: string]: unknown }} AiLayoutGenerationMetaLike
 * @typedef {{ issueCount?: number, fatal?: boolean, issues?: { path?: string, message?: string, fatal?: boolean }[], [key: string]: unknown }} AiSchemaValidationLike
 * @typedef {{ status?: string, layoutJson?: AiLayoutJsonLike | null, generationMeta?: AiLayoutGenerationMetaLike | null, selection?: AiLayoutSelectionLike, resolved?: AiLayoutSelectionLike, sourceHash?: string, providerId?: string, model?: string, updatedAt?: number, lastError?: string, lastAttemptStatus?: string, lastAttemptError?: string, lastAttemptAt?: number, lastAttemptSchemaValidation?: AiSchemaValidationLike | null, dismissedBlockKeys?: string[], recommendedLayoutFamily?: string, recommendedColorPalette?: string, stylePack?: string, layoutFamily?: string, [key: string]: unknown }} AiLayoutStateLike
 * @typedef {{ sourcePath: string, markdown: string, sourceHash: string, isSourcePending?: boolean, isSourceSwitching?: boolean, isStaleSuppressed?: boolean, title: string }} AiLayoutContextLike
 * @typedef {{ layoutJson: AiLayoutJsonLike | null, blockOrigins: AiLayoutBlockOriginLike[], hiddenCount: number }} VisibleAiLayoutSnapshotLike
 * @typedef {{ name: string, desc?: string, searchable?: boolean, render: (setting: SettingComponentLike, group?: unknown) => void }} SettingDefinitionRenderLike
 */

/**
 * @param {string} specifier
 * @returns {unknown}
 */
const loadCommonJsDependency = (specifier) => {
  if (typeof require === 'function') {
    const requireFn = /** @type {(specifier: string) => unknown} */ (require);
    return requireFn(specifier);
  }
  const activeWindowRequire = getActiveWindowValue('require');
  if (typeof activeWindowRequire === 'function') {
    const requireFn = /** @type {(specifier: string) => unknown} */ (activeWindowRequire);
    return requireFn(specifier);
  }
  throw new Error(`CommonJS loader unavailable for ${specifier}`);
};
/** @type {ObsidianApiLike} */
const obsidianApi = /** @type {ObsidianApiLike} */ (loadCommonJsDependency('obsidian'));
const { Plugin, MarkdownView, ItemView, Notice } = obsidianApi;
import { createRenderPipelines } from './services/render-pipeline.js';
import { buildRenderRuntime } from './services/dependency-loader.js';
import { resolveMarkdownSource } from './services/markdown-source.js';
import { normalizeVaultPath } from './services/path-utils.js';
import { renderObsidianTripletMarkdown } from './services/obsidian-triplet-renderer.js';
import { canUseNativePreviewFastPath, renderNativeMarkdown } from './services/native-renderer.js';
import { convertRenderedMermaidDiagramsToImages } from './services/rendered-mermaid.js';
import {
  AI_LAYOUT_SELECTION_AUTO,
  createDefaultAiSettings,
  normalizeAiSettings,
  getLayoutFamilyById,
  normalizeLayoutSelection,
  getArticleLayoutSelectionState,
  normalizeArticleLayoutState,
  normalizeArticleLayoutCacheEntry,
  extractImageRefsFromHtml,
  extractRenderedSectionFragments,
  renderArticleLayoutHtml,
} from './services/ai-layout.js';
import {
  createWechatSyncBridgeService,
} from './services/wechatsync-bridge.js';
import { multiPlatformResultModalsMixin } from './views/publish-modal/multi-platform-result-modals.js';
import { coverPickerMixin } from './views/publish-modal/cover-picker.js';
import { wechatSyncActionsMixin } from './views/publish-modal/wechat-sync-actions.js';
import { wechatSyncModalMixin } from './views/publish-modal/wechat-sync-modal.js';
import { aiLayoutPanelMixin } from './views/ai-layout/ai-layout-panel.js';
import { mediaAssetsMixin } from './views/publish-modal/media-assets.js';
import { renderPipelineMixin } from './views/preview/render-pipeline.js';
import { settingsPanelMixin } from './views/settings-panel/settings-panel.js';
import {
  normalizeDraftCache,
} from './services/wechat-draft-cache.js';
import { stripMarkdownFrontmatter } from './services/markdown-utils.js';
import {
  createHtmlContainer,
  getActiveWindowValue,
  htmlToText,
  setElementHtml,
} from './services/dom-utils.js';

import {
  getActiveDocumentCompat,
  revealLeafCompat,
  getPluginSettings,
  setPluginSettings,
  refreshSettingTabCompat,
  getObsidianModalClass,
  createObsidianModal,
  getObsidianSetIcon,
  isMobileClient,
} from './services/obsidian-adapters.js';

import {
  toReadableError,
  isRecord,
  toRecord,
  toAiLayoutState,
  toAiLayoutSelection,
  toAiLayoutFamilyStates,
  toOptionalText,
  removeElementClass,
  generateId,
} from './services/input-utils.js';

// 视图类型标识
const APPLE_STYLE_VIEW = 'apple-style-converter';
const OBSIDIAN_PUBLISHER_PRO_URL = 'https://xiaoweibox.top/obsidian-publisher/pro/';
const OBSIDIAN_PUBLISHER_GUIDE_URL = 'https://xiaoweibox.top/obsidian-publisher/guide/';
const OBSIDIAN_PUBLISHER_EXTENSION_GUIDE_URL = `${OBSIDIAN_PUBLISHER_GUIDE_URL}?from=obsidian-plugin#install-extension`;
const OBSIDIAN_PUBLISHER_BRIDGE_GUIDE_URL = `${OBSIDIAN_PUBLISHER_GUIDE_URL}?from=obsidian-plugin#bridge`;

// Pure data helpers extracted to services/wechatsync-settings.js so the
// views/ layer can normalize / read settings without depending on input.js.
import {
  normalizeMultiPlatformSyncSettings,
} from './services/wechatsync-settings.js';

import {
  formatWechatsyncCheckedAt,
  describeWechatsyncConnectionState,
  renderWechatsyncConnectionStatusBar,
} from './views/connection-status-bar.js';

import {
  normalizeFeishuSyncSettings,
  updateFeishuHistoryPath,
} from './services/feishu-settings.js';
import { getImageSwipeCommandCopy, createImageSwipeCalloutMarkdown } from './services/image-swipe.js';

import {
  DEFAULT_SETTINGS,
  APPLE_STYLE_VIEW_TITLE,
} from './services/settings-defaults.js';

/**
 * 🚀 微信公众号 API 对接模块
 */
import { WechatAPI } from './services/wechat-api.js';

/**
 * 📝 微信公众号转换视图
 */
class AppleStyleView extends ItemView {
  /**
   * @param {LeafLike} leaf
   * @param {AppleStylePluginLike} plugin
   */
  constructor(leaf, plugin) {
    super(leaf);
    /** @type {AppleStylePluginLike} */
    this.plugin = plugin;
    /** @type {string | null} */
    this.currentHtml = null;
    /** @type {ConverterRuntimeLike | null} */
    this.converter = null;
    /** @type {unknown} */
    this.nativeRenderPipeline = null;
    /** @type {ThemeRuntimeLike | null} */
    this.theme = null;
    /** @type {TFileLike | null} */
    this.lastActiveFile = null;
    /** @type {string | null} */
    this.sessionCoverBase64 = ''; // 本次文章的临时封面
    /** @type {string} */
    this.sessionThumbMediaId = ''; // 从微信素材库选择的封面 media_id
    /** @type {string} */
    this.sessionDraftMediaId = ''; // 本次同步要更新的草稿 media_id
    /** @type {number} */
    this.sessionDraftIndex = 0; // 单图文默认更新第 0 篇
    /** @type {string} */
    this.sessionTitle = ''; // 本次同步的标题
    /** @type {string} */
    this.sessionDigest = ''; // 本次同步的摘要
    /** @type {Map<string, WechatMaterialCacheEntryLike>} */
    this.wechatMaterialCache = new Map(); // Map<account/page, { data, cachedAt }>
    this.wechatMaterialCoverAssetCache = new Map(); // Map<media/url, downloaded bridge asset bytes>

    // 双向滚动同步状态。滚动事件先合并到动画帧，再按预期目标位置
    // 区分用户滚动与代码同步滚动，避免 CodeMirror 重排和反向回弹。
    /** @type {number | null} */
    this.scrollSyncFrame = null;
    /** @type {(() => void) | null} */
    this.cancelScrollSyncFrame = null;
    this.pendingScrollSyncSource = '';
    /** @type {number | null} */
    this.expectedEditorScrollTop = null;
    /** @type {number | null} */
    this.expectedPreviewScrollTop = null;

    // 状态缓存：Map<FilePath, { coverBase64, digest }>
    // 用于在不关闭插件面板的情况下，切换文章或关闭弹窗后保留封面和摘要
    /** @type {Map<string, ArticleSessionStateLike>} */
    this.articleStates = new Map();

    // 公式/SVG 上传缓存：Map<Hash, WechatURL>
    // 避免重复上传相同的公式，节省微信 API 调用额度 (Quota) 并提升速度
    /** @type {Map<string, SvgUploadCacheEntry>} */
    this.svgUploadCache = new Map();
    // 普通图片上传缓存：Map<accountId::src, wechatUrl>
    // 用于同一视图生命周期内跨次同步复用，避免重复上传相同图片
    /** @type {Map<string, string | ImageCacheEntry>} */
    this.imageUploadCache = new Map();
    // 封面上传缓存：Map<accountId/appId::cover::src, { mediaId, fingerprint }>
    // 复用同一封面图的 thumb_media_id，封面内容变化时会自动重新上传。
    /** @type {Map<string, string | CoverCacheEntry>} */
    this.coverUploadCache = new Map();
    // Mermaid 导出缓存：Map<Hash, { dataUrl, width, height, style }>
    // 复制与同步复用同一份本地导出结果，避免重复栅格化
    /** @type {Map<string, unknown>} */
    this.mermaidImageCache = new Map();

    /** @type {number} */
    this.renderGeneration = 0;
    /** @type {string} */
    this.lastRenderError = '';
    /** @type {string} */
    this.lastRenderFailureNoticeKey = '';
    /** @type {number | null} */
    this.activeLeafRenderTimer = null;
    /** @type {number} */
    this.loadingGeneration = 0;
    /** @type {number | null} */
    this.loadingVisibilityTimer = null;
    /** @type {number | null} */
    this.sidePaddingPreviewTimer = null;
    /** @type {number | null} */
    this.resizeTimeout = null;
    /** @type {string} */
    this.lastResolvedMarkdown = '';
    /** @type {string} */
    this.lastResolvedSourcePath = '';
    /** @type {string} */
    this.lastResolvedSourceHash = '';
    /** @type {string} */
    this.aiLayoutSourceSwitchPath = '';
    /** @type {string} */
    this.aiLayoutStaleSuppressPath = '';
    /** @type {number} */
    this.aiLayoutStaleSuppressUntil = 0;
    /** @type {number | null} */
    this.aiLayoutStaleSuppressTimer = null;
    /** @type {string | null} */
    this.baseRenderedHtml = null;
    /** @type {boolean} */
    this.aiPreviewApplied = false;
    this.aiLayoutBtn = null;
    this.settingsBtn = null;
    this.aiLayoutDebugMode = '';
    /** @type {Record<string, unknown> | null} */
    this.aiLayoutActiveGenerationSelection = null;
    /** @type {ObsidianElementLike | null} */
    this.previewContainer = null;
    /** @type {ObsidianElementLike | null} */
    this.settingsOverlay = null;
    /** @type {ObsidianElementLike | null} */
    this.settingsArea = null;
    /** @type {ObsidianElementLike | null} */
    this.settingsAdvancedArea = null;
    /** @type {ObsidianElementLike | null} */
    this.settingsAdvancedOptions = null;
    /** @type {ObsidianElementLike | null} */
    this.activeEditorScroller = null;
    /** @type {((event: Event) => void) | null} */
    this.editorScrollListener = null;
    /** @type {((event: Event) => void) | null} */
    this.previewScrollListener = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutOverlay = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutArea = null;
    /** @type {ObsidianInputLike | null} */
    this.aiLayoutFamilySelect = null;
    /** @type {ObsidianInputLike | null} */
    this.aiColorPaletteSelect = null;
    /** @type {ObsidianInputLike | null} */
    this.aiStylePackSelect = null;
    /** @type {ObsidianInputLike | null} */
    this.aiCustomColorInput = null;
    /** @type {ObsidianElementLike | null} */
    this.aiColorPaletteControls = null;
    /** @type {ObsidianElementLike | null} */
    this.aiColorPaletteGrid = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutStatus = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutStatusBadge = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutStatusBody = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutStatusText = null;
    /** @type {ObsidianElementLike | null} */
    this.aiCachedLayoutList = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutSummary = null;
    /** @type {ObsidianElementLike | null} */
    this.aiGenerateBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiRegenerateBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiResetBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiRestoreBlocksBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiResultSection = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutMetaNote = null;
    /** @type {ObsidianElementLike | null} */
    this.aiBlockList = null;
    /** @type {ObsidianElementLike | null} */
    this.aiAdvancedToggleBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiAdvancedBody = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutMetaChips = null;
    /** @type {ObsidianElementLike | null} */
    this.aiSchemaIssuePanel = null;
    /** @type {ObsidianElementLike | null} */
    this.aiViewJsonBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiViewErrorBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiDebugPanel = null;
    /** @type {ObsidianElementLike | null} */
    this.aiDebugPanelTitle = null;
    /** @type {ObsidianElementLike | null} */
    this.aiCopyPromptBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiCopyDebugBtn = null;
    /** @type {ObsidianElementLike | null} */
    this.aiDebugPanelBody = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutLoadingMask = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutLoadingSpinner = null;
    /** @type {ObsidianElementLike | null} */
    this.aiLayoutLoadingMaskText = null;
    /** @type {ObsidianElementLike | null} */
    this.currentDocLabel = null;
    /** @type {ObsidianElementLike | null} */
    this.docTitleText = null;
    /** @type {ObsidianElementLike | null} */
    this.copyBtn = null;
    /** @type {string} */
    this.selectedAccountId = '';
    /** @type {boolean} */
    this.isCopying = false;
    /** @type {CaptionToggleStateLike | null} */
    this.captionToggleState = null;
    /** @type {string} */
    this.pendingAiLayoutFamily = '';
    /** @type {string} */
    this.pendingAiColorPalette = '';
    /** @type {string} */
    this.pendingAiStylePack = '';
    /** @type {string} */
    this.aiPrimaryActionMode = '';
    /** @type {boolean} */
    this.aiLayoutLoading = false;
    /** @type {boolean} */
    this.aiAdvancedOpen = false;
    /** @type {string} */
    this._sourceFirstRecoveryKey = '';
    /** @type {{ blockKey: string, relativeTop: number, fallbackScrollTop: number } | null} */
    this.aiLayoutPendingAnchor = null;
  }

  getViewType() {
    return APPLE_STYLE_VIEW;
  }

  getDisplayText() {
    return APPLE_STYLE_VIEW_TITLE;
  }

  getIcon() {
    return 'wand';
  }

  async onOpen() {
    console.log('🍎 发布助手面板打开');
    const container = /** @type {ObsidianElementLike} */ (this.containerEl.children[1]);
    container.empty();
    container.addClass('apple-converter-container');
    if (isMobileClient(this.app)) {
      container.addClass('apple-converter-mobile');
    }

    // 加载依赖
    await this.loadDependencies();

    // 创建设置面板
    this.createSettingsPanel(container);

    // 创建预览区 - 根据设置决定是否使用手机框
    const usePhoneFrame = this.plugin.settings.usePhoneFrame && !isMobileClient(this.app);
    const previewWrapper = container.createEl('div', {
      cls: `apple-preview-wrapper ${usePhoneFrame ? 'mode-phone' : 'mode-classic'}`
    });

    // Light Dismiss: 点击预览区域(手机框外)收起设置面板
    previewWrapper.addEventListener('click', () => {
      this.closeTransientPanels();
    });

    if (usePhoneFrame) {
      // === 手机仿真模式 ===
      const phoneFrame = previewWrapper.createEl('div', { cls: 'apple-phone-frame' });

      // 1. 顶部导航栏 (模拟微信)
      const header = phoneFrame.createEl('div', { cls: 'apple-phone-header' });
      header.createEl('span', { cls: 'title', text: '公众号预览' });
      header.createEl('span', { cls: 'dots', text: '•••' });

      // 2. 内容区域 (挂载到手机框内)
      this.previewContainer = phoneFrame.createEl('div', {
        cls: 'apple-converter-preview',
      });

      // 3. 底部 Home Indicator
      phoneFrame.createEl('div', { cls: 'apple-home-indicator' });
    } else {
      // === 经典无框模式 ===
      // 直接挂载到 wrapper，且 wrapper 样式会变为填满父容器
      this.previewContainer = previewWrapper.createEl('div', {
        cls: 'apple-converter-preview',
      });
    }

    this.setPlaceholder();

    // 监听文件切换
    this.registerActiveFileChange();

    // 初始化同步滚动
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) this.registerScrollSync(activeView);

    // 自动转换当前文档
    window.setTimeout(async () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView && this.converter) {
        await this.convertCurrent(true);
      }
    }, 500);
  }


  /**
   * 监听活动文件切换
   */
  registerActiveFileChange() {
    // 监听文件切换
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
          this.lastActiveFile = activeView.file;
          const nextSourcePath = activeView.file.path || '';
          if (nextSourcePath && nextSourcePath !== this.lastResolvedSourcePath) {
            this.markAiLayoutSourceSwitch(nextSourcePath);
          }
        }
        if (activeView && this.converter) {
          this.scheduleActiveLeafRender(activeView);
        }
        this.updateCurrentDoc();

        // 更新滚动同步绑定
        if (activeView) {
          this.registerScrollSync(activeView);
        }

      })
    );

    // 监听编辑器内容变化 (实时预览)
    /**
     * @param {(...args: unknown[]) => unknown} func
     * @param {number} wait
     * @returns {(...args: unknown[]) => void}
     */
    const debounce = (func, wait) => {
      /** @type {number | undefined} */
      let timeout;
      return (...args) => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => func(...args), wait);
      };
    };

    const debouncedConvert = debounce(async () => {
      // 1. 真正的可见性检查 (True Visibility Check)
      // 如果插件被折叠、隐藏或从未打开，offsetParent 为 null
      if (!this.containerEl.offsetParent) return;

      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      // 仅当当前编辑的文件是最后激活的文件时才更新
      if (activeView && activeView.file && this.lastActiveFile && activeView.file.path === this.lastActiveFile.path) {
        await this.convertCurrent(true, {
          sourceOverride: {
            markdown: activeView.editor.getValue(),
            sourcePath: activeView.file.path || '',
          },
        });
      }
    }, 500); // 500ms 延迟

    this.registerEvent(
      this.app.workspace.on('editor-change', debouncedConvert)
    );
  }

  /**
   * @param {MarkdownViewLike | null} [activeViewOverride]
   */
  scheduleActiveLeafRender(activeViewOverride = null) {
    if (this.activeLeafRenderTimer) {
      window.clearTimeout(this.activeLeafRenderTimer);
      this.activeLeafRenderTimer = null;
    }

    // 让出当前 active-leaf 事件栈，但不额外等待一帧，避免切文档时可见卡顿。
    this.activeLeafRenderTimer = window.setTimeout(() => {
      this.activeLeafRenderTimer = null;
      const activeView = activeViewOverride || this.app.workspace.getActiveViewOfType(MarkdownView);
      const sourceOverride = activeView && activeView.file
        ? {
          markdown: activeView.editor.getValue(),
          sourcePath: activeView.file.path || '',
        }
        : null;
      this.convertCurrent(true, {
        showLoading: true,
        loadingText: '正在切换文章预览...',
        loadingDelay: 120,
        sourceOverride,
      });
    }, 0);
  }

  scheduleSidePaddingPreview(delay = 120) {
    if (this.sidePaddingPreviewTimer) {
      window.clearTimeout(this.sidePaddingPreviewTimer);
      this.sidePaddingPreviewTimer = null;
    }
    this.sidePaddingPreviewTimer = window.setTimeout(() => {
      this.sidePaddingPreviewTimer = null;
      this.convertCurrent(true);
    }, delay);
  }

  setPreviewLoading(active, text = '正在渲染预览...') {
    if (!this.previewContainer) return;
    if (active) {
      this.previewContainer.addClass('apple-preview-loading');
      this.previewContainer.dataset.loadingText = text;
      return;
    }
    this.previewContainer.removeClass('apple-preview-loading');
    delete this.previewContainer.dataset.loadingText;
  }

  /**
   * 注册同步滚动 (双向: Editor <-> Preview)
   * 用动画帧合并高频事件，并按预期目标位置过滤程序触发的回调。
   * @param {MarkdownViewLike | null} activeView
   */
  registerScrollSync(activeView) {
    // 1. 清理旧的监听器
    if (this.activeEditorScroller && this.editorScrollListener) {
      this.activeEditorScroller.removeEventListener('scroll', this.editorScrollListener);
    }
    if (this.previewContainer && this.previewScrollListener) {
      this.previewContainer.removeEventListener('scroll', this.previewScrollListener);
    }
    if (this.cancelScrollSyncFrame) {
      this.cancelScrollSyncFrame();
    }

    this.activeEditorScroller = null;
    this.editorScrollListener = null;
    this.previewScrollListener = null;
    this.scrollSyncFrame = null;
    this.cancelScrollSyncFrame = null;
    this.pendingScrollSyncSource = '';
    this.expectedEditorScrollTop = null;
    this.expectedPreviewScrollTop = null;

    if (!activeView) return;

    // 2. 获取 Editor Scroller
    const editorScroller = /** @type {ObsidianElementLike | null} */ (activeView.contentEl.querySelector('.cm-scroller'));
    if (!editorScroller) return;
    this.activeEditorScroller = editorScroller;

    /**
     * @param {ObsidianElementLike} element
     * @param {'expectedEditorScrollTop' | 'expectedPreviewScrollTop'} fieldName
     * @returns {boolean}
     */
    const consumeExpectedScroll = (element, fieldName) => {
      const expected = this[fieldName];
      if (!Number.isFinite(expected)) return false;
      if (Math.abs(element.scrollTop - expected) <= 1) return true;
      this[fieldName] = null;
      return false;
    };

    /**
     * @param {'editor' | 'preview'} source
     */
    const syncScrollPosition = (source) => {
      if (!this.containerEl.offsetParent || !this.previewContainer) return;
      const editorHeight = editorScroller.scrollHeight - editorScroller.clientHeight;
      const previewHeight = this.previewContainer.scrollHeight - this.previewContainer.clientHeight;
      if (editorHeight <= 0 || previewHeight <= 0) return;

      if (source === 'editor') {
        let targetScrollTop;
        if (editorScroller.scrollTop === 0) {
          targetScrollTop = 0;
        } else if (Math.abs(editorScroller.scrollTop - editorHeight) < 2) {
          targetScrollTop = previewHeight;
        } else {
          targetScrollTop = (editorScroller.scrollTop / editorHeight) * previewHeight;
        }

        if (Math.abs(this.previewContainer.scrollTop - targetScrollTop) <= 1) return;
        this.expectedPreviewScrollTop = targetScrollTop;
        this.previewContainer.scrollTop = targetScrollTop;
        return;
      }

      let targetScrollTop;
      if (this.previewContainer.scrollTop === 0) {
        targetScrollTop = 0;
      } else if (Math.abs(this.previewContainer.scrollTop - previewHeight) < 2) {
        targetScrollTop = editorHeight;
      } else {
        const ratio = this.previewContainer.scrollTop / previewHeight;
        targetScrollTop = ratio * editorHeight;
      }

      if (Math.abs(editorScroller.scrollTop - targetScrollTop) <= 1) return;
      this.expectedEditorScrollTop = targetScrollTop;
      editorScroller.scrollTop = targetScrollTop;
    };

    /**
     * @param {'editor' | 'preview'} source
     */
    const scheduleScrollSync = (source) => {
      this.pendingScrollSyncSource = source;
      if (this.scrollSyncFrame !== null) return;

      const run = () => {
        this.scrollSyncFrame = null;
        this.cancelScrollSyncFrame = null;
        const pendingSource = this.pendingScrollSyncSource;
        this.pendingScrollSyncSource = '';
        if (pendingSource) {
          syncScrollPosition(pendingSource);
        }
      };

      if (typeof requestAnimationFrame === 'function') {
        const frameId = window.requestAnimationFrame(run);
        this.scrollSyncFrame = frameId;
        this.cancelScrollSyncFrame = () => {
          if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(frameId);
          }
        };
      } else {
        const timeoutId = window.setTimeout(run, 16);
        this.scrollSyncFrame = timeoutId;
        this.cancelScrollSyncFrame = () => window.clearTimeout(timeoutId);
      }
    };

    // === Listener A: Editor -> Preview ===
    this.editorScrollListener = () => {
      if (!this.containerEl.offsetParent) return;
      if (consumeExpectedScroll(editorScroller, 'expectedEditorScrollTop')) return;
      scheduleScrollSync('editor');
    };

    // === Listener B: Preview -> Editor ===
    this.previewScrollListener = () => {
      if (!this.containerEl.offsetParent || !this.previewContainer) return;
      if (consumeExpectedScroll(this.previewContainer, 'expectedPreviewScrollTop')) return;
      scheduleScrollSync('preview');
    };

    // 4. 绑定监听 (使用 passive 提升性能)
    editorScroller.addEventListener('scroll', this.editorScrollListener, { passive: true });
    this.previewContainer.addEventListener('scroll', this.previewScrollListener, { passive: true });
  }

  /**
   * 加载依赖库
   */
  async loadDependencies() {
    const adapter = this.app.vault.adapter;
    // Use dynamic path from manifest to allow folder renaming
    const basePath = this.plugin.manifest?.dir || '';

    try {
      const runtime = /** @type {{ theme: ThemeRuntimeLike, converter: ConverterRuntimeLike }} */ (await buildRenderRuntime({
        settings: this.plugin.settings,
        app: this.app,
        adapter,
        basePath,
      }));
      this.theme = runtime.theme;
      this.converter = runtime.converter;
      const pipelines = /** @type {{ nativePipeline: RenderPipelineLike }} */ (createRenderPipelines({
        candidateRenderer: async (markdown, context = {}) => {
          const renderContext = /** @type {RenderCandidateContextLike} */ (toRecord(context));
          const contextSettings = isRecord(renderContext.settings)
            ? /** @type {PluginSettingsLike} */ (renderContext.settings)
            : this.plugin.settings;
          if (canUseNativePreviewFastPath(markdown)) {
            const nativeHtml = /** @type {unknown} */ (await renderNativeMarkdown({
              converter: this.converter,
              markdown: String(markdown || ''),
              sourcePath: toOptionalText(renderContext.sourcePath),
            }));
            return String(nativeHtml || '');
          }
          return /** @type {Promise<string>} */ (renderObsidianTripletMarkdown({
            app: this.app,
            converter: this.converter,
            markdown: String(markdown || ''),
            sourcePath: toOptionalText(renderContext.sourcePath),
            settings: contextSettings,
            component: this,
            markdownRenderer: obsidianApi.MarkdownRenderer,
            rasterizeMermaid: false,
            preserveSvgStyleTags: true,
          }));
        },
      }));
      this.nativeRenderPipeline = pipelines.nativePipeline;

      console.log('✅ 依赖加载完成');
    } catch (error) {
      console.error('❌ 依赖加载失败:', error);
      new Notice('依赖加载失败: ' + toReadableError(error).message);
    }
  }


  /**
   * 从文章内容中提取第一张图片作为封面
   */
  getFirstImageFromArticle() {
    if (!this.currentHtml) return null;
    const tempDiv = createHtmlContainer('div', this.currentHtml);
    const imgs = Array.from(tempDiv.querySelectorAll('img'));

    // 遍历所有图片，跳过头像（alt="logo"）
    for (const img of imgs) {
      if (img.alt === 'logo') continue;
      if (img.src) return img.src;
    }
    return null;
  }

  /**
   * 获取当前发布上下文文件：
   * 1) 优先当前活动文件
   * 2) 回退到最近一次活动文件（侧边栏切换 tab 后常见）
   */
  getPublishContextFile() {
    const activeFile = this.app?.workspace?.getActiveFile?.();
    if (activeFile) return activeFile;
    if (this.lastActiveFile) return this.lastActiveFile;
    return null;
  }

  /**
   * 读取当前文档 frontmatter 中的发布元数据
   * @returns {{ excerpt: string, cover: string, cover_dir: string, coverSrc: string|null, title: string }}
   */
  /**
   * @param {TFileLike | unknown | null | undefined} activeFile
   * @returns {{ excerpt: string, cover: string, cover_dir: string, coverSrc: string|null, title: string }}
   */
  getFrontmatterPublishMeta(activeFile) {
    if (!activeFile) {
      return { excerpt: '', cover: '', cover_dir: '', coverSrc: null, title: '' };
    }

    const frontmatter = this.app?.metadataCache?.getFileCache?.(activeFile)?.frontmatter;
    const excerpt = this.getFrontmatterString(frontmatter, ['excerpt']);
    const cover = this.getFrontmatterString(frontmatter, ['cover']);
    const cover_dir = this.getFrontmatterString(frontmatter, ['cover_dir', 'coverDir', 'cover-dir', 'coverdir', 'CoverDIR']);
    const title = this.getFrontmatterString(frontmatter, ['title']);

    // 解析失败时静默回退：返回 null，不中断流程
    const coverSrc = cover ? this.resolveVaultPathToResourceSrc(cover) : null;

    return { excerpt, cover, cover_dir, coverSrc, title };
  }

  /**
   * @param {Record<string, unknown> | null | undefined} frontmatter
   * @param {string[]} keys
   * @returns {string}
   */
  getFrontmatterString(frontmatter, keys) {
    const frontmatterRecord = toRecord(frontmatter);
    if (!frontmatterRecord) return '';
    if (!Array.isArray(keys) || keys.length === 0) return '';

    const normalizedTargets = new Set(keys.map(key => this.normalizeFrontmatterKey(key)));
    for (const key of keys) {
      const value = frontmatterRecord[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    for (const [key, value] of Object.entries(frontmatterRecord)) {
      if (!normalizedTargets.has(this.normalizeFrontmatterKey(key))) continue;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return '';
  }

  /**
   * @param {unknown} key
   * @returns {string}
   */
  normalizeFrontmatterKey(key) {
    return String(key || '').toLowerCase().replace(/[_-]/g, '');
  }

  /**
   * @param {Record<string, unknown> | null | undefined} frontmatter
   * @param {string[]} keys
   * @returns {Record<string, string>}
   */
  getFrontmatterKeyMap(frontmatter, keys) {
    /** @type {Record<string, string>} */
    const result = {};
    const frontmatterRecord = toRecord(frontmatter);
    if (!frontmatterRecord) return result;
    if (!Array.isArray(keys) || keys.length === 0) return result;

    const normalizedTargets = new Set(keys.map(key => this.normalizeFrontmatterKey(key)));
    for (const [key, value] of Object.entries(frontmatterRecord)) {
      if (!normalizedTargets.has(this.normalizeFrontmatterKey(key))) continue;
      if (typeof value !== 'string') continue;
      const normalizedValue = this.normalizeVaultPath(value);
      if (!normalizedValue) continue;
      result[key] = normalizedValue;
    }
    return result;
  }

  isPathInsideDirectory(filePath, dirPath) {
    const file = this.normalizeVaultPath(filePath);
    const dir = this.normalizeVaultPath(dirPath);
    if (!file || !dir) return false;
    if (file === dir) return true;
    return file.startsWith(`${dir}/`);
  }

  isPathInsideDirectoryByTail(filePath, dirPath) {
    const file = this.normalizeVaultPath(filePath);
    const dir = this.normalizeVaultPath(dirPath);
    if (!file || !dir) return false;

    const dirSegments = dir.split('/').filter(Boolean);
    if (dirSegments.length < 2) return false;

    // 允许清理目录与 frontmatter 路径存在“根前缀差异”
    // 例如 cleanedDir: Wechat/published/img
    //      cover:     published/img/post-cover.jpg
    for (let i = 1; i <= dirSegments.length - 2; i++) {
      const tailDir = dirSegments.slice(i).join('/');
      if (this.isPathInsideDirectory(file, tailDir)) {
        return true;
      }
    }
    return false;
  }

  shouldClearFrontmatterPathAfterCleanup(pathValue, cleanedDir) {
    const normalized = this.normalizeVaultPath(pathValue);
    if (!normalized) return false;
    if (this.isPathInsideDirectory(normalized, cleanedDir)) return true;
    return this.isPathInsideDirectoryByTail(normalized, cleanedDir);
  }

  /**
   * @param {Record<string, unknown> | null | undefined} frontmatter
   * @param {string} cleanedDir
   * @returns {boolean}
   */
  clearInvalidPublishMetaInFrontmatter(frontmatter, cleanedDir) {
    const frontmatterRecord = toRecord(frontmatter);
    if (!frontmatterRecord) return false;

    let changed = false;
    const coverMap = this.getFrontmatterKeyMap(frontmatter, ['cover']);
    const coverDirMap = this.getFrontmatterKeyMap(frontmatter, ['cover_dir', 'coverDir', 'cover-dir', 'coverdir', 'CoverDIR']);

    for (const [key, value] of Object.entries(coverMap)) {
      if (this.shouldClearFrontmatterPathAfterCleanup(value, cleanedDir)) {
        frontmatterRecord[key] = '';
        changed = true;
      }
    }

    for (const [key, value] of Object.entries(coverDirMap)) {
      if (this.shouldClearFrontmatterPathAfterCleanup(value, cleanedDir)) {
        frontmatterRecord[key] = '';
        changed = true;
      }
    }

    return changed;
  }

  async clearInvalidPublishMetaByTextFallback(activeFile, cleanedDir) {
    const vault = this.app?.vault;
    if (!vault || typeof vault.read !== 'function' || typeof vault.modify !== 'function') {
      return false;
    }

    const source = await vault.read(activeFile);
    if (typeof source !== 'string' || !source.startsWith('---')) return false;

    const match = source.match(/^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$))/);
    if (!match) return false;

    let changed = false;
    const body = match[2].replace(/^([ \t]*)(cover|cover_dir|coverDir|cover-dir|coverdir|CoverDIR)([ \t]*:[ \t]*)(.*)$/gmi, (line, indent, key, separator, rawValue) => {
      const value = String(rawValue || '').trim().replace(/^['"]|['"]$/g, '');
      if (!this.shouldClearFrontmatterPathAfterCleanup(value, cleanedDir)) {
        return line;
      }
      changed = true;
      return `${indent}${key}${separator}''`;
    });

    if (!changed) return false;
    await vault.modify(activeFile, `${match[1]}${body}${match[3]}${source.slice(match[0].length)}`);
    return true;
  }

  async clearInvalidPublishMetaAfterCleanup(activeFile, cleanedDirPath) {
    if (!activeFile || !cleanedDirPath) return null;

    const cleanedDir = this.normalizeVaultPath(cleanedDirPath);
    if (!cleanedDir) return null;

    try {
      const processFrontMatter = this.app?.fileManager?.['processFrontMatter'];
      if (typeof processFrontMatter === 'function') {
        await processFrontMatter.call(this.app.fileManager, activeFile, (frontmatter) => {
          this.clearInvalidPublishMetaInFrontmatter(toRecord(frontmatter), cleanedDir);
        });
      } else {
        await this.clearInvalidPublishMetaByTextFallback(activeFile, cleanedDir);
      }
    } catch (error) {
      return `资源已删除，但清理 frontmatter 中失效的 cover/cover_dir 失败: ${toReadableError(error).message}`;
    }

    return null;
  }

  /**
   * 将 vault 相对路径解析为可预览/上传的资源 src（通常是 app://）
   */
  resolveVaultPathToResourceSrc(vaultPath) {
    if (typeof vaultPath !== 'string') return null;
    const normalized = vaultPath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) return null;

    try {
      const file = this.app.vault.getAbstractFileByPath(normalized);
      if (!file) return null;
      if (typeof file.extension !== 'string') return null; // 仅接受文件，不接受目录
      return this.app.vault.getResourcePath(file);
    } catch {
      // frontmatter 路径失效或不是文件时，静默回退
      return null;
    }
  }

  normalizeVaultPath(vaultPath) {
    return normalizeVaultPath(vaultPath);
  }

  getVaultConfigDir() {
    const configDir = this.app?.vault?.configDir;
    return typeof configDir === 'string' ? this.normalizeVaultPath(configDir) : '';
  }

  getCleanupDirTemplate() {
    const raw = typeof this.plugin?.settings?.cleanupDirTemplate === 'string'
      ? this.plugin.settings.cleanupDirTemplate
      : '';
    return this.normalizeVaultPath(raw);
  }

  /**
   * @param {TFileLike | null | undefined} activeFile
   * @returns {{ path: string, warning?: string }}
   */
  resolveCleanupDirPath(activeFile) {
    const template = this.getCleanupDirTemplate();
    if (!template) {
      return { path: '', warning: '未配置清理目录，请在插件设置中先填写目录后再启用自动清理' };
    }

    const hasNotePlaceholder = /\{\{\s*note\s*\}\}/i.test(template);
    if (hasNotePlaceholder && !activeFile) {
      return { path: '', warning: '当前没有活动文档，无法解析清理目录中的 {{note}}' };
    }

    const noteName = typeof activeFile?.basename === 'string' ? activeFile.basename.trim() : '';
    const resolved = template.replace(/\{\{\s*note\s*\}\}/gi, noteName);
    const normalized = this.normalizeVaultPath(resolved);
    if (!normalized) {
      return { path: '', warning: '清理目录为空，请检查设置值' };
    }

    return { path: normalized };
  }

  /**
   * 清理目录安全校验：禁止空路径、上跳路径、系统配置目录等危险路径
   */
  isSafeCleanupDirPath(vaultPath) {
    const normalized = this.normalizeVaultPath(vaultPath);
    if (!normalized) return false;
    if (normalized === '.') return false;
    if (normalized.includes('..')) return false;
    const configDir = this.getVaultConfigDir();
    if (configDir && (normalized === configDir || normalized.startsWith(`${configDir}/`))) return false;
    return true;
  }

  /**
   * 在同步成功后按配置清理目录
   * 失败返回 warning，不抛错（避免影响同步成功状态）
   * @param {TFileLike | null | undefined} activeFile
   * @returns {Promise<CleanupResultLike>}
   */
  async cleanupConfiguredDirectory(activeFile) {
    if (!this.plugin.settings.cleanupAfterSync) {
      return { attempted: false };
    }

    const useSystemTrash = this.plugin.settings.cleanupUseSystemTrash !== false;
    const resolved = this.resolveCleanupDirPath(activeFile);
    if (!resolved.path) {
      return { attempted: true, success: false, warning: resolved.warning || '未解析到清理目录' };
    }

    const normalized = resolved.path;
    if (!this.isSafeCleanupDirPath(normalized)) {
      return { attempted: true, success: false, warning: `清理目录不安全，已跳过: ${normalized}` };
    }

    const abstractFile = this.app.vault.getAbstractFileByPath(normalized);
    if (!abstractFile) {
      return { attempted: true, success: false, warning: `清理目录不存在: ${normalized}` };
    }

    const isFile = typeof abstractFile.extension === 'string';
    if (isFile) {
      return { attempted: true, success: false, warning: `清理路径不是目录，已跳过: ${normalized}` };
    }

    try {
      if (typeof this.app.vault.trash === 'function') {
        await this.app.vault.trash(abstractFile, useSystemTrash);
      } else if (typeof this.app.vault.delete === 'function') {
        await this.app.vault.delete(abstractFile, true);
      } else {
        throw new Error('当前 Obsidian 版本不支持删除接口');
      }
    } catch (error) {
      return { attempted: true, success: false, warning: `删除失败 (${normalized}): ${toReadableError(error).message}` };
    }

    const frontmatterWarning = await this.clearInvalidPublishMetaAfterCleanup(activeFile, normalized);
    if (frontmatterWarning) {
      return { attempted: true, success: true, cleanedPath: normalized, warning: frontmatterWarning };
    }

    return { attempted: true, success: true, cleanedPath: normalized };
  }

  /**
   * @param {ObsidianElementLike | null} overlay
   * @param {ObsidianElementLike | null} button
   * @param {(() => unknown) | undefined} onOpen
   */
  /**
   * @param {ObsidianElementLike | null} overlay
   * @param {ObsidianElementLike | null} button
   * @param {(() => unknown) | undefined} [onOpen]
   */
  togglePanel(overlay, button, onOpen) {
    if (!overlay || !button) return;
    const willOpen = !overlay.classList.contains('visible');
    this.closeTransientPanels();
    if (willOpen) {
      overlay.classList.add('visible');
      button.classList.add('active');
      if (typeof onOpen === 'function') onOpen();
    }
  }

  /**
   * @param {Element | null} element
   * @param {number} deltaY
   * @returns {boolean}
   */
  canScrollElementInDirection(element, deltaY) {
    if (!element) return false;
    const maxScroll = Math.max(0, (element.scrollHeight || 0) - (element.clientHeight || 0));
    if (maxScroll <= 0) return false;
    if (deltaY < 0) return (element.scrollTop || 0) > 0;
    if (deltaY > 0) return (element.scrollTop || 0) < maxScroll - 1;
    return true;
  }

  /**
   * @param {ObsidianElementLike | null} overlay
   * @param {string[]} [nestedSelectors]
   */
  attachOverlayScrollGuard(overlay, nestedSelectors = []) {
    if (!overlay || overlay.__appleScrollGuardAttached) return;
    const normalizedSelectors = Array.isArray(nestedSelectors)
      ? nestedSelectors.filter(Boolean)
      : [];

    /** @param {WheelEvent} event */
    const handleWheel = (event) => {
      if (!overlay.classList.contains('visible')) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const nestedScrollable = /** @type {Element | null} */ (target
        ? normalizedSelectors
          .map((selector) => target.closest(selector))
          .find(Boolean)
        : null);
      const activeScrollable = nestedScrollable || overlay;

      if (!this.canScrollElementInDirection(activeScrollable, event.deltaY)) {
        event.preventDefault();
      }
      event.stopPropagation();
    };

    /** @param {TouchEvent} event */
    const handleTouchMove = (event) => {
      if (!overlay.classList.contains('visible')) return;
      event.stopPropagation();
    };

    overlay.addEventListener('wheel', handleWheel, { passive: false });
    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    overlay.__appleScrollGuardAttached = true;
  }

  closeTransientPanels() {
    removeElementClass(this.settingsOverlay, 'visible');
    removeElementClass(this.aiLayoutOverlay, 'visible');
    removeElementClass(this.settingsBtn, 'active');
    removeElementClass(this.aiLayoutBtn, 'active');
  }

  async ensureCurrentArticleContext() {
    const source = await resolveMarkdownSource({
      app: this.app,
      lastActiveFile: this.lastActiveFile,
      MarkdownViewType: MarkdownView,
    });

    if (!source.ok || !String(source.markdown || '').trim()) {
      return null;
    }

    const markdown = source.markdown || '';
    const sourcePath = source.sourcePath || '';
    this.lastResolvedMarkdown = markdown;
    this.lastResolvedSourcePath = sourcePath;
    this.lastResolvedSourceHash = String(this.simpleHash(markdown));

    const activeFile = this.getPublishContextFile();
    const publishMeta = this.getFrontmatterPublishMeta(activeFile);
    const title = publishMeta?.title || activeFile?.basename || '未命名文章';

    return {
      markdown,
      sourcePath,
      sourceHash: this.lastResolvedSourceHash,
      title,
    };
  }

  getCurrentExportHtml() {
    if (!this.currentHtml) return null;
    if (!this.aiPreviewApplied) return this.currentHtml;

    const context = this.getCurrentLayoutContext();
    const state = this.getCurrentArticleLayoutState();
    const visibleSnapshot = this.getVisibleAiLayoutSnapshot(state);
    if (!state || !visibleSnapshot.layoutJson?.blocks?.length) {
      return this.currentHtml;
    }
    if (context.sourceHash && state.sourceHash && context.sourceHash !== state.sourceHash) {
      return this.currentHtml;
    }

    const imageRefs = extractImageRefsFromHtml(this.baseRenderedHtml || this.currentHtml || '');
    const renderedSectionFragments = extractRenderedSectionFragments(this.baseRenderedHtml || this.currentHtml || '');
    const renderLayout = this.getAiRenderLayoutJson(visibleSnapshot.layoutJson);
    return renderArticleLayoutHtml(renderLayout, {
      imageRefs,
      mode: 'draft',
      renderedSectionFragments,
      colorPaletteOverride: this.getAiColorPaletteOverride(renderLayout?.resolved?.colorPalette || renderLayout?.stylePack),
    });
  }

  restoreBasePreview() {
    if (!this.baseRenderedHtml || !this.previewContainer) return;
    const scrollTop = this.previewContainer.scrollTop;
    this.currentHtml = this.baseRenderedHtml;
    this.aiPreviewApplied = false;
    setElementHtml(this.previewContainer, this.baseRenderedHtml);
    this.previewContainer.scrollTop = scrollTop;
    this.previewContainer.addClass('apple-has-content');
    this.syncPreviewPresentationMode();
    this.refreshAiLayoutPanel();
  }

  syncPreviewPresentationMode() {
    if (!this.previewContainer) return;
    const hasAiPreview = this.aiPreviewApplied === true;
    this.previewContainer.classList.toggle('apple-ai-preview-active', hasAiPreview);
    const previewWrapper = this.previewContainer.closest('.apple-preview-wrapper');
    previewWrapper?.classList.toggle('apple-ai-preview-active', hasAiPreview);
  }

  /**
   * @returns {boolean}
   */
  openPluginSettings() {
    const settingApi = this.app?.setting;
    if (!settingApi || typeof settingApi.open !== 'function') return false;

    settingApi.open();
    const tabId = this.plugin?.manifest?.id || 'wechat-converter';
    if (typeof settingApi.openTabById === 'function') {
      settingApi.openTabById(tabId);
    }
    return true;
  }

  /**
   * @param {string} url
   * @param {{ allowExtensionUrls?: boolean }} [options]
   * @returns {boolean}
   */
  openExternalUrl(url, options = {}) {
    const target = String(url || '').trim();
    const allowExtensionUrls = options?.allowExtensionUrls === true;
    const isHttpUrl = /^https?:\/\//i.test(target);
    const isExtensionUrl = /^(chrome|edge|brave|moz)-extension:\/\//i.test(target);
    if (!isHttpUrl && !(allowExtensionUrls && isExtensionUrl)) {
      new Notice('草稿链接不可用');
      return false;
    }

    if (typeof window !== 'undefined') {
      try {
        const activeDoc = getActiveDocumentCompat();
        if (!activeDoc) return false;
        const a = activeDoc.createElement('a');
        a.href = target;
        a.target = '_blank';
        a.click();
        return true;
      } catch {
        if (typeof window.open === 'function') {
          window.open(target, '_blank', 'noopener');
          return true;
        }
      }
    }

    new Notice('无法打开草稿链接，请在浏览器插件中查看同步结果');
    return false;
  }

  openPublisherProPage() {
    return this.openExternalUrl(OBSIDIAN_PUBLISHER_PRO_URL);
  }

  openPublisherGuidePage(section = '') {
    if (section === 'bridge') {
      return this.openExternalUrl(OBSIDIAN_PUBLISHER_BRIDGE_GUIDE_URL);
    }
    if (section === 'install-extension') {
      return this.openExternalUrl(OBSIDIAN_PUBLISHER_EXTENSION_GUIDE_URL);
    }
    return this.openExternalUrl(OBSIDIAN_PUBLISHER_GUIDE_URL);
  }

  showAccountSetupEmptyState() {
    if (typeof getObsidianModalClass() !== 'function') {
      if (!this.openPluginSettings()) {
        new Notice('请先在插件设置中添加公众号账号（AppID / AppSecret）');
      }
      return;
    }

    const modal = createObsidianModal(this.app);
    modal.titleEl.setText('未配置公众号账号');
    modal.contentEl.addClass('wechat-sync-modal');
    if (isMobileClient(this.app)) {
      modal.contentEl.addClass('wechat-sync-modal-mobile');
      modal.modalEl?.addClass('wechat-sync-shell-mobile');
    }

    const emptyState = modal.contentEl.createDiv({ cls: 'wechat-sync-empty-state' });
    emptyState.createEl('div', { cls: 'wechat-sync-empty-icon', text: '⚙️' });
    emptyState.createEl('h3', { text: '先配置公众号账号' });
    emptyState.createEl('p', { text: '请先在插件设置中填写 AppID / AppSecret，再发送到微信草稿箱。' });

    const btnRow = modal.contentEl.createDiv({ cls: 'wechat-modal-buttons' });
    const cancelBtn = btnRow.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const configBtn = btnRow.createEl('button', { text: '去配置账号', cls: 'mod-cta' });
    configBtn.onclick = () => {
      modal.close();
      if (!this.openPluginSettings()) {
        new Notice('请在设置中打开 Obsidian 发布助手并配置公众号账号');
      }
    };

    modal.open();
  }

  /**
   * 转换当前文档
   * @param {boolean} [silent]
   * @param {ConvertCurrentOptionsLike} [options]
   */
  async convertCurrent(silent = false, options = {}) {
    const {
      showLoading = false,
      loadingText = '正在渲染预览...',
      loadingDelay = 0,
      sourceOverride = null,
    } = options;
    const generation = ++this.renderGeneration;
    if (showLoading) {
      this.loadingGeneration = generation;
      if (this.loadingVisibilityTimer) {
        window.clearTimeout(this.loadingVisibilityTimer);
        this.loadingVisibilityTimer = null;
      }
      if (loadingDelay > 0) {
        this.loadingVisibilityTimer = window.setTimeout(() => {
          if (this.loadingGeneration === generation) {
            this.setPreviewLoading(true, loadingText);
          }
          this.loadingVisibilityTimer = null;
        }, loadingDelay);
      } else {
        this.setPreviewLoading(true, loadingText);
      }
    }
    /** @type {MarkdownSourceResultLike} */
    const source = sourceOverride && typeof sourceOverride === 'object'
      ? {
        ok: true,
        markdown: typeof sourceOverride.markdown === 'string' ? sourceOverride.markdown : '',
        sourcePath: typeof sourceOverride.sourcePath === 'string' ? sourceOverride.sourcePath : '',
      }
      : /** @type {MarkdownSourceResultLike} */ (await resolveMarkdownSource({
        app: this.app,
        lastActiveFile: this.lastActiveFile,
        MarkdownViewType: MarkdownView,
      }));

    let markdown = '';
    let sourcePath = '';
    if (source.ok) {
      markdown = source.markdown || '';
      sourcePath = source.sourcePath || '';
    } else if (this.lastResolvedMarkdown.trim()) {
      markdown = this.lastResolvedMarkdown;
      sourcePath = this.lastResolvedSourcePath || '';
    } else {
      if (!silent) new Notice('请先打开一个 Markdown 文件');
      if (showLoading && this.loadingGeneration === generation) {
        if (this.loadingVisibilityTimer) {
          window.clearTimeout(this.loadingVisibilityTimer);
          this.loadingVisibilityTimer = null;
        }
        this.setPreviewLoading(false);
      }
      return;
    }

    if (!markdown.trim()) {
      if (!silent) new Notice('当前文件内容为空');
      this.completeAiLayoutSourceSwitch(sourcePath);
      if (showLoading && this.loadingGeneration === generation) {
        if (this.loadingVisibilityTimer) {
          window.clearTimeout(this.loadingVisibilityTimer);
          this.loadingVisibilityTimer = null;
        }
        this.setPreviewLoading(false);
      }
      return;
    }

    try {
      if (!silent) new Notice('⚡ 正在转换...');
      const html = await this.renderMarkdownForPreview(markdown, sourcePath);

      if (generation !== this.renderGeneration) return;

      // 只有渲染成功并且仍是最新一轮渲染时，才提交当前文章源。
      // 这样切换文章时 AI 面板不会在渲染中途用临时 hash 误判缓存状态。
      this.lastResolvedMarkdown = markdown;
      this.lastResolvedSourcePath = sourcePath;
      this.lastResolvedSourceHash = String(this.simpleHash(markdown));
      this.completeAiLayoutSourceSwitch(sourcePath);

      this.baseRenderedHtml = html;
      this.currentHtml = html;
      this.lastRenderError = '';
      this.lastRenderFailureNoticeKey = '';
      // 重置手动上传的封面，确保切换文章时不会残留上一篇的封面
      this.sessionCoverBase64 = null;

      // 滚动位置保持 (Scroll Preservation)
      const scrollTop = this.previewContainer.scrollTop;
      setElementHtml(this.previewContainer, html);
      this.previewContainer.scrollTop = scrollTop;

      this.previewContainer.addClass('apple-has-content'); // 添加内容状态类
      this.syncPreviewPresentationMode();
      this.updateCurrentDoc();
      if (this.shouldSyncAiLayoutUi()) {
        const activeSelection = this.getCurrentAiLayoutSelection();
        let layoutState = null;
        if (sourcePath && typeof this.plugin?.getArticleLayoutState === 'function') {
          layoutState = this.plugin.getArticleLayoutState(sourcePath, activeSelection);
        }
        const canReuseAiLayout = !!(
          this.aiPreviewApplied
          && layoutState?.layoutJson?.blocks?.length
          && this.lastResolvedSourceHash
          && layoutState.sourceHash === this.lastResolvedSourceHash
        );
        if (canReuseAiLayout) {
          this.applyAiLayoutToPreview();
        } else if (this.aiPreviewApplied) {
          this.aiPreviewApplied = false;
          this.syncPreviewPresentationMode();
        }
        this.refreshAiLayoutPanel();
      }
      if (!silent) new Notice('✅ 转换成功！');

    } catch (error) {
      console.error('转换失败:', error);
      if (generation !== this.renderGeneration) return;

      this.currentHtml = null;
      this.baseRenderedHtml = null;
      this.aiPreviewApplied = false;
      this.completeAiLayoutSourceSwitch(sourcePath);
      this.syncPreviewPresentationMode();
      this.lastRenderError = toReadableError(error).message || '未知渲染错误';
      this.showRenderFailurePlaceholder(this.lastRenderError);
      this.updateCurrentDoc();
      if (this.shouldSyncAiLayoutUi()) {
        this.refreshAiLayoutPanel();
      }

      const noticeKey = `${sourcePath || ''}:${this.lastRenderError}`;
      if (!silent || this.lastRenderFailureNoticeKey !== noticeKey) {
        new Notice('❌ 转换失败: ' + this.lastRenderError);
        this.lastRenderFailureNoticeKey = noticeKey;
      }
    } finally {
      if (showLoading && this.loadingGeneration === generation) {
        if (this.loadingVisibilityTimer) {
          window.clearTimeout(this.loadingVisibilityTimer);
          this.loadingVisibilityTimer = null;
        }
        this.setPreviewLoading(false);
      }
    }
  }

  /**
   * 视图改变大小时触发 (包括侧边栏展开、Tab切换等导致的大小变化)
   */
  onResize() {
    // ItemView does not provide resize behavior this view relies on; keep handling local.
    // 使用防抖，避免拖动侧边栏时频繁渲染
    if (this.resizeTimeout) window.clearTimeout(this.resizeTimeout);

    // 检查是否可见 (以防万一)
    if (!this.containerEl.offsetParent) return;

    this.resizeTimeout = window.setTimeout(() => {
      this.convertCurrent(true);
    }, 300);
  }

  /**
   * @param {string} htmlContent
   * @returns {Promise<boolean>}
   */
  async copyRichHTMLByClipboard(htmlContent) {
    if (
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== 'function' ||
      typeof ClipboardItem === 'undefined'
    ) {
      return false;
    }

    const item = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
    });
    await navigator.clipboard.write([item]);
    return true;
  }

  /**
   * @param {unknown} text
   * @returns {string}
   */
  normalizeClipboardText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param {string} icon
   */
  setCopyButtonIcon(icon) {
    if (!this.copyBtn) return;
    this.copyBtn.replaceChildren();
    const setIcon = getObsidianSetIcon();
    if (typeof setIcon === 'function') {
      setIcon(this.copyBtn, icon);
    }
  }

  setCopyButtonSpinner() {
    if (!this.copyBtn) return;
    this.copyBtn.replaceChildren();
    const activeDocument = getActiveDocumentCompat();
    if (!activeDocument) return;
    const spinner = activeDocument.createElement('span');
    spinner.className = 'apple-copy-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    this.copyBtn.appendChild(spinner);
  }

  /**
   * @param {HTMLElement | null} root
   */
  async enhanceHtmlForWechatPublishing(root) {
    if (!root) return;
    const activeDocument = getActiveDocumentCompat();
    /** @type {HTMLElement | null} */
    let mount = null;
    try {
      if (activeDocument?.body && !root.isConnected) {
        mount = activeDocument.createElement('div');
        mount.setCssStyles({
          position: 'fixed',
          left: '-99999px',
          top: '0',
          width: '760px',
          opacity: '0',
          pointerEvents: 'none',
          overflow: 'hidden',
        });
        activeDocument.body.appendChild(mount);
        mount.appendChild(root);
      }
      await convertRenderedMermaidDiagramsToImages(root, {
        simpleHash: (value) => this.simpleHash(String(value || '')),
        mermaidImageCache: this.mermaidImageCache,
      });
      this.transformCodeBlocksForClipboard(root);
    } finally {
      if (mount) {
        mount.remove();
      }
    }
  }

  /**
   * @param {Element | null | undefined} block
   * @returns {string}
   */
  extractCodeTextForWechatsync(block) {
    const codePre = block?.querySelector?.('pre');
    if (!codePre) return '';

    const sectionNodes = /** @type {HTMLElement[]} */ (Array.from(codePre.querySelectorAll('section')));
    const codeLinesNode = sectionNodes
      .filter((node) => {
        const style = (node.getAttribute('style') || '').toLowerCase();
        return style.includes('white-space:nowrap') || style.includes('white-space: nowrap');
      })
      .sort((a, b) => {
        /** @param {HTMLElement} node */
        const score = (node) => {
          const html = node.innerHTML || '';
          return (html.includes('<br') ? 10000 : 0) + (node.textContent || '').length;
        };
        return score(b) - score(a);
      })[0];

    if (codeLinesNode) {
      return (codeLinesNode.innerHTML || '')
        .split(/<br\s*\/?>/i)
        .map((lineHtml) => {
          return htmlToText(lineHtml || '').replace(/\u00a0/g, ' ');
        })
        .join('\n');
    }

    const codeEl = codePre.querySelector('code');
    return ((codeEl ? codeEl.textContent : codePre.textContent) || '').replace(/\u00a0/g, ' ');
  }

  /**
   * @param {Element | null} root
   */
  transformCodeBlocksForWechatsync(root) {
    if (!root) return;

    const codeBlocks = /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('.code-snippet__fix')));
    codeBlocks.forEach((block) => {
      const codeText = this.extractCodeTextForWechatsync(block);

      const activeDocument = getActiveDocumentCompat();
      if (!activeDocument) return;
      const pre = activeDocument.createElement('pre');
      pre.setAttribute('style', [
        'display:block !important',
        'width:100% !important',
        'max-width:100% !important',
        'margin:14px 0 !important',
        'padding:12px 14px !important',
        'box-sizing:border-box !important',
        'background:#f6f8fa !important',
        'border:1px solid #e5e7eb !important',
        'border-radius:8px !important',
        'overflow-x:auto !important',
        'overflow-y:hidden !important',
        '-webkit-overflow-scrolling:touch !important',
        "font-family:'SF Mono',Consolas,Monaco,monospace !important",
        'font-size:13px !important',
        'line-height:1.65 !important',
        'color:#24292f !important',
        'text-indent:0 !important',
        'white-space:pre !important',
      ].join(';'));

      const code = activeDocument.createElement('code');
      code.setAttribute('style', [
        'display:block !important',
        'margin:0 !important',
        'padding:0 !important',
        'background:transparent !important',
        'color:#24292f !important',
        'font:inherit !important',
        'line-height:inherit !important',
        'white-space:pre !important',
        'text-indent:0 !important',
      ].join(';'));
      code.textContent = codeText;
      pre.appendChild(code);
      block.replaceWith(pre);
    });
  }

  /**
   * @param {Element | null} root
   */
  transformCodeBlocksForClipboard(root) {
    if (!root) return;

    const codeBlocks = /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('.code-snippet__fix')));
    codeBlocks.forEach((block) => {
      const codePre = block.querySelector('pre');
      if (!codePre) return;

      const codeHtml = codePre.innerHTML || '';
      const styleText = block.getAttribute('style') || '';
      const backgroundMatch = styleText.match(/background:([^;!]+)(?:\s*!important)?/i);
      const borderMatch = styleText.match(/border:([^;!]+)(?:\s*!important)?/i);
      const radiusMatch = styleText.match(/border-radius:([^;!]+)(?:\s*!important)?/i);
      const background = backgroundMatch ? backgroundMatch[1].trim() : '#0d1117';
      const border = borderMatch ? borderMatch[1].trim() : '1px solid #30363d';
      const borderRadius = radiusMatch ? radiusMatch[1].trim() : '8px';
      const sectionNodes = /** @type {HTMLElement[]} */ (Array.from(codePre.querySelectorAll('section')));
      const lineNumberColumn = sectionNodes.find((node) => {
        const style = (node.getAttribute('style') || '').toLowerCase();
        return style.includes('border-right') && style.includes('user-select');
      });
      const codeLinesNode = sectionNodes
        .filter((node) => {
          const style = (node.getAttribute('style') || '').toLowerCase();
          return style.includes('white-space:nowrap') || style.includes('white-space: nowrap');
        })
        .sort((a, b) => {
          /** @param {HTMLElement} node */
          const score = (node) => {
            const html = node.innerHTML || '';
            return (html.includes('<br') ? 10000 : 0) + (node.textContent || '').length;
          };
          return score(b) - score(a);
        })[0];
      const codeLinesHtml = codeLinesNode ? codeLinesNode.innerHTML : codeHtml;
      const directMacHeader = Array.from(block.children).find((child) =>
        child !== codePre &&
        !child.querySelector('pre') &&
        child.querySelector('span') &&
        !(child.textContent || '').trim()
      );
      const hasMacHeader = !!directMacHeader;
      const codeLineParts = codeLinesNode
        ? codeLinesHtml.split(/<br\s*\/?>/i)
        : [codeLinesHtml];
      const lineNumberLabels = lineNumberColumn
        ? Array.from(lineNumberColumn.children).map((node) => (node.textContent || '').trim()).filter(Boolean)
        : [];
      const shouldKeepFixedLineNumbers = lineNumberLabels.length > 0 && codeLineParts.length > 0;

      const activeDocument = getActiveDocumentCompat();
      if (!activeDocument) return;
      const pre = activeDocument.createElement('pre');
      pre.setAttribute('class', 'hljs code__pre');
      pre.setAttribute('style', `width:100% !important;max-width:100% !important;margin:12px 0 !important;background:${background} !important;border:${border} !important;border-radius:${borderRadius} !important;box-shadow:0 4px 12px rgba(0,0,0,0.3) !important;overflow-x:auto !important;overflow-y:hidden !important;-webkit-overflow-scrolling:touch !important;box-sizing:border-box !important;font-family:'SF Mono',Consolas,Monaco,monospace !important;font-size:13px !important;line-height:1.75 !important;color:#f0f6fc !important;white-space:normal !important;`);

      if (hasMacHeader) {
        const toolbar = activeDocument.createElement('section');
        const toolbarStyle = 'display:block !important;background:#161b22 !important;padding:6px 10px 6px 10px !important;border:none !important;border-bottom:1px solid #30363d !important;border-radius:8px 8px 0 0 !important;line-height:1 !important;box-sizing:border-box !important;width:100% !important;';
        toolbar.setAttribute('style', toolbarStyle);
        setElementHtml(toolbar, [
        '<span style="display:inline-block !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#ff5f57 !important;margin-right:7px !important;font-size:0 !important;line-height:0 !important;color:transparent !important;vertical-align:top !important;">&nbsp;</span>',
        '<span style="display:inline-block !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#ffbd2e !important;margin-right:7px !important;font-size:0 !important;line-height:0 !important;color:transparent !important;vertical-align:top !important;">&nbsp;</span>',
        '<span style="display:inline-block !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#28c840 !important;font-size:0 !important;line-height:0 !important;color:transparent !important;vertical-align:top !important;">&nbsp;</span>',
      ].join(''));
        pre.appendChild(toolbar);
      }

      const code = activeDocument.createElement('code');
      if (shouldKeepFixedLineNumbers) {
        const lineNumbersHtml = codeLineParts.map((_, index) => {
          const lineNumber = lineNumberLabels[index] || String(index + 1);
          return `<section style="padding:0 10px 0 0 !important;line-height:1.75 !important;color:#95989C !important;">${lineNumber}</section>`;
        }).join('');
        const codeInnerHtml = codeLineParts.map((lineHtml) => lineHtml || '&nbsp;').join('<br/>');
        const codeWithLineNumbersStyle = 'display:block !important;width:100% !important;min-width:100% !important;max-width:100% !important;padding:0 !important;box-sizing:border-box !important;background:transparent !important;color:#f0f6fc !important;font-family:inherit !important;font-size:13px !important;line-height:1.75 !important;white-space:normal !important;overflow:visible !important;text-indent:0 !important;margin:0 !important;';
        code.setAttribute('style', codeWithLineNumbersStyle);
        setElementHtml(code, `<section style="display:flex !important;align-items:flex-start !important;overflow-x:hidden !important;overflow-y:visible !important;width:100% !important;max-width:100% !important;padding:0 !important;box-sizing:border-box !important;margin:0 !important;">
          <section class="line-numbers" style="text-align:right !important;padding:12px 0 !important;border-right:1px solid rgba(255,255,255,0.1) !important;user-select:none !important;background:transparent !important;flex:0 0 auto !important;min-width:3.5em !important;box-sizing:border-box !important;margin:0 !important;">${lineNumbersHtml}</section>
          <section class="code-scroll" style="flex:1 1 auto !important;overflow-x:auto !important;overflow-y:visible !important;-webkit-overflow-scrolling:touch !important;padding:12px 12px 12px 16px !important;min-width:0 !important;box-sizing:border-box !important;margin:0 !important;">
            <section style="white-space:pre !important;min-width:max-content !important;line-height:1.75 !important;font-size:13px !important;margin:0 !important;">${codeInnerHtml}</section>
          </section>
        </section>`);
      } else {
        const codeScrollableStyle = 'display:block !important;width:max-content !important;min-width:100% !important;max-width:none !important;padding:12px !important;box-sizing:border-box !important;background:transparent !important;color:#f0f6fc !important;font-family:inherit !important;font-size:13px !important;line-height:1.75 !important;white-space:nowrap !important;overflow:visible !important;text-indent:0 !important;margin:0 !important;';
        code.setAttribute('style', codeScrollableStyle);
        setElementHtml(code, codeLinesHtml);
      }
      pre.appendChild(code);

      block.replaceWith(pre);
    });
  }

  async readClipboardTextSnapshot() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return { supported: false, text: '' };
    }
    try {
      const text = await navigator.clipboard.readText();
      return { supported: true, text: this.normalizeClipboardText(text) };
    } catch {
      return { supported: false, text: '' };
    }
  }


  /**
   * 复制 HTML
   */
  async copyHTML() {
    if (this.isCopying) return;

    if (!this.currentHtml) {
      new Notice(this.getMissingRenderNotice());
      return;
    }

    this.isCopying = true;
    if (this.copyBtn) {
      this.copyBtn.classList.add('is-copying');
      this.setCopyButtonSpinner();
    }

    try {
      const exportHtml = this.getCurrentExportHtml() || this.currentHtml;
      // 创建临时的 DOM 容器来解析和处理图片
      const tempDiv = createHtmlContainer('div', exportHtml);

      // 处理本地图片：转换为 JPEG Base64
      // 返回 true 表示有图片被处理了
      await this.processImagesToDataURL(tempDiv);

      await this.enhanceHtmlForWechatPublishing(tempDiv);

      // 清理 HTML 以适配微信编辑器（处理嵌套列表等）
      const cleanedHtml = this.cleanHtmlForDraft(tempDiv.innerHTML);

      const htmlContent = cleanedHtml;
      window.__OWC_LAST_CLIPBOARD_HTML = htmlContent;
      window.__OWC_LAST_CLIPBOARD_TEXT = htmlToText(cleanedHtml);
      const expectedPlainText = this.normalizeClipboardText(window.__OWC_LAST_CLIPBOARD_TEXT);

      const mobile = isMobileClient(this.app);
      let copied = false;
      try {
        copied = await this.copyRichHTMLByClipboard(htmlContent);
      } catch {
        copied = false;
      }
      if (mobile && copied) {
        const snapshot = await this.readClipboardTextSnapshot();
        copied = snapshot.supported && snapshot.text === expectedPlainText;
      }

      if (!copied) {
        throw new Error('rich copy unavailable');
      }

      // Success Feedback
      new Notice('✅ 已复制公众号格式，请直接粘贴到公众号编辑器');
      if (this.copyBtn) {
         this.copyBtn.classList.remove('is-copying');
         this.setCopyButtonIcon('check'); // 变成对勾图标
         window.setTimeout(() => {
           if (this.copyBtn) {
             this.setCopyButtonIcon('copy'); // 恢复复制图标
           }
         }, 2000);
      }
      return;

    } catch (error) {
      console.error('复制失败:', error);
      new Notice('❌ 复制失败，请使用「发布与分发」发送文章');
      if (this.copyBtn) {
        this.copyBtn.classList.remove('is-copying');
        this.setCopyButtonIcon('copy');
      }
    } finally {
      this.isCopying = false;
    }
  }

  async onClose() {
    if (this.activeLeafRenderTimer) {
      window.clearTimeout(this.activeLeafRenderTimer);
      this.activeLeafRenderTimer = null;
    }
    if (this.loadingVisibilityTimer) {
      window.clearTimeout(this.loadingVisibilityTimer);
      this.loadingVisibilityTimer = null;
    }
    if (this.sidePaddingPreviewTimer) {
      window.clearTimeout(this.sidePaddingPreviewTimer);
      this.sidePaddingPreviewTimer = null;
    }
    if (this.aiLayoutStaleSuppressTimer) {
      window.clearTimeout(this.aiLayoutStaleSuppressTimer);
      this.aiLayoutStaleSuppressTimer = null;
    }
    this.setPreviewLoading(false);

    // 清理滚动监听 (Critical: Fix memory leak)
    if (this.activeEditorScroller && this.editorScrollListener) {
      this.activeEditorScroller.removeEventListener('scroll', this.editorScrollListener);
    }
    if (this.previewContainer && this.previewScrollListener) {
      this.previewContainer.removeEventListener('scroll', this.previewScrollListener);
    }
    if (this.cancelScrollSyncFrame) {
      this.cancelScrollSyncFrame();
      this.cancelScrollSyncFrame = null;
      this.scrollSyncFrame = null;
      this.pendingScrollSyncSource = '';
    }
    this.expectedEditorScrollTop = null;
    this.expectedPreviewScrollTop = null;
    this.previewContainer?.empty();
    this.closeTransientPanels();
    this.aiLayoutBtn = null;
    this.settingsBtn = null;

    // 清理文章状态缓存
    if (this.articleStates) {
      this.articleStates.clear();
    }
    if (this.svgUploadCache) {
      this.svgUploadCache.clear();
    }
    if (this.imageUploadCache) {
      this.imageUploadCache.clear();
    }
    if (this.coverUploadCache) {
      this.coverUploadCache.clear();
    }
    if (this.mermaidImageCache) {
      this.mermaidImageCache.clear();
    }

    console.log('🍎 发布助手面板已关闭');
  }

  /**
   * 简单的字符串哈希函数 (DJB2算法)
   * @param {string} str
   * @returns {number}
   */
  simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Ensure unsigned 32-bit integer
  }
}

/**
 * 📝 Obsidian 发布助手设置面板
 */
import { AppleStyleSettingTab } from './views/settings/apple-style-setting-tab.js';

Object.assign(AppleStyleView.prototype, multiPlatformResultModalsMixin);
Object.assign(AppleStyleView.prototype, coverPickerMixin);
Object.assign(AppleStyleView.prototype, wechatSyncActionsMixin);
Object.assign(AppleStyleView.prototype, wechatSyncModalMixin);
Object.assign(AppleStyleView.prototype, aiLayoutPanelMixin);
Object.assign(AppleStyleView.prototype, mediaAssetsMixin);
Object.assign(AppleStyleView.prototype, renderPipelineMixin);
Object.assign(AppleStyleView.prototype, settingsPanelMixin);

/**
 * 📝 Obsidian 发布助手主插件
 */
class AppleStylePlugin extends Plugin {
  async onload() {
    console.log('📝 正在加载 Obsidian 发布助手...');
    /** @type {ObsidianApiLike} */
    this.obsidianApi = obsidianApi;

    await this.loadSettings();

    this.registerView(
      APPLE_STYLE_VIEW,
      (leaf) => new AppleStyleView(leaf, this)
    );

    this.addRibbonIcon('wand', APPLE_STYLE_VIEW_TITLE, async () => {
      await this.openConverter();
    });

    this.addCommand({
      id: 'open-apple-converter',
      name: `打开${APPLE_STYLE_VIEW_TITLE}`,
      callback: async () => {
        await this.openConverter();
      },
    });

    this.addCommand({
      id: 'insert-image-swipe-block',
      name: getImageSwipeCommandCopy(this.app, 'image-swipe').name,
      callback: () => {
        this.insertImageSwipeCalloutFromActiveEditor('image-swipe');
      },
    });

    this.addCommand({
      id: 'insert-image-sensitive-block',
      name: getImageSwipeCommandCopy(this.app, 'image-sensitive').name,
      callback: () => {
        this.insertImageSwipeCalloutFromActiveEditor('image-sensitive');
      },
    });


    // Command 'convert-to-apple-style' removed as per user request

    this.addSettingTab(new AppleStyleSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.migrateLegacyConverterLeafTitles().catch((error) => {
        console.warn('同步转换器标题失败:', error);
      });
    });

    if (typeof this.app.vault.on === 'function') {
      this.registerEvent(
        this.app.vault.on('rename', (file, oldPath) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- reason: dynamic plugin settings
          if (this.settings.feishuSync) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- reason: dynamic file rename variables
            const changed = updateFeishuHistoryPath(this.settings.feishuSync, oldPath, file.path);
            if (changed) {
              this.saveSettings().catch((err) => {
                console.error('保存重命名设置失败:', err);
              });
            }
          }
        })
      );
    }

    this.startWechatSyncBridgeInBackground('plugin-load');

    console.log('✅ Obsidian 发布助手加载完成');
  }

  /**
   * @param {string} [type]
   */
  insertImageSwipeCalloutFromActiveEditor(type = 'image-swipe') {
    const activeView = this.app?.workspace?.getActiveViewOfType?.(MarkdownView);
    this.insertImageSwipeCallout(activeView?.editor, type);
  }

  /**
   * @param {EditorLike | null | undefined} editor
   * @param {string} [type]
   */
  insertImageSwipeCallout(editor, type = 'image-swipe') {
    if (!editor || typeof editor.replaceSelection !== 'function') {
      new Notice('请先打开一篇 Markdown 文档');
      return;
    }

    const selectedText = typeof editor.getSelection === 'function' ? editor.getSelection() : '';
    const markdown = createImageSwipeCalloutMarkdown(type, selectedText, this.app);
    editor.replaceSelection(markdown);
    new Notice(getImageSwipeCommandCopy(this.app, type).notice);
  }

  /**
   * @param {ViewStateLike | Record<string, unknown>} [baseState]
   * @param {{ active?: boolean }} [options]
   * @returns {ViewStateLike}
   */
  toConverterViewState(baseState = {}, options = {}) {
    const safeState = (baseState && typeof baseState === 'object') ? baseState : {};
    const shouldActivate = options && typeof options === 'object' && options.active === true;
    return {
      ...safeState,
      type: APPLE_STYLE_VIEW,
      state: (safeState.state && typeof safeState.state === 'object') ? safeState.state : {},
      icon: 'wand',
      title: APPLE_STYLE_VIEW_TITLE,
      active: shouldActivate,
    };
  }

  async migrateLegacyConverterLeafTitles() {
    const leaves = this.app.workspace.getLeavesOfType(APPLE_STYLE_VIEW);
    if (!Array.isArray(leaves) || leaves.length === 0) return;

    for (const leaf of leaves) {
      const currentViewState = (typeof leaf.getViewState === 'function') ? leaf.getViewState() : null;
      if (!currentViewState || currentViewState.title === APPLE_STYLE_VIEW_TITLE) continue;
      await leaf.setViewState(
        this.toConverterViewState(currentViewState, { active: currentViewState.active === true })
      );
    }
  }

  async openConverter() {
    let leaf = this.app.workspace.getLeavesOfType(APPLE_STYLE_VIEW)[0];

    if (!leaf) {
      const targetLeaf = isMobileClient(this.app)
        ? (this.app.workspace.getLeaf?.('tab') || this.app.workspace.getLeaf?.(false))
        : this.app.workspace.getRightLeaf(false);

      if (!targetLeaf) return;

      await targetLeaf.setViewState(this.toConverterViewState({}, { active: true }));
      leaf = targetLeaf;
    } else {
      const currentViewState = (typeof leaf.getViewState === 'function') ? leaf.getViewState() : null;
      if (!currentViewState || currentViewState.title !== APPLE_STYLE_VIEW_TITLE) {
        await leaf.setViewState(this.toConverterViewState(currentViewState || {}, { active: true }));
      }
    }

    await revealLeafCompat(this.app.workspace, leaf);
  }

  getConverterView() {
    const leaves = this.app.workspace.getLeavesOfType(APPLE_STYLE_VIEW);
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }

  openExternalUrl(url) {
    const target = String(url || '').trim();
    if (!/^https?:\/\//i.test(target)) return false;
    const view = this.getConverterView?.();
    if (view && typeof view === 'object') {
      const externalLinkView = /** @type {{ openExternalUrl?: unknown }} */ (view);
      const openExternalUrl = externalLinkView.openExternalUrl;
      if (typeof openExternalUrl === 'function') {
        openExternalUrl.call(externalLinkView, target);
        return true;
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const activeDoc = getActiveDocumentCompat();
        if (!activeDoc) return false;
        const a = activeDoc.createElement('a');
        a.href = target;
        a.target = '_blank';
        a.click();
        return true;
      } catch {
        if (typeof window.open === 'function') {
          window.open(target, '_blank', 'noopener');
          return true;
        }
      }
    }
    return false;
  }

  getWechatSyncBridgeService() {
    const pluginSettings = getPluginSettings(this);
    const settings = normalizeMultiPlatformSyncSettings(pluginSettings['multiPlatformSync']);
    const cacheKey = `${settings.port}:${settings.token}:${settings.allowRemote ? 1 : 0}`;
    if (this._wechatSyncBridgeService && this._wechatSyncBridgeCacheKey === cacheKey) {
      return this._wechatSyncBridgeService;
    }

    if (this._wechatSyncBridgeService?.stop) {
      this._wechatSyncBridgeService.stop().catch((error) => {
        console.warn('停止旧浏览器插件连接失败:', error);
      });
    }

    this._wechatSyncBridgeCacheKey = cacheKey;
    this._wechatSyncBridgeService = createWechatSyncBridgeService({
      port: settings.port,
      token: settings.token,
      allowRemote: settings.allowRemote,
      serverVersion: this.manifest?.version || '',
      initialConnectedClients: settings.connectedClients || [],
      onClientRegistryChange: async (clients) => {
        const currentSettings = getPluginSettings(this);
        currentSettings['multiPlatformSync'] = normalizeMultiPlatformSyncSettings({
          ...toRecord(currentSettings['multiPlatformSync']),
          connectedClients: Array.isArray(clients) ? clients : [],
        });
        await this.saveSettings();
        refreshSettingTabCompat(/** @type {SettingTabCompatLike | null | undefined} */ (this.app?.setting?.activeTab));
      },
    });
    return this._wechatSyncBridgeService;
  }

  startWechatSyncBridgeInBackground(reason = 'manual') {
    const pluginSettings = getPluginSettings(this);
    const settings = normalizeMultiPlatformSyncSettings(pluginSettings['multiPlatformSync']);
    if (!settings.enabled) return;

    const bridge = this.getWechatSyncBridgeService();
    bridge.start()
      .then((status) => {
        console.info('[Wechatsync] bridge warm start', {
          reason,
          port: settings.port,
          status,
        });
      })
      .catch((error) => {
        const errorRecord = toRecord(error);
        const readableError = toReadableError(error);
        console.warn('[Wechatsync] bridge warm start failed', {
          reason,
          port: settings.port,
          code: errorRecord.code,
          message: readableError.message,
        });
      });
  }

  async loadSettings() {
    const loadedData = toRecord(await this.loadData());
    const settings = setPluginSettings(this, Object.assign({}, DEFAULT_SETTINGS, loadedData));
    let didMigrate = false;

    if (!settings['clientId']) {
      settings['clientId'] = 'wp_dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      didMigrate = true;
    }

    settings['multiPlatformSync'] = normalizeMultiPlatformSyncSettings(settings['multiPlatformSync']);
    settings['feishuSync'] = normalizeFeishuSyncSettings(settings['feishuSync']);

    const normalizedDraftCache = normalizeDraftCache(settings['draftCache']);
    settings['draftCache'] = normalizedDraftCache.cache;
    if (normalizedDraftCache.changed) {
      didMigrate = true;
    }

    const rawAiSettings = loadedData.ai;
    settings['ai'] = normalizeAiSettings(rawAiSettings || settings['ai'] || {});
    if (rawAiSettings !== undefined) {
      const normalizedRawAi = normalizeAiSettings(toRecord(rawAiSettings));
      if (JSON.stringify(normalizedRawAi) !== JSON.stringify(rawAiSettings)) {
        didMigrate = true;
      }
    }

    // 数据迁移：将旧的单账号格式迁移到新的多账号格式
    if (settings['wechatAppId'] && settings['wechatAccounts'].length === 0) {
      const migratedAccount = {
        id: generateId(),
        name: '我的公众号',
        appId: String(settings['wechatAppId'] || ''),
        appSecret: String(settings['wechatAppSecret'] || ''),
      };
      /** @type {WechatAccountLike[]} */ (settings['wechatAccounts']).push(migratedAccount);
      settings['defaultAccountId'] = migratedAccount.id;
      // 清除旧字段
      settings['wechatAppId'] = '';
      settings['wechatAppSecret'] = '';
      didMigrate = true;
      console.log('✅ 已将旧账号配置迁移到新格式');
    }

    if (Array.isArray(settings['wechatAccounts'])) {
      settings['wechatAccounts'] = /** @type {WechatAccountLike[]} */ (settings['wechatAccounts'].map((account) => {
        if (!isRecord(account)) return /** @type {WechatAccountLike} */ ({ id: '', name: '', appId: '', appSecret: '' });
        const nextAccount = { ...account };
        let changed = false;

        if (Object.prototype.hasOwnProperty.call(nextAccount, 'enableOriginal')) {
          delete nextAccount.enableOriginal;
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(nextAccount, 'allowReprint')) {
          delete nextAccount.allowReprint;
          changed = true;
        }

        if (changed) {
          didMigrate = true;
        }
        return /** @type {WechatAccountLike} */ (nextAccount);
      }));
    }

    // 数据迁移：旧清理配置 -> cleanupDirTemplate
    const currentTemplate = normalizeVaultPath(settings['cleanupDirTemplate'] || '');
    const legacyRootDir = normalizeVaultPath(settings['cleanupRootDir'] || '');
    const legacyTarget = settings['cleanupTarget'];

    // 仅迁移旧的 folder 模式，避免把 file 模式误迁移成“删目录”
    if (!currentTemplate && legacyRootDir && legacyTarget === 'folder') {
      settings['cleanupDirTemplate'] = `${legacyRootDir}/{{note}}_img`;
      didMigrate = true;
      console.log('✅ 已将旧清理配置迁移为目录模板 cleanupDirTemplate');
    }

    // 清理弃用字段，避免后续歧义
    if (Object.prototype.hasOwnProperty.call(settings, 'cleanupRootDir')) {
      delete settings['cleanupRootDir'];
      didMigrate = true;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'cleanupTarget')) {
      delete settings['cleanupTarget'];
      didMigrate = true;
    }

    // native-only: 清理已弃用的 legacy/parity 渲染开关
    const deprecatedRenderKeys = [
      'useTripletPipeline',
      'tripletFallbackToPhase2',
      'enforceTripletParity',
      'tripletParityMaxLengthDelta',
      'tripletParityMaxSegmentCount',
      'tripletParityVerboseLog',
      'useNativePipeline',
      'enableLegacyFallback',
      'enforceNativeParity',
    ];
    for (const key of deprecatedRenderKeys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        delete settings[key];
        didMigrate = true;
      }
    }

    if (didMigrate) {
      await this.saveSettings();
    }
  }

  getArticleLayoutState(sourcePath = '', selection = {}) {
    const normalizedPath = normalizeVaultPath(sourcePath || '');
    if (!normalizedPath) return null;
    const pluginSettings = getPluginSettings(this);
    const aiSettings = normalizeAiSettings(toRecord(pluginSettings['ai']));
    const articleLayoutsByPath = toRecord(aiSettings.articleLayoutsByPath);
    const entry = articleLayoutsByPath[normalizedPath] || null;
    const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
    if (!normalizedEntry) return null;
    if (!selection || Object.keys(selection).length === 0) {
      const familyStates = toAiLayoutFamilyStates(normalizedEntry.familyStates);
      return familyStates[normalizedEntry.lastLayoutFamily] || null;
    }
    return toAiLayoutState(getArticleLayoutSelectionState(normalizedEntry, toAiLayoutSelection(selection), {
      layoutFamily: aiSettings.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
      colorPalette: aiSettings.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
    }));
  }

  async saveArticleLayoutState(sourcePath = '', nextState = null, selection = {}) {
    const normalizedPath = normalizeVaultPath(sourcePath || '');
    if (!normalizedPath) return false;
    const pluginSettings = getPluginSettings(this);
    if (!pluginSettings['ai']) {
      pluginSettings['ai'] = createDefaultAiSettings();
    }
    const aiSettings = /** @type {AiSettingsLike} */ (pluginSettings['ai']);
    if (!isRecord(aiSettings.articleLayoutsByPath)) {
      aiSettings.articleLayoutsByPath = {};
    }
    const articleLayoutsByPath = /** @type {Record<string, unknown>} */ (aiSettings.articleLayoutsByPath);
    const existingEntry = normalizeArticleLayoutCacheEntry(articleLayoutsByPath[normalizedPath]) || {
      lastLayoutFamily: '',
      lastAutoResolvedFamily: '',
      familyStates: {},
    };
    const existingFamilyStates = toAiLayoutFamilyStates(existingEntry.familyStates);
    existingEntry.familyStates = existingFamilyStates;
    const nextLayoutState = toAiLayoutState(nextState);
    const hasExplicitSelection = typeof selection === 'string'
      || (selection && typeof selection === 'object' && Object.keys(selection).length > 0);
    const requestedSelection = normalizeLayoutSelection(
      nextLayoutState?.selection || (hasExplicitSelection ? toAiLayoutSelection(selection) : null) || {
        layoutFamily: nextLayoutState?.layoutFamily || nextLayoutState?.resolved?.layoutFamily,
        colorPalette: nextLayoutState?.stylePack || nextLayoutState?.resolved?.colorPalette || nextLayoutState?.layoutJson?.stylePack,
      },
      {
        layoutFamily: aiSettings.defaultLayoutFamily || AI_LAYOUT_SELECTION_AUTO,
        colorPalette: aiSettings.defaultColorPalette || AI_LAYOUT_SELECTION_AUTO,
      }
    );
    const getCacheFamily = (state = null) => {
      const stateRecord = toAiLayoutState(state);
      const normalizedState = normalizeArticleLayoutState(stateRecord || {});
      const rawFamily = normalizedState?.resolved?.layoutFamily
        || normalizedState?.layoutFamily
        || stateRecord?.resolved?.layoutFamily
        || stateRecord?.layoutFamily
        || (requestedSelection.layoutFamily !== AI_LAYOUT_SELECTION_AUTO ? requestedSelection.layoutFamily : '');
      const normalizedFamily = normalizeLayoutSelection({ layoutFamily: rawFamily }).layoutFamily;
      return normalizedFamily === AI_LAYOUT_SELECTION_AUTO ? '' : normalizedFamily;
    };
    const effectiveLayoutFamily = getCacheFamily(nextLayoutState);

    if (!nextLayoutState) {
      if (selection && Object.keys(selection).length && effectiveLayoutFamily) {
        delete existingFamilyStates[effectiveLayoutFamily];
        const remainingFamilies = Object.keys(existingFamilyStates);
        if (!remainingFamilies.length) {
          delete articleLayoutsByPath[normalizedPath];
        } else {
          existingEntry.lastLayoutFamily = existingFamilyStates[existingEntry.lastLayoutFamily]
            ? existingEntry.lastLayoutFamily
            : remainingFamilies[0];
          if (existingEntry.lastAutoResolvedFamily && !existingFamilyStates[existingEntry.lastAutoResolvedFamily]) {
            existingEntry.lastAutoResolvedFamily = '';
          }
          articleLayoutsByPath[normalizedPath] = normalizeArticleLayoutCacheEntry(existingEntry) || existingEntry;
        }
      } else {
        delete articleLayoutsByPath[normalizedPath];
      }
    } else {
      const resolvedLayoutFamily = effectiveLayoutFamily || 'source-first';
      const inferredSkillId = nextLayoutState.skillId
        || resolvedLayoutFamily
        || requestedSelection.layoutFamily;
      const inferredSkillVersion = nextLayoutState.skillVersion
        || nextLayoutState.generationMeta?.skillVersion
        || getLayoutFamilyById(inferredSkillId)?.version
        || '';
      existingFamilyStates[resolvedLayoutFamily] = {
        ...nextLayoutState,
        skillId: inferredSkillId,
        skillVersion: inferredSkillVersion,
        selection: requestedSelection,
        resolved: {
          ...(nextLayoutState.resolved || {}),
          layoutFamily: resolvedLayoutFamily,
          colorPalette: nextLayoutState.stylePack || nextLayoutState.resolved?.colorPalette || 'tech-green',
        },
        layoutFamily: resolvedLayoutFamily,
        stylePack: nextLayoutState.stylePack || nextLayoutState.resolved?.colorPalette || 'tech-green',
      };
      existingEntry.lastLayoutFamily = resolvedLayoutFamily;
      if (requestedSelection.layoutFamily === AI_LAYOUT_SELECTION_AUTO) {
        existingEntry.lastAutoResolvedFamily = resolvedLayoutFamily;
      }
      articleLayoutsByPath[normalizedPath] = normalizeArticleLayoutCacheEntry(existingEntry) || existingEntry;
    }
    return this.saveSettings();
  }

  async saveSettings() {
    try {
      await this.saveData(getPluginSettings(this));
      return true;
    } catch (error) {
      console.error('保存插件设置失败:', error);
      const now = Date.now();
      if (!this._lastSaveSettingsErrorAt || now - this._lastSaveSettingsErrorAt > 3000) {
        this._lastSaveSettingsErrorAt = now;
        new Notice('⚠️ 设置保存失败，本次修改仅在当前会话生效');
      }
      return false;
    }
  }

  async onunload() {
    if (this._wechatSyncBridgeService?.stop) {
      await this._wechatSyncBridgeService.stop().catch((error) => {
        console.warn('停止浏览器插件连接失败:', error);
      });
    }
    console.log('📝 Obsidian 发布助手已卸载');
  }
}

AppleStylePlugin.default = AppleStylePlugin;
AppleStylePlugin.AppleStylePlugin = AppleStylePlugin;
AppleStylePlugin.AppleStyleView = AppleStyleView;
AppleStylePlugin.WechatAPI = WechatAPI;
AppleStylePlugin.AppleStyleSettingTab = AppleStyleSettingTab;
AppleStylePlugin.createImageSwipeCalloutMarkdown = createImageSwipeCalloutMarkdown;
AppleStylePlugin.getImageSwipeCommandCopy = getImageSwipeCommandCopy;
AppleStylePlugin.stripMarkdownFrontmatter = stripMarkdownFrontmatter;
AppleStylePlugin.describeWechatsyncConnectionState = describeWechatsyncConnectionState;
AppleStylePlugin.renderWechatsyncConnectionStatusBar = renderWechatsyncConnectionStatusBar;
AppleStylePlugin.formatWechatsyncCheckedAt = formatWechatsyncCheckedAt;

export default AppleStylePlugin;
export {
  AppleStylePlugin,
  AppleStyleView,
  WechatAPI,
  AppleStyleSettingTab,
  createImageSwipeCalloutMarkdown,
  getImageSwipeCommandCopy,
  stripMarkdownFrontmatter,
  describeWechatsyncConnectionState,
  renderWechatsyncConnectionStatusBar,
  formatWechatsyncCheckedAt,
};
