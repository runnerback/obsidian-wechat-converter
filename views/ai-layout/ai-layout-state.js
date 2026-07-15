// views/ai-layout/ai-layout-state.js
//
// AI 编排子系统(ai-layout-panel.js)的实例状态初始化。原先散落在
// AppleStyleView 构造函数里的 47 个 aiXxx 字段收编到此:构造函数只调
// initAiLayoutState(this),不再逐个声明。字段仍挂在 view 实例上
// (mixin 与测试沿用 view.aiXxx 访问),但声明与归属集中到本模块,
// God-Class 构造函数得以瘦身。此为 God-Class 拆分的试点(P0)。

/**
 * 初始化 AI 编排相关的全部实例字段(DOM 引用 / 生成状态 / 计时器 / 调试面板等)。
 * @param {Record<string, unknown>} view AppleStyleView 实例
 */
export function initAiLayoutState(view) {
  /** @type {string} */
  view.aiLayoutSourceSwitchPath = '';
  /** @type {string} */
  view.aiLayoutStaleSuppressPath = '';
  /** @type {number} */
  view.aiLayoutStaleSuppressUntil = 0;
  /** @type {number | null} */
  view.aiLayoutStaleSuppressTimer = null;
  /** @type {boolean} */
  view.aiPreviewApplied = false;
  view.aiLayoutBtn = null;
  view.aiLayoutDebugMode = '';
  /** @type {Record<string, unknown> | null} */
  view.aiLayoutActiveGenerationSelection = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutOverlay = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutArea = null;
  /** @type {ObsidianInputLike | null} */
  view.aiLayoutFamilySelect = null;
  /** @type {ObsidianInputLike | null} */
  view.aiColorPaletteSelect = null;
  /** @type {ObsidianInputLike | null} */
  view.aiStylePackSelect = null;
  /** @type {ObsidianInputLike | null} */
  view.aiCustomColorInput = null;
  /** @type {ObsidianElementLike | null} */
  view.aiColorPaletteControls = null;
  /** @type {ObsidianElementLike | null} */
  view.aiColorPaletteGrid = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutStatus = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutStatusBadge = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutStatusBody = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutStatusText = null;
  /** @type {ObsidianElementLike | null} */
  view.aiCachedLayoutList = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutSummary = null;
  /** @type {ObsidianElementLike | null} */
  view.aiGenerateBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiRegenerateBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiResetBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiRestoreBlocksBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiResultSection = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutMetaNote = null;
  /** @type {ObsidianElementLike | null} */
  view.aiBlockList = null;
  /** @type {ObsidianElementLike | null} */
  view.aiAdvancedToggleBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiAdvancedBody = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutMetaChips = null;
  /** @type {ObsidianElementLike | null} */
  view.aiSchemaIssuePanel = null;
  /** @type {ObsidianElementLike | null} */
  view.aiViewJsonBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiViewErrorBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiDebugPanel = null;
  /** @type {ObsidianElementLike | null} */
  view.aiDebugPanelTitle = null;
  /** @type {ObsidianElementLike | null} */
  view.aiCopyPromptBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiCopyDebugBtn = null;
  /** @type {ObsidianElementLike | null} */
  view.aiDebugPanelBody = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutLoadingMask = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutLoadingSpinner = null;
  /** @type {ObsidianElementLike | null} */
  view.aiLayoutLoadingMaskText = null;
  /** @type {string} */
  view.aiPrimaryActionMode = '';
  /** @type {boolean} */
  view.aiLayoutLoading = false;
  /** @type {boolean} */
  view.aiAdvancedOpen = false;
  /** @type {{ blockKey: string, relativeTop: number, fallbackScrollTop: number } | null} */
  view.aiLayoutPendingAnchor = null;
}
