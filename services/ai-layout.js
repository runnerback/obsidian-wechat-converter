import {
  AI_LAYOUT_SKILL_VERSION,
  AI_LAYOUT_SELECTION_AUTO,
  AI_LAYOUT_FAMILIES,
  AI_LAYOUT_COLOR_PALETTES,
  AI_LAYOUT_ALLOWED_BLOCKS,
  AI_LAYOUT_SKILL_SYSTEM_LINES,
  AI_LAYOUT_OUTPUT_FIELDS,
  getAiLayoutBlockConstraintLines,
  getAiLayoutSkillById,
  getAiLayoutSkillList,
  getAiLayoutSharedResources,
  validateAiLayoutPayload,
} from './ai-layout-skill-bundle.js';
import { createHtmlContainer, getActiveDocument } from './dom-utils.js';

/**
 * @typedef {{ type: string, fields: string[] }} AiLayoutBlockDefinition
 * @typedef {{ id: string, label: string, description?: string, recommendedFor?: string[], tokens?: Record<string, string> }} AiLayoutColorPalette
 * @typedef {{ id: string, label?: string, description?: string, version?: string }} AiLayoutSkillManifest
 * @typedef {{ id: string, label: string, description?: string, version?: string, manifest: AiLayoutSkillManifest, prompt: string, blocks: unknown, fallback: unknown }} AiLayoutSkill
 * @typedef {{ typography?: Record<string, unknown>, image?: Record<string, unknown>, profiles?: Record<string, Record<string, unknown>>, sectionLabels?: Record<string, string>, allowedCssNotes?: unknown[] }} AiLayoutStylePrimitives
 * @typedef {{ version?: string, colorPalettes?: { colorPalettes?: AiLayoutColorPalette[] }, blockCatalog?: { blocks?: AiLayoutBlockDefinition[], outputFields?: string[] }, wechatSafeStylePrimitives?: AiLayoutStylePrimitives, schema?: Record<string, unknown>, template?: Record<string, unknown> }} AiLayoutSharedResources
 * @typedef {{ layoutFamily?: string, layout?: string, family?: string, colorPalette?: string, palette?: string, stylePack?: string }} AiLayoutSelectionLike
 * @typedef {{ layoutFamily?: string, colorPalette?: string }} AiLayoutResolvedSelectionLike
 * @typedef {{ baseUrl?: string, apiKey?: string, model?: string, id?: string, kind?: string, name?: string, enabled?: boolean }} AiProviderLike
 * @typedef {{ customColor?: string, accentColor?: string, accent?: string }} AiColorPaletteOverride
 * @typedef {{ path?: string, message?: string, fatal?: boolean }} AiLayoutSchemaIssue
 * @typedef {{ isValid?: boolean, fatal?: boolean, issueCount?: number, issues?: AiLayoutSchemaIssue[] }} AiLayoutSchemaValidationLike
 * @typedef {{ index?: number, type?: string, source?: 'ai' | 'fallback', label?: string }} AiLayoutBlockOriginLike
 * @typedef {{ providerName?: string, providerModel?: string, skillId?: string, skillLabel?: string, skillVersion?: string, executionMode?: string, layoutFamilyLabel?: string, colorPaletteLabel?: string, stylePackLabel?: string, recommendedLayoutFamilyLabel?: string, recommendedColorPaletteLabel?: string, headingCount?: number, sectionCount?: number, leadParagraphCount?: number, bulletGroupCount?: number, imageCount?: number, aiBlockCount?: number, finalBlockCount?: number, fallbackUsed?: boolean, fallbackBlockCount?: number, fallbackBlockTypes?: string[], schemaValidation?: AiLayoutSchemaValidationLike, blockOrigins?: AiLayoutBlockOriginLike[] } AiLayoutGenerationMetaLike
 * @typedef {{ version?: number, updatedAt?: number, sourceHash?: string, providerId?: string, model?: string, skillId?: string, skillVersion?: string, selection?: AiLayoutSelectionLike, resolved?: AiLayoutResolvedSelectionLike, recommendedLayoutFamily?: string, recommendedColorPalette?: string, stylePack?: string, layoutFamily?: string, status?: 'ready'|'error'|'schema-error', lastError?: string, lastAttemptStatus?: 'idle'|'success'|'error'|'schema-error', lastAttemptError?: string, lastAttemptAt?: number, lastAttemptSchemaValidation?: AiLayoutSchemaValidationLike, dismissedBlockKeys?: string[], generationMeta?: AiLayoutGenerationMetaLike, layoutJson?: Record<string, unknown> } AiLayoutStateLike
 * @typedef {{ type?: string, label?: string, text?: string, title?: string, summary?: string, caseLabel?: string, highlight?: string, note?: string, imageId?: string, coverImageId?: string, variant?: string, eyebrow?: string, subtitle?: string, sectionIndex?: number|string, sectionLabel?: string, headingLevel?: number, paragraphs?: string[], bulletGroups?: string[][], bullets?: string[], callouts?: AiLayoutCalloutLike[], imageIds?: string[], items?: Array<{ label?: string, text?: string, title?: string }>, subsections?: AiLayoutSubsectionLike[], quote?: string }} AiLayoutBlockLike
 * @typedef {{ type?: string, title?: string, body?: string }} AiLayoutCalloutLike
 * @typedef {{ title?: string, heading?: string, level?: number, paragraphs?: string[], bulletGroups?: string[][], callouts?: AiLayoutCalloutLike[] }} AiLayoutSubsectionLike
 * @typedef {{ title?: string, heading?: string, index?: number|string, level?: number, paragraphs?: string[], bulletGroups?: string[][], callouts?: AiLayoutCalloutLike[], subsections?: AiLayoutSubsectionLike[] }} AiLayoutSourceSectionLike
 * @typedef {{ headings: string[], sectionTitles: string[], paragraphs: string[], leadParagraphs: string[], bulletGroups: string[][], lastParagraph: string }} MarkdownSignals
 * @typedef {{ level: number, text: string }} MarkdownHeading
 * @typedef {{ type: string, title: string, body: string }} MarkdownCallout
 * @typedef {{ level?: number, title: string, paragraphs: string[], bulletGroups: string[][], callouts: MarkdownCallout[] }} MarkdownSubsection
 * @typedef {{ index: number, level: number, title: string, paragraphs: string[], bulletGroups: string[][], callouts: MarkdownCallout[], subsections: MarkdownSubsection[] }} MarkdownSection
 * @typedef {{ introParagraphs: string[], introBulletGroups: string[][], introCallouts: MarkdownCallout[], headings: MarkdownHeading[], sections: MarkdownSection[] }} MarkdownStructure
 * @typedef {{ id?: string, src?: string, alt?: string, caption?: string }} AiImageRefLike
 * @typedef {{ accent?: string, accentDeep?: string, accentSoft?: string, text?: string, muted?: string, border?: string, surface?: string, surfaceSoft?: string, quoteBg?: string }} AiColorTokens
 * @typedef {{ articleType?: string, selection?: AiLayoutSelectionLike, resolved?: AiLayoutResolvedSelectionLike, recommendedLayoutFamily?: string, recommendedColorPalette?: string, title?: string, summary?: string, stylePack?: string, layoutFamily?: string, blocks?: AiLayoutBlockLike[] }} AiLayoutJsonLike
 * @typedef {{ lastLayoutFamily?: string, lastAutoResolvedFamily?: string, familyStates?: Record<string, AiLayoutStateLike>, lastSelectionKey?: string, selectionStates?: Record<string, AiLayoutStateLike>, lastStylePack?: string, stylePackStates?: Record<string, AiLayoutStateLike> }} AiLayoutCacheEntryLike
 * @typedef {{ enabled: boolean, defaultProviderId: string, defaultLayoutFamily: string, defaultColorPalette: string, defaultStylePack?: string, customColor: string, includeImagesInLayout: boolean, requestTimeoutMs: number, providers: ReturnType<typeof normalizeAiProvider>[], articleLayoutsByPath: Record<string, AiLayoutCacheEntryLike> }} AiSettingsLike
 * @typedef {{ title?: string, leadHtml?: string, subsections?: RenderedSubsectionFragmentLike[] }} RenderedSectionFragmentLike
 * @typedef {{ title?: string, titleKey?: string, contentHtml?: string }} RenderedSubsectionFragmentLike
 * @typedef {{ ok: boolean, status: number, statusText?: string, text: () => Promise<string>, json: () => Promise<unknown> }} FetchResponseLike
 * @typedef {(url: string, options: Record<string, unknown>) => Promise<FetchResponseLike>} FetchLike
 * @typedef {typeof globalThis.fetch} GlobalFetchLike
 * @typedef {{ provider: ReturnType<typeof normalizeAiProvider>, title?: string, markdown: string, selection?: AiLayoutSelectionLike, stylePack?: string, imageRefs?: AiImageRefLike[], timeoutMs: number, abortTimeoutMs?: number, fetchImpl: FetchLike }} AiLayoutRequestOptions
 */

const AI_LAYOUT_SCHEMA_VERSION = 1;

const AI_PROVIDER_KINDS = {
  OPENAI_COMPATIBLE: 'openai-compatible',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
};

const MAX_LAYOUT_BLOCKS = 24;
const MAX_PART_NAV_ITEMS = 6;
const MAX_CASE_BLOCK_BULLETS = 6;
const MAX_CASE_BLOCK_IMAGE_IDS = 4;
const ANTHROPIC_LAYOUT_MAX_TOKENS = 8192;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120000;
const AI_LAYOUT_DEFAULT_FAMILY = 'source-first';
const AI_LAYOUT_DEFAULT_COLOR_PALETTE = 'tech-green';
/** @type {Set<string>} */
const AI_LAYOUT_IMPLEMENTED_FAMILIES = new Set(AI_LAYOUT_FAMILIES);
/** @type {Record<string, string>} */
const AI_LAYOUT_RESERVED_FAMILY_FALLBACKS = {};
/** @type {AiLayoutSharedResources} */
const AI_LAYOUT_SHARED_RESOURCES = getAiLayoutSharedResources();
/** @type {AiLayoutSkill[]} */
const AI_LAYOUT_SKILL_LIST = getAiLayoutSkillList();
/** @type {Record<string, AiLayoutSkill>} */
const AI_LAYOUT_FAMILY_DEFS = AI_LAYOUT_SKILL_LIST.reduce((acc, skill) => {
  acc[skill.id] = {
    id: skill.id,
    label: skill.manifest.label,
    description: skill.manifest.description || '',
    version: skill.manifest.version,
    manifest: skill.manifest,
    prompt: skill.prompt,
    blocks: skill.blocks,
    fallback: skill.fallback,
  };
  return acc;
}, /** @type {Record<string, AiLayoutSkill>} */ ({}));

/** @type {Record<string, AiLayoutColorPalette>} */
const AI_COLOR_PALETTES = (AI_LAYOUT_SHARED_RESOURCES.colorPalettes?.colorPalettes || []).reduce((acc, palette) => {
  acc[palette.id] = {
    id: palette.id,
    label: palette.label,
    description: palette.description || '',
    recommendedFor: Array.isArray(palette.recommendedFor) ? palette.recommendedFor.slice() : [],
    tokens: { ...(palette.tokens || {}) },
  };
  return acc;
}, /** @type {Record<string, AiLayoutColorPalette>} */ ({}));

/** @type {AiLayoutStylePrimitives} */
const AI_WECHAT_SAFE_STYLE_PRIMITIVES = AI_LAYOUT_SHARED_RESOURCES.wechatSafeStylePrimitives || {
  typography: {},
  image: {},
  profiles: {},
  sectionLabels: {},
};

const AI_STYLE_PACKS = AI_COLOR_PALETTES;

const AI_PROVIDER_KIND_DEFAULTS = {
  [AI_PROVIDER_KINDS.OPENAI_COMPATIBLE]: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  [AI_PROVIDER_KINDS.GEMINI]: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  [AI_PROVIDER_KINDS.ANTHROPIC]: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-haiku-latest',
  },
};

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {AiLayoutSelectionLike}
 */
function toSelectionRecord(value) {
  return isRecord(value) ? /** @type {AiLayoutSelectionLike} */ (value) : {};
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function toRecord(value) {
  return isRecord(value) ? /** @type {Record<string, unknown>} */ (value) : {};
}

/**
 * @param {unknown} value
 * @returns {AiLayoutBlockLike[]}
 */
function toAiLayoutBlocks(value) {
  return Array.isArray(value)
    ? value.map((item) => /** @type {AiLayoutBlockLike} */ (toRecord(item)))
    : [];
}

/**
 * @param {unknown} value
 * @returns {AiImageRefLike[]}
 */
function toAiImageRefs(value) {
  return Array.isArray(value)
    ? value.map((image) => /** @type {AiImageRefLike} */ (toRecord(image)))
    : [];
}

/**
 * @param {Element | null | undefined} element
 * @param {Record<string, string | number | null | undefined>} styles
 */
function applyElementCssStyles(element, styles) {
  const target = /** @type {Element & { setCssStyles?: (styles: Record<string, string | number | null | undefined>) => void }} */ (element);
  if (!target || typeof target.setCssStyles !== 'function') return;
  target.setCssStyles(styles);
}

/** @returns {GlobalFetchLike | undefined} */
function getDefaultFetch() {
  const activeWindow = typeof window !== 'undefined' ? /** @type {Window & typeof globalThis} */ (window) : null;
  if (activeWindow && typeof activeWindow.fetch === 'function') {
    /** @type {GlobalFetchLike} */
    const fetchFromActiveWindow = (input, init) => activeWindow.fetch(input, init);
    return fetchFromActiveWindow;
  }
  return undefined;
}

/**
 * @param {TimerHandler} callback
 * @param {number} delay
 * @returns {number | null}
 */
function setAiLayoutTimeout(callback, delay) {
  if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return null;
  return window.setTimeout(callback, delay);
}

/**
 * @param {number | null | undefined} timer
 */
function clearAiLayoutTimeout(timer) {
  if (!timer || typeof window === 'undefined' || typeof window.clearTimeout !== 'function') return;
  window.clearTimeout(timer);
}

/**
 * @returns {AiSettingsLike}
 */
function createDefaultAiSettings() {
  return {
    enabled: true,
    defaultProviderId: '',
    defaultLayoutFamily: AI_LAYOUT_SELECTION_AUTO,
    defaultColorPalette: AI_LAYOUT_SELECTION_AUTO,
    customColor: '#7c3aed',
    includeImagesInLayout: true,
    requestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
    providers: [],
    articleLayoutsByPath: {},
  };
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * @param {unknown} value
 * @param {string} [fallback='#7c3aed']
 * @returns {string}
 */
function normalizeHexColor(value, fallback = '#7c3aed') {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

/**
 * @param {unknown} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {string}
 */
function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => {
    const clamped = Math.max(0, Math.min(255, Math.round(channel)));
    return clamped.toString(16).padStart(2, '0');
  }).join('')}`;
}

/**
 * @param {unknown} color
 * @param {unknown} target
 * @param {number} amount
 * @returns {string}
 */
function mixHexColor(color, target, amount) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  return rgbToHex({
    r: sourceRgb.r + (targetRgb.r - sourceRgb.r) * amount,
    g: sourceRgb.g + (targetRgb.g - sourceRgb.g) * amount,
    b: sourceRgb.b + (targetRgb.b - sourceRgb.b) * amount,
  });
}

/**
 * @param {unknown} accentColor
 * @param {{ id?: string, label?: string }} [options={}]
 * @returns {AiLayoutColorPalette}
 */
function createColorPaletteFromAccent(accentColor, { id = 'custom', label = '自定义' } = {}) {
  const accent = normalizeHexColor(accentColor);
  return {
    id,
    label,
    description: 'AI 编排独立自定义色，会根据你选择的颜色自动派生深色、浅底和边框。',
    recommendedFor: ['custom'],
    tokens: {
      accent,
      accentDeep: mixHexColor(accent, '#000000', 0.28),
      accentSoft: mixHexColor(accent, '#ffffff', 0.9),
      text: mixHexColor(accent, '#1f2937', 0.78),
      muted: mixHexColor(accent, '#6b7280', 0.72),
      border: mixHexColor(accent, '#ffffff', 0.78),
      surface: '#ffffff',
      surfaceSoft: mixHexColor(accent, '#ffffff', 0.96),
      quoteBg: mixHexColor(accent, '#ffffff', 0.93),
    },
  };
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_SELECTION_AUTO]
 * @returns {string}
 */
function normalizeLayoutFamily(value, fallback = AI_LAYOUT_SELECTION_AUTO) {
  const normalized = coerceString(value);
  if (normalized === AI_LAYOUT_SELECTION_AUTO) return AI_LAYOUT_SELECTION_AUTO;
  return AI_LAYOUT_FAMILY_DEFS[normalized] ? normalized : fallback;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_SELECTION_AUTO]
 * @returns {string}
 */
function normalizeColorPalette(value, fallback = AI_LAYOUT_SELECTION_AUTO) {
  const normalized = coerceString(value);
  if (normalized === AI_LAYOUT_SELECTION_AUTO) return AI_LAYOUT_SELECTION_AUTO;
  return AI_COLOR_PALETTES[normalized] ? normalized : fallback;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_FAMILY]
 * @returns {string}
 */
function normalizeResolvedLayoutFamily(value, fallback = AI_LAYOUT_DEFAULT_FAMILY) {
  const normalized = coerceString(value);
  if (!normalized) return fallback;
  if (AI_LAYOUT_IMPLEMENTED_FAMILIES.has(normalized)) return normalized;
  if (AI_LAYOUT_RESERVED_FAMILY_FALLBACKS[normalized]) {
    return AI_LAYOUT_RESERVED_FAMILY_FALLBACKS[normalized];
  }
  return AI_LAYOUT_IMPLEMENTED_FAMILIES.has(fallback) ? fallback : AI_LAYOUT_DEFAULT_FAMILY;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_COLOR_PALETTE]
 * @returns {string}
 */
function normalizeResolvedColorPalette(value, fallback = AI_LAYOUT_DEFAULT_COLOR_PALETTE) {
  const normalized = coerceString(value);
  if (AI_COLOR_PALETTES[normalized]) return normalized;
  return AI_COLOR_PALETTES[fallback] ? fallback : AI_LAYOUT_DEFAULT_COLOR_PALETTE;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_COLOR_PALETTE]
 * @returns {string}
 */
function normalizeAutoRecommendedColorPalette(value, fallback = AI_LAYOUT_DEFAULT_COLOR_PALETTE) {
  const normalized = normalizeResolvedColorPalette(value, fallback);
  if (normalized === 'custom') {
    const fallbackPalette = normalizeResolvedColorPalette(fallback, AI_LAYOUT_DEFAULT_COLOR_PALETTE);
    return fallbackPalette === 'custom' ? AI_LAYOUT_DEFAULT_COLOR_PALETTE : fallbackPalette;
  }
  return normalized;
}

/**
 * @param {AiLayoutSelectionLike | string | null | undefined} [raw={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [fallback={}]
 * @returns {{ layoutFamily: string, colorPalette: string }}
 */
function normalizeLayoutSelection(raw = {}, fallback = {}) {
  const candidate = (typeof raw === 'string')
    ? (AI_COLOR_PALETTES[raw]
      ? { colorPalette: raw }
      : (AI_LAYOUT_FAMILY_DEFS[raw] ? { layoutFamily: raw } : {}))
    : toSelectionRecord(raw);
  const fallbackRecord = toSelectionRecord(fallback);
  return {
    layoutFamily: normalizeLayoutFamily(
      candidate.layoutFamily ?? candidate.layout ?? candidate.family ?? fallbackRecord.layoutFamily,
      normalizeLayoutFamily(fallbackRecord.layoutFamily, AI_LAYOUT_SELECTION_AUTO)
    ),
    colorPalette: normalizeColorPalette(
      candidate.colorPalette ?? candidate.palette ?? candidate.stylePack ?? fallbackRecord.colorPalette,
      normalizeColorPalette(fallbackRecord.colorPalette, AI_LAYOUT_SELECTION_AUTO)
    ),
  };
}

/**
 * @param {AiLayoutResolvedSelectionLike | AiLayoutSelectionLike | string | null | undefined} [raw={}]
 * @param {AiLayoutResolvedSelectionLike | AiLayoutSelectionLike | string | null | undefined} [fallback={}]
 * @returns {{ layoutFamily: string, colorPalette: string }}
 */
function normalizeResolvedSelection(raw = {}, fallback = {}) {
  const candidate = (typeof raw === 'string')
    ? (AI_COLOR_PALETTES[raw]
      ? { colorPalette: raw }
      : (AI_LAYOUT_FAMILY_DEFS[raw] ? { layoutFamily: raw } : {}))
    : toSelectionRecord(raw);
  const fallbackRecord = toSelectionRecord(fallback);
  return {
    layoutFamily: normalizeResolvedLayoutFamily(
      candidate.layoutFamily ?? candidate.layout ?? candidate.family ?? fallbackRecord.layoutFamily,
      normalizeResolvedLayoutFamily(fallbackRecord.layoutFamily, AI_LAYOUT_DEFAULT_FAMILY)
    ),
    colorPalette: normalizeResolvedColorPalette(
      candidate.colorPalette ?? candidate.palette ?? candidate.stylePack ?? fallbackRecord.colorPalette,
      normalizeResolvedColorPalette(fallbackRecord.colorPalette, AI_LAYOUT_DEFAULT_COLOR_PALETTE)
    ),
  };
}

/**
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @returns {string}
 */
function getArticleLayoutSelectionKey(selection = {}) {
  const normalized = normalizeLayoutSelection(selection);
  return `${normalized.layoutFamily || AI_LAYOUT_SELECTION_AUTO}::${normalized.colorPalette || AI_LAYOUT_SELECTION_AUTO}`;
}

/**
 * @param {{ includeAuto?: boolean, includeReserved?: boolean }} [options={}]
 * @returns {{ value: string, label: string, description?: string }[]}
 */
function getLayoutFamilyList({ includeAuto = true, includeReserved = false } = {}) {
  const list = [];
  if (includeAuto) {
    list.push({
      value: AI_LAYOUT_SELECTION_AUTO,
      label: '自动推荐',
      description: '由 AI 根据文章内容自动推荐布局。',
    });
  }
  Object.values(AI_LAYOUT_FAMILY_DEFS).forEach((family) => {
    if (!includeReserved && !AI_LAYOUT_IMPLEMENTED_FAMILIES.has(family.id)) return;
    list.push({
      value: family.id,
      label: family.label,
      description: family.description,
    });
  });
  return list;
}

/**
 * @param {string | null | undefined} id
 * @returns {AiLayoutSkill}
 */
function getLayoutFamilyById(id) {
  const normalizedId = normalizeResolvedLayoutFamily(id, AI_LAYOUT_DEFAULT_FAMILY);
  return AI_LAYOUT_FAMILY_DEFS[normalizedId] || AI_LAYOUT_FAMILY_DEFS[AI_LAYOUT_DEFAULT_FAMILY];
}

/**
 * @param {string | null | undefined} id
 * @returns {AiLayoutSkill}
 */
function getLayoutSkillById(id) {
  const normalizedId = normalizeResolvedLayoutFamily(id, AI_LAYOUT_DEFAULT_FAMILY);
  return getAiLayoutSkillById(normalizedId) || getAiLayoutSkillById(AI_LAYOUT_DEFAULT_FAMILY);
}

/**
 * @param {string | null | undefined} layoutFamilyId
 * @returns {Record<string, unknown>}
 */
function getWechatSafeRenderProfile(layoutFamilyId) {
  const normalizedId = normalizeResolvedLayoutFamily(layoutFamilyId, AI_LAYOUT_DEFAULT_FAMILY);
  const profiles = AI_WECHAT_SAFE_STYLE_PRIMITIVES.profiles || {};
  return toRecord(profiles[normalizedId] || profiles[AI_LAYOUT_DEFAULT_FAMILY] || {});
}

/**
 * @param {{ includeAuto?: boolean }} [options={}]
 * @returns {{ value: string, label: string, description?: string }[]}
 */
function getColorPaletteList({ includeAuto = true } = {}) {
  const list = [];
  if (includeAuto) {
    list.push({
      value: AI_LAYOUT_SELECTION_AUTO,
      label: '自动推荐',
      description: '由 AI 根据文章内容自动推荐颜色。',
    });
  }
  Object.values(AI_COLOR_PALETTES).forEach((pack) => {
    list.push({
      value: pack.id,
      label: pack.label,
      description: pack.description,
    });
  });
  return list;
}

/**
 * @param {string | null | undefined} id
 * @returns {AiLayoutColorPalette}
 */
function getColorPaletteById(id) {
  return AI_COLOR_PALETTES[normalizeResolvedColorPalette(id)] || AI_COLOR_PALETTES[AI_LAYOUT_DEFAULT_COLOR_PALETTE];
}

/**
 * @param {string | null | undefined} id
 * @param {AiColorPaletteOverride} [override={}]
 * @returns {AiLayoutColorPalette}
 */
function resolveColorPaletteForRender(id, override = {}) {
  const normalizedId = normalizeResolvedColorPalette(id);
  const customColor = normalizeHexColor(
    override?.customColor || override?.accentColor || override?.accent || '',
    ''
  );
  if (normalizedId === 'custom' && customColor) {
    return createColorPaletteFromAccent(customColor, {
      id: 'custom',
      label: getColorPaletteById('custom')?.label || '自定义',
    });
  }
  return getColorPaletteById(normalizedId);
}

/**
 * @param {{ requestedSelection?: AiLayoutSelectionLike | string, rawLayout?: AiLayoutStateLike | Record<string, unknown>, signals?: Record<string, unknown> | null, imageRefs?: unknown[] }} [options={}]
 * @returns {{ selection: { layoutFamily: string, colorPalette: string }, resolved: { layoutFamily: string, colorPalette: string }, recommendedLayoutFamily: string, recommendedColorPalette: string }}
 */
function resolveLayoutSelection({
  requestedSelection = {},
  rawLayout = {},
  signals = null,
  imageRefs = [],
} = {}) {
  const selection = normalizeLayoutSelection(requestedSelection);
  const rawLayoutRecord = toRecord(rawLayout);
  const rawResolved = toSelectionRecord(rawLayoutRecord.resolved);
  const inferredLayoutFamily = recommendLayoutFamily({ rawLayout, signals, imageRefs });
  const inferredColorPalette = recommendColorPalette({ rawLayout, signals });
  const recommendedLayoutFamily = normalizeResolvedLayoutFamily(
    rawLayoutRecord.recommendedLayoutFamily || rawResolved.layoutFamily || rawLayoutRecord.layoutFamily,
    inferredLayoutFamily
  );
  const recommendedColorPalette = normalizeAutoRecommendedColorPalette(
    rawLayoutRecord.recommendedColorPalette || rawResolved.colorPalette || rawLayoutRecord.stylePack,
    inferredColorPalette
  );
  const resolved = {
    layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO
      ? recommendedLayoutFamily
      : normalizeResolvedLayoutFamily(selection.layoutFamily, recommendedLayoutFamily),
    colorPalette: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO
      ? recommendedColorPalette
      : normalizeResolvedColorPalette(selection.colorPalette, recommendedColorPalette),
  };

  return {
    selection,
    resolved,
    recommendedLayoutFamily,
    recommendedColorPalette,
  };
}

/**
 * @param {AiProviderLike} [raw={}]
 * @returns {{ id: string, name: string, kind: string, baseUrl: string, apiKey: string, model: string, enabled: boolean }}
 */
function normalizeAiProvider(raw = {}) {
  const source = toRecord(raw);
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id.trim()
    : `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const kind = typeof source.kind === 'string' && source.kind.trim()
    ? source.kind.trim()
    : AI_PROVIDER_KINDS.OPENAI_COMPATIBLE;
  const defaults = AI_PROVIDER_KIND_DEFAULTS[kind] || AI_PROVIDER_KIND_DEFAULTS[AI_PROVIDER_KINDS.OPENAI_COMPATIBLE];
  return {
    id,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : '未命名 Provider',
    kind,
    baseUrl: typeof source.baseUrl === 'string' && source.baseUrl.trim()
      ? source.baseUrl.trim().replace(/\/+$/, '')
      : defaults.baseUrl,
    apiKey: typeof source.apiKey === 'string' ? source.apiKey : '',
    model: typeof source.model === 'string' && source.model.trim() ? source.model.trim() : defaults.model,
    enabled: source.enabled !== false,
  };
}

/** @param {unknown} baseUrl */
function isAllowedAiProviderBaseUrl(baseUrl) {
  try {
    const parsed = new URL(String(baseUrl || ''));
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol !== 'http:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;

    const private172 = hostname.match(/^172\.(\d+)\./);
    if (private172) {
      const secondOctet = Number(private172[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * @param {AiProviderLike} [provider={}]
 * @returns {string[]}
 */
function getAiProviderIssues(provider = {}) {
  const source = toRecord(provider);
  const issues = [];
  const baseUrl = coerceString(source.baseUrl);
  const apiKey = coerceString(source.apiKey);
  const model = coerceString(source.model);

  if (!baseUrl) {
    issues.push('missing-base-url');
  } else if (!isAllowedAiProviderBaseUrl(baseUrl)) {
    issues.push('invalid-base-url');
  }

  if (!apiKey) issues.push('missing-api-key');
  if (!model) issues.push('missing-model');
  if (source.enabled === false) issues.push('disabled');

  return issues;
}

/**
 * @param {AiProviderLike} [provider={}]
 * @returns {boolean}
 */
function isAiProviderRunnable(provider = {}) {
  const issues = getAiProviderIssues(provider);
  return !issues.some((issue) => issue !== 'disabled');
}

/**
 * @param {AiProviderLike} [provider={}]
 * @returns {string}
 */
function summarizeAiProviderIssues(provider = {}) {
  const issues = getAiProviderIssues(provider);
  if (!issues.length) return '配置完整';

  /** @type {Record<string, string>} */
  const labels = {
    'missing-base-url': '缺少 Base URL',
    'invalid-base-url': 'Base URL 必须是 HTTPS，或指向本机/局域网的 HTTP 地址',
    'missing-api-key': '缺少 API Key',
    'missing-model': '缺少模型名',
    disabled: '已停用',
  };
  return issues.map((issue) => labels[issue] || issue).join(' / ');
}

function getLayoutBlockLabel(block = {}) {
  const source = toRecord(block);
  return coerceString(
    source.title
    || source.caseLabel
    || source.text
    || source.caption
    || source.buttonText
    || source.imageId
    || source.type
  );
}

function getLayoutBlockKey(block = {}) {
  const source = toRecord(block);
  return `${coerceString(source.type)}:${getLayoutBlockLabel(source)}`;
}

/**
 * @param {AiLayoutBlockOriginLike | null | undefined} [raw={}]
 * @param {number} [fallbackIndex=0]
 * @returns {{ index: number, type: string, source: 'ai' | 'fallback', label: string } | null}
 */
function normalizeGenerationBlockOrigin(raw = {}, fallbackIndex = 0) {
  const rawRecord = toRecord(raw);
  if (!Object.keys(rawRecord).length) return null;
  const source = rawRecord.source === 'fallback' ? 'fallback' : 'ai';
  const type = coerceString(rawRecord.type);
  if (!type) return null;
  return {
    index: clampNumber(rawRecord.index, fallbackIndex, 0, 99),
    type,
    source,
    label: coerceString(rawRecord.label || type),
  };
}

/**
 * @param {AiLayoutGenerationMetaLike | null | undefined} [raw={}]
 * @param {Record<string, unknown> | null} [layoutJson=null]
 * @returns {AiLayoutGenerationMetaLike}
 */
function normalizeLayoutGenerationMeta(raw = {}, layoutJson = null) {
  const source = toRecord(raw);
  const layoutJsonRecord = toRecord(layoutJson);
  const blocks = toAiLayoutBlocks(layoutJsonRecord.blocks);
  const rawBlockOrigins = Array.isArray(source.blockOrigins) ? /** @type {unknown[]} */ (source.blockOrigins) : [];
  const blockOrigins = rawBlockOrigins.length
    ? rawBlockOrigins
      .map((item, index) => normalizeGenerationBlockOrigin(item, index))
      .filter(Boolean)
    : [];
  const derivedFallbackCount = blockOrigins.filter((item) => item.source === 'fallback').length;
  const finalBlockCount = clampNumber(
    source.finalBlockCount,
    blocks.length || blockOrigins.length || 0,
    0,
    99
  );
  const fallbackBlockCount = clampNumber(
    source.fallbackBlockCount,
    derivedFallbackCount,
    0,
    finalBlockCount
  );

  return {
    providerName: coerceString(source.providerName),
    providerModel: coerceString(source.providerModel),
    skillId: coerceString(source.skillId),
    skillLabel: coerceString(source.skillLabel),
    skillVersion: coerceString(source.skillVersion),
    executionMode: coerceString(source.executionMode),
    layoutFamilyLabel: coerceString(source.layoutFamilyLabel),
    colorPaletteLabel: coerceString(source.colorPaletteLabel),
    stylePackLabel: coerceString(source.stylePackLabel),
    recommendedLayoutFamilyLabel: coerceString(source.recommendedLayoutFamilyLabel),
    recommendedColorPaletteLabel: coerceString(source.recommendedColorPaletteLabel),
    headingCount: clampNumber(source.headingCount, 0, 0, 999),
    sectionCount: clampNumber(source.sectionCount, 0, 0, 999),
    leadParagraphCount: clampNumber(source.leadParagraphCount, 0, 0, 999),
    bulletGroupCount: clampNumber(source.bulletGroupCount, 0, 0, 999),
    imageCount: clampNumber(source.imageCount, 0, 0, 999),
    aiBlockCount: clampNumber(source.aiBlockCount, Math.max(0, finalBlockCount - fallbackBlockCount), 0, 99),
    finalBlockCount,
    fallbackUsed: source.fallbackUsed === true || fallbackBlockCount > 0,
    fallbackBlockCount,
    fallbackBlockTypes: Array.isArray(source.fallbackBlockTypes)
      ? source.fallbackBlockTypes.map((item) => coerceString(item)).filter(Boolean).slice(0, 6)
      : [],
    schemaValidation: normalizeSchemaValidation(source.schemaValidation),
    blockOrigins,
  };
}

/**
 * @param {AiLayoutSchemaValidationLike | null | undefined} [raw={}]
 * @returns {AiLayoutSchemaValidationLike}
 */
function normalizeSchemaValidation(raw = {}) {
  const source = toRecord(raw);
  const issues = Array.isArray(source.issues)
    ? source.issues
      .map((item) => {
        const issue = toRecord(item);
        return {
          path: coerceString(issue.path),
          message: coerceString(issue.message),
          fatal: issue.fatal === true,
        };
      })
      .filter((item) => item.path || item.message)
      .slice(0, 12)
    : [];
  const issueCount = clampNumber(source.issueCount, issues.length, 0, 99);
  const fatal = source.fatal === true || issues.some((item) => item.fatal);
  return {
    isValid: source.isValid === true && issueCount === 0,
    fatal,
    issueCount,
    issues,
  };
}

class AiLayoutSchemaError extends Error {
  /**
   * @param {string} message
   * @param {unknown} schemaValidation
   * @param {AiLayoutGenerationMetaLike | null} [generationMeta=null]
   */
  constructor(message, schemaValidation, generationMeta = null) {
    super(message);
    this.name = 'AiLayoutSchemaError';
    this.code = 'ai-layout-schema-invalid';
    this.schemaValidation = normalizeSchemaValidation(schemaValidation);
    this.generationMeta = generationMeta;
  }
}

class AiLayoutTimeoutError extends Error {
  constructor(timeoutMs) {
    const seconds = Math.max(1, Math.round(Number(timeoutMs || 0) / 1000));
    super(`AI 请求超时（${seconds}s）`);
    this.name = 'AiLayoutTimeoutError';
    this.code = 'ai-layout-timeout';
    this.timeoutMs = Number(timeoutMs || 0);
  }
}

/**
 * @param {AiLayoutStateLike | null | undefined} [raw={}]
 * @returns {AiLayoutStateLike | null}
 */
function normalizeArticleLayoutState(raw = {}) {
  const source = toRecord(raw);
  if (!Object.keys(source).length) return null;
  const layoutJson = isRecord(source.layoutJson) ? source.layoutJson : null;
  if (!layoutJson) return null;
  const selection = normalizeLayoutSelection(
    source.selection || layoutJson.selection || {
      layoutFamily: source.layoutFamily || layoutJson.layoutFamily || 'tutorial-cards',
      colorPalette: source.colorPalette || source.stylePack || layoutJson.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    },
    {
      layoutFamily: 'tutorial-cards',
      colorPalette: AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    }
  );
  const resolved = normalizeResolvedSelection(
    source.resolved || layoutJson.resolved || {
      layoutFamily: source.resolvedLayoutFamily || source.layoutFamily || layoutJson.layoutFamily || 'tutorial-cards',
      colorPalette: source.resolvedColorPalette || source.colorPalette || source.stylePack || layoutJson.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    },
    {
      layoutFamily: AI_LAYOUT_DEFAULT_FAMILY,
      colorPalette: AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    }
  );
  const dismissedBlockKeys = Array.isArray(source.dismissedBlockKeys)
    ? source.dismissedBlockKeys.map((item) => coerceString(item)).filter(Boolean).slice(0, 128)
    : [];
  return {
    version: clampNumber(source.version, AI_LAYOUT_SCHEMA_VERSION, 1, 999),
    updatedAt: clampNumber(source.updatedAt, Date.now(), 0, 9999999999999),
    sourceHash: typeof source.sourceHash === 'string' ? source.sourceHash : '',
    providerId: typeof source.providerId === 'string' ? source.providerId : '',
    model: typeof source.model === 'string' ? source.model : '',
    skillId: coerceString(source.skillId || source.layoutFamily || resolved.layoutFamily),
    skillVersion: coerceString(source.skillVersion || toRecord(source.generationMeta).skillVersion || getLayoutFamilyById(resolved.layoutFamily)?.version),
    selection,
    resolved,
    recommendedLayoutFamily: normalizeResolvedLayoutFamily(
      source.recommendedLayoutFamily || layoutJson.recommendedLayoutFamily,
      resolved.layoutFamily
    ),
    recommendedColorPalette: normalizeResolvedColorPalette(
      source.recommendedColorPalette || layoutJson.recommendedColorPalette || source.stylePack || layoutJson.stylePack,
      resolved.colorPalette
    ),
    stylePack: resolved.colorPalette,
    layoutFamily: resolved.layoutFamily,
    status: source.status === 'schema-error' ? 'schema-error' : (source.status === 'error' ? 'error' : 'ready'),
    lastError: typeof source.lastError === 'string' ? source.lastError : '',
    lastAttemptStatus: source.lastAttemptStatus === 'schema-error'
      ? 'schema-error'
      : (source.lastAttemptStatus === 'error' ? 'error' : (source.lastAttemptStatus === 'success' ? 'success' : 'idle')),
    lastAttemptError: typeof source.lastAttemptError === 'string' ? source.lastAttemptError : '',
    lastAttemptAt: clampNumber(source.lastAttemptAt, 0, 0, 9999999999999),
    lastAttemptSchemaValidation: normalizeSchemaValidation(source.lastAttemptSchemaValidation),
    dismissedBlockKeys,
    generationMeta: normalizeLayoutGenerationMeta(source.generationMeta, layoutJson),
    layoutJson,
  };
}

/**
 * @param {AiLayoutStateLike | null | undefined} [state={}]
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_FAMILY]
 * @returns {string}
 */
function getArticleLayoutFamilyCacheKey(state = {}, fallback = AI_LAYOUT_DEFAULT_FAMILY) {
  const layoutJson = toRecord(state?.layoutJson);
  const resolved = toRecord(state?.resolved);
  return normalizeResolvedLayoutFamily(
    resolved.layoutFamily
    || state?.layoutFamily
    || toRecord(layoutJson.resolved).layoutFamily
    || layoutJson.layoutFamily
    || fallback,
    AI_LAYOUT_DEFAULT_FAMILY
  );
}

/**
 * @param {AiLayoutStateLike | null} [currentState=null]
 * @param {AiLayoutStateLike | null} [nextState=null]
 * @returns {boolean}
 */
function shouldReplaceArticleLayoutFamilyState(currentState = null, nextState = null) {
  if (!currentState) return true;
  if (!nextState) return false;
  /** @param {AiLayoutStateLike} state */
  const scoreState = (state) => {
    const hasBlocks = Array.isArray(state?.layoutJson?.blocks) && state.layoutJson.blocks.length > 0;
    return [
      state?.status === 'ready' ? 4 : 0,
      hasBlocks ? 2 : 0,
      state?.lastAttemptStatus === 'success' ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
  };
  const currentScore = scoreState(currentState);
  const nextScore = scoreState(nextState);
  if (nextScore !== currentScore) return nextScore > currentScore;
  return Number(nextState.updatedAt || 0) > Number(currentState.updatedAt || 0);
}

/**
 * @param {AiLayoutCacheEntryLike | AiLayoutStateLike | null | undefined} [raw={}]
 * @returns {AiLayoutCacheEntryLike | null}
 */
function normalizeArticleLayoutCacheEntry(raw = {}) {
  if (!isRecord(raw)) return null;

  /** @type {Record<string, AiLayoutStateLike>} */
  const familyStates = {};
  let lastFamilyFromInput = '';

  /**
   * @param {unknown} value
   * @param {AiLayoutSelectionLike} [fallbackSelection={}]
   * @param {{ markLast?: boolean, overwrite?: boolean }} [options={}]
   */
  const ingestState = (value, fallbackSelection = {}, options = {}) => {
    const normalizedState = normalizeArticleLayoutState(value);
    if (!normalizedState) return;
    const effectiveSelection = normalizeLayoutSelection(normalizedState.selection, fallbackSelection);
    const resolvedLayoutFamily = getArticleLayoutFamilyCacheKey(normalizedState, effectiveSelection.layoutFamily);
    const resolved = normalizeResolvedSelection(normalizedState.resolved, {
      layoutFamily: resolvedLayoutFamily,
      colorPalette: normalizedState.stylePack || effectiveSelection.colorPalette,
    });
    const stylePack = normalizeResolvedColorPalette(normalizedState.stylePack || resolved.colorPalette);
    const layoutJson = {
      ...toRecord(normalizedState.layoutJson),
      selection: {
        ...toRecord(toRecord(normalizedState.layoutJson).selection),
        ...effectiveSelection,
      },
      resolved: {
        ...toRecord(toRecord(normalizedState.layoutJson).resolved),
        layoutFamily: resolvedLayoutFamily,
        colorPalette: stylePack,
      },
      layoutFamily: resolvedLayoutFamily,
      stylePack,
    };
    const nextState = {
      ...normalizedState,
      selection: effectiveSelection,
      resolved: {
        ...resolved,
        layoutFamily: resolvedLayoutFamily,
        colorPalette: stylePack,
      },
      stylePack,
      layoutFamily: resolvedLayoutFamily,
      layoutJson,
    };
    if (options.markLast) lastFamilyFromInput = resolvedLayoutFamily;
    if (options.overwrite === false && familyStates[resolvedLayoutFamily]) return;
    if (shouldReplaceArticleLayoutFamilyState(familyStates[resolvedLayoutFamily], nextState)) {
      familyStates[resolvedLayoutFamily] = nextState;
    }
  };

  const legacyState = normalizeArticleLayoutState(raw);
  if (legacyState) {
    ingestState(legacyState, legacyState.selection, { markLast: true });
  }

  if (isRecord(raw.familyStates)) {
    for (const [layoutFamilyId, value] of Object.entries(toRecord(raw.familyStates))) {
      const valueState = normalizeArticleLayoutState(value);
      ingestState(value, {
        layoutFamily: layoutFamilyId || AI_LAYOUT_DEFAULT_FAMILY,
        colorPalette: valueState?.selection?.colorPalette || valueState?.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
      }, { markLast: layoutFamilyId === raw.lastLayoutFamily });
    }
  }

  if (isRecord(raw.selectionStates)) {
    for (const [selectionKey, value] of Object.entries(toRecord(raw.selectionStates))) {
      const [layoutFamilyFromKey, colorPaletteFromKey] = String(selectionKey || '').split('::');
      ingestState(value, {
        layoutFamily: layoutFamilyFromKey || 'tutorial-cards',
        colorPalette: colorPaletteFromKey || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
      }, { markLast: selectionKey === raw.lastSelectionKey });
    }
  }

  if (isRecord(raw.stylePackStates)) {
    for (const [stylePackId, value] of Object.entries(toRecord(raw.stylePackStates))) {
      ingestState(value, {
        layoutFamily: 'tutorial-cards',
        colorPalette: stylePackId || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
      }, { overwrite: false, markLast: stylePackId === raw.lastStylePack });
    }
  }

  const familyKeys = Object.keys(familyStates);
  if (!familyKeys.length) return null;
  const requestedLastLayoutFamily = coerceString(raw.lastLayoutFamily);
  const rawLastLayoutFamily = AI_LAYOUT_IMPLEMENTED_FAMILIES.has(requestedLastLayoutFamily)
    ? requestedLastLayoutFamily
    : '';
  const lastLayoutFamily = familyStates[rawLastLayoutFamily]
    ? rawLastLayoutFamily
    : (familyStates[lastFamilyFromInput] ? lastFamilyFromInput : familyKeys[0]);
  const requestedLastAutoResolvedFamily = coerceString(raw.lastAutoResolvedFamily);
  const rawLastAutoResolvedFamily = AI_LAYOUT_IMPLEMENTED_FAMILIES.has(requestedLastAutoResolvedFamily)
    ? requestedLastAutoResolvedFamily
    : '';
  const lastAutoResolvedFamily = familyStates[rawLastAutoResolvedFamily]
    ? rawLastAutoResolvedFamily
    : (familyStates[lastFamilyFromInput]?.selection?.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? lastFamilyFromInput : '');
  /** @type {Record<string, AiLayoutStateLike>} */
  const selectionStates = {};
  /** @type {Record<string, AiLayoutStateLike>} */
  const stylePackStates = {};
  Object.entries(familyStates).forEach(([layoutFamilyId, state]) => {
    const selectionKey = getArticleLayoutSelectionKey({
      layoutFamily: layoutFamilyId,
      colorPalette: state.selection?.colorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
    selectionStates[selectionKey] = state;
    const stylePack = normalizeResolvedColorPalette(state.stylePack || state.resolved?.colorPalette);
    if (!stylePackStates[stylePack]) stylePackStates[stylePack] = state;
  });
  const lastState = familyStates[lastLayoutFamily] || null;
  const lastSelectionKey = getArticleLayoutSelectionKey({
    layoutFamily: lastLayoutFamily,
    colorPalette: lastState?.selection?.colorPalette || AI_LAYOUT_SELECTION_AUTO,
  });
  return {
    lastLayoutFamily,
    lastAutoResolvedFamily,
    familyStates,
    lastSelectionKey,
    selectionStates,
    lastStylePack: lastState?.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    stylePackStates,
  };
}

function truncateMarkdownForPrompt(markdown = '', maxChars = 12000) {
  const content = String(markdown || '').trim();
  if (!content || content.length <= maxChars) return content;
  const headLength = Math.max(2000, Math.floor(maxChars * 0.72));
  const tailLength = Math.max(800, maxChars - headLength);
  const head = content.slice(0, headLength).trimEnd();
  const tail = content.slice(-tailLength).trimStart();
  return [
    head,
    '',
    '[内容已截断，为了控制请求规模，这里省略了中间部分正文。]',
    '',
    tail,
  ].join('\n');
}

/**
 * @param {{ enabled?: boolean, defaultProviderId?: string, defaultLayoutFamily?: string, defaultColorPalette?: string, defaultStylePack?: string, customColor?: string, includeImagesInLayout?: boolean, requestTimeoutMs?: number, providers?: AiProviderLike[], articleLayoutsByPath?: Record<string, AiLayoutCacheEntryLike | AiLayoutStateLike> }} [raw={}]
 */
/**
 * @param {{ enabled?: boolean, defaultProviderId?: string, defaultLayoutFamily?: string, defaultColorPalette?: string, defaultStylePack?: string, customColor?: string, includeImagesInLayout?: boolean, requestTimeoutMs?: number, providers?: AiProviderLike[], articleLayoutsByPath?: Record<string, AiLayoutCacheEntryLike | AiLayoutStateLike> }} [raw={}]
 * @returns {AiSettingsLike}
 */
function normalizeAiSettings(raw = {}) {
  const source = toRecord(raw);
  const defaults = createDefaultAiSettings();
  const providers = Array.isArray(source.providers) ? source.providers.map(normalizeAiProvider) : defaults.providers;
  /** @type {Record<string, AiLayoutCacheEntryLike>} */
  const articleLayoutsByPath = {};
  if (isRecord(source.articleLayoutsByPath)) {
    for (const [path, value] of Object.entries(source.articleLayoutsByPath)) {
      if (!path || typeof path !== 'string') continue;
      const normalized = normalizeArticleLayoutCacheEntry(value);
      if (normalized) {
        articleLayoutsByPath[path] = normalized;
      }
    }
  }

  let defaultProviderId = typeof source.defaultProviderId === 'string' ? source.defaultProviderId : defaults.defaultProviderId;
  if (defaultProviderId && !providers.some((provider) => provider.id === defaultProviderId && provider.enabled !== false)) {
    defaultProviderId = '';
  }

  return {
    enabled: Object.prototype.hasOwnProperty.call(source, 'enabled')
      ? source.enabled === true
      : defaults.enabled,
    defaultProviderId,
    defaultLayoutFamily: normalizeLayoutFamily(source.defaultLayoutFamily, AI_LAYOUT_SELECTION_AUTO),
    defaultColorPalette: normalizeColorPalette(
      source.defaultColorPalette ?? source.defaultStylePack,
      AI_LAYOUT_SELECTION_AUTO
    ),
    defaultStylePack: normalizeResolvedColorPalette(source.defaultStylePack, AI_LAYOUT_DEFAULT_COLOR_PALETTE),
    customColor: normalizeHexColor(source.customColor, defaults.customColor),
    includeImagesInLayout: source.includeImagesInLayout !== false,
    requestTimeoutMs: clampNumber(source.requestTimeoutMs, defaults.requestTimeoutMs, 5000, 180000),
    providers,
    articleLayoutsByPath,
  };
}

function getStylePackList() {
  return getColorPaletteList({ includeAuto: false });
}

/** @param {unknown} id */
function getStylePackById(id) {
  return getColorPaletteById(id);
}

/**
 * @param {AiLayoutCacheEntryLike | AiLayoutStateLike | null | undefined} entry
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [defaults={}]
 * @returns {AiLayoutStateLike | null}
 */
function getArticleLayoutSelectionState(entry, selection = {}, defaults = {}) {
  const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
  if (!normalizedEntry) return null;
  const normalizedSelection = normalizeLayoutSelection(selection, defaults);
  const requestedLayoutFamily = normalizeLayoutFamily(normalizedSelection.layoutFamily, AI_LAYOUT_SELECTION_AUTO);
  const familyStates = normalizedEntry.familyStates || {};
  const familyKeys = Object.keys(familyStates);
  if (!familyKeys.length) return null;

  if (requestedLayoutFamily !== AI_LAYOUT_SELECTION_AUTO) {
    const requestedResolvedLayoutFamily = normalizeResolvedLayoutFamily(requestedLayoutFamily, AI_LAYOUT_DEFAULT_FAMILY);
    return familyStates[requestedResolvedLayoutFamily] || null;
  }

  if (normalizedEntry.lastAutoResolvedFamily && familyStates[normalizedEntry.lastAutoResolvedFamily]) {
    return familyStates[normalizedEntry.lastAutoResolvedFamily];
  }
  if (normalizedEntry.lastLayoutFamily && familyStates[normalizedEntry.lastLayoutFamily]) {
    return familyStates[normalizedEntry.lastLayoutFamily];
  }
  return familyStates[familyKeys[0]] || null;
}

/**
 * @param {AiLayoutStateLike | null | undefined} state
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [defaults={}]
 * @returns {AiLayoutStateLike | null}
 */
function deriveArticleLayoutStateForSelection(state, selection = {}, defaults = {}) {
  const normalizedState = normalizeArticleLayoutState(state);
  if (!normalizedState?.layoutJson?.blocks?.length) return null;
  if (normalizedState.status !== 'ready') return null;

  const requestedSelection = normalizeLayoutSelection(selection, {
    layoutFamily: normalizedState.selection?.layoutFamily || toSelectionRecord(defaults).layoutFamily || AI_LAYOUT_SELECTION_AUTO,
    colorPalette: normalizedState.selection?.colorPalette || toSelectionRecord(defaults).colorPalette || AI_LAYOUT_SELECTION_AUTO,
  });
  const requestedColorPalette = normalizeColorPalette(
    requestedSelection.colorPalette,
    normalizedState.selection?.colorPalette || toSelectionRecord(defaults).colorPalette || AI_LAYOUT_SELECTION_AUTO
  );
  if (!requestedColorPalette || requestedColorPalette === AI_LAYOUT_SELECTION_AUTO) return null;

  const baseResolvedLayoutFamily = normalizeResolvedLayoutFamily(
    normalizedState.resolved?.layoutFamily || normalizedState.layoutFamily,
    AI_LAYOUT_DEFAULT_FAMILY
  );
  const baseSelectedLayoutFamily = normalizeLayoutFamily(
    normalizedState.selection?.layoutFamily,
    AI_LAYOUT_SELECTION_AUTO
  );
  const requestedLayoutFamily = normalizeLayoutFamily(
    requestedSelection.layoutFamily,
    normalizedState.selection?.layoutFamily || toSelectionRecord(defaults).layoutFamily || AI_LAYOUT_SELECTION_AUTO
  );
  const isCompatibleLayout = (
    requestedLayoutFamily === AI_LAYOUT_SELECTION_AUTO
    || requestedLayoutFamily === baseSelectedLayoutFamily
    || requestedLayoutFamily === baseResolvedLayoutFamily
  );
  if (!isCompatibleLayout) return null;

  const nextResolvedColorPalette = normalizeResolvedColorPalette(
    requestedColorPalette,
    normalizedState.resolved?.colorPalette || AI_LAYOUT_DEFAULT_COLOR_PALETTE
  );
  const nextColorPaletteLabel = getColorPaletteById(nextResolvedColorPalette)?.label || nextResolvedColorPalette;
  const nextSelection = {
    layoutFamily: requestedLayoutFamily || normalizedState.selection?.layoutFamily || AI_LAYOUT_SELECTION_AUTO,
    colorPalette: requestedColorPalette,
  };
  const nextLayoutJson = {
    ...toRecord(normalizedState.layoutJson),
    selection: {
      ...toRecord(toRecord(normalizedState.layoutJson).selection),
      ...nextSelection,
    },
    resolved: {
      ...toRecord(toRecord(normalizedState.layoutJson).resolved),
      layoutFamily: baseResolvedLayoutFamily,
      colorPalette: nextResolvedColorPalette,
    },
    recommendedLayoutFamily: normalizedState.recommendedLayoutFamily,
    recommendedColorPalette: normalizedState.recommendedColorPalette,
    stylePack: nextResolvedColorPalette,
    layoutFamily: baseResolvedLayoutFamily,
  };
  const nextGenerationMeta = normalizeLayoutGenerationMeta({
    ...(normalizedState.generationMeta || {}),
    colorPaletteLabel: nextColorPaletteLabel,
    stylePackLabel: nextColorPaletteLabel,
  }, nextLayoutJson);

  return normalizeArticleLayoutState({
    ...normalizedState,
    selection: nextSelection,
    resolved: {
      layoutFamily: baseResolvedLayoutFamily,
      colorPalette: nextResolvedColorPalette,
    },
    recommendedLayoutFamily: normalizedState.recommendedLayoutFamily,
    recommendedColorPalette: normalizedState.recommendedColorPalette,
    stylePack: nextResolvedColorPalette,
    layoutFamily: baseResolvedLayoutFamily,
    generationMeta: nextGenerationMeta,
    layoutJson: nextLayoutJson,
  });
}

/**
 * @param {AiLayoutCacheEntryLike | AiLayoutStateLike | null | undefined} entry
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [defaults={}]
 * @returns {string}
 */
function getArticleLayoutSelectionStateKey(entry, selection = {}, defaults = {}) {
  const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
  if (!normalizedEntry) return '';
  const normalizedSelection = normalizeLayoutSelection(selection, defaults);
  const requestedLayoutFamily = normalizeLayoutFamily(normalizedSelection.layoutFamily, AI_LAYOUT_SELECTION_AUTO);
  if (requestedLayoutFamily !== AI_LAYOUT_SELECTION_AUTO) {
    const requestedResolvedLayoutFamily = normalizeResolvedLayoutFamily(requestedLayoutFamily, AI_LAYOUT_DEFAULT_FAMILY);
    return normalizedEntry.familyStates?.[requestedResolvedLayoutFamily] ? requestedResolvedLayoutFamily : '';
  }
  return normalizedEntry.lastAutoResolvedFamily || normalizedEntry.lastLayoutFamily || '';
}

/**
 * @param {AiSettingsLike | { providers?: AiProviderLike[] }} [aiSettings={}]
 * @returns {ReturnType<typeof normalizeAiProvider>[]}
 */
function listEnabledAiProviders(aiSettings = {}) {
  return Array.isArray(aiSettings.providers)
    ? aiSettings.providers.map(normalizeAiProvider).filter((provider) => provider.enabled !== false && isAiProviderRunnable(provider))
    : [];
}

/**
 * @param {AiSettingsLike | { providers?: AiProviderLike[], defaultProviderId?: string }} [aiSettings={}]
 * @param {string} [providerId='']
 * @returns {ReturnType<typeof normalizeAiProvider> | null}
 */
function resolveAiProvider(aiSettings = {}, providerId = '') {
  const providers = listEnabledAiProviders(aiSettings);
  if (providerId) {
    const matched = providers.find((provider) => provider.id === providerId);
    if (matched) return matched;
  }
  if (aiSettings.defaultProviderId) {
    const matched = providers.find((provider) => provider.id === aiSettings.defaultProviderId);
    if (matched) return matched;
  }
  return providers[0] || null;
}

function extractJsonPayload(text) {
  const content = String(text || '').trim();
  if (!content) throw new Error('AI 未返回内容');

  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : content;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI 返回结果不是有效 JSON');
  }
  return candidate.slice(firstBrace, lastBrace + 1);
}

function sanitizeJsonStringLiteralControls(payload = '') {
  const raw = String(payload || '');
  if (!raw) return raw;
  let sanitized = '';
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const charCode = raw.charCodeAt(index);

    if (!inString) {
      sanitized += char;
      if (char === '"') inString = true;
      continue;
    }

    if (isEscaped) {
      sanitized += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      sanitized += char;
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      sanitized += char;
      inString = false;
      continue;
    }

    if (charCode <= 0x1F) {
      if (char === '\n') sanitized += '\\n';
      else if (char === '\r') sanitized += '\\r';
      else if (char === '\t') sanitized += '\\t';
      else sanitized += ' ';
      continue;
    }

    sanitized += char;
  }

  return sanitized;
}

/**
 * @param {unknown} rawBlock
 * @returns {string}
 */
function inferBlockType(rawBlock = {}) {
  if (!isRecord(rawBlock)) return '';
  const blockRecord = rawBlock;
  const explicitType = coerceString(
    blockRecord.type
    || blockRecord.blockType
    || blockRecord.block_type
    || blockRecord.kind
    || blockRecord.component
  );
  const allowedTypes = new Set(AI_LAYOUT_ALLOWED_BLOCKS.map((item) => item.type));
  if (allowedTypes.has(explicitType)) return explicitType;

  if ('sectionIndex' in blockRecord || 'paragraphs' in blockRecord || 'bulletGroups' in blockRecord) return 'section-block';
  if (Array.isArray(blockRecord.items)) return 'part-nav';
  if (typeof blockRecord.imageId === 'string') return 'phone-frame';
  if ('coverImageId' in blockRecord || 'eyebrow' in blockRecord || 'subtitle' in blockRecord || explicitType === 'cover') return 'hero';
  if ('buttonText' in blockRecord || 'body' in blockRecord) return 'cta-card';
  if ('text' in blockRecord || 'quote' in blockRecord) return 'lead-quote';
  if ('summary' in blockRecord || 'caseLabel' in blockRecord || 'bullets' in blockRecord || 'highlight' in blockRecord || 'imageIds' in blockRecord) return 'case-block';
  if (typeof blockRecord.title === 'string') return 'section-block';
  return '';
}

function repairRawLayoutPayload(rawLayout = {}) {
  if (!isRecord(rawLayout)) return rawLayout;
  const layoutRecord = rawLayout;
  const blocks = Array.isArray(layoutRecord.blocks) ? layoutRecord.blocks : null;
  if (!blocks) return rawLayout;
  const resolvedRecord = toRecord(layoutRecord.resolved);
  const legacyColorPalette = normalizeResolvedColorPalette(
    layoutRecord.stylePack || layoutRecord.colorPalette || resolvedRecord.colorPalette,
    AI_LAYOUT_DEFAULT_COLOR_PALETTE
  );
  const legacyLayoutFamily = normalizeResolvedLayoutFamily(
    layoutRecord.layoutFamily || resolvedRecord.layoutFamily,
    'tutorial-cards'
  );
  const selection = normalizeLayoutSelection(layoutRecord.selection, {
    layoutFamily: legacyLayoutFamily,
    colorPalette: legacyColorPalette,
  });
  const resolved = normalizeResolvedSelection(resolvedRecord, {
    layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? legacyLayoutFamily : selection.layoutFamily,
    colorPalette: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO ? legacyColorPalette : selection.colorPalette,
  });
  return {
    ...layoutRecord,
    selection,
    resolved,
    recommendedLayoutFamily: normalizeResolvedLayoutFamily(
      layoutRecord.recommendedLayoutFamily || resolvedRecord.layoutFamily || legacyLayoutFamily,
      resolved.layoutFamily
    ),
    recommendedColorPalette: normalizeResolvedColorPalette(
      layoutRecord.recommendedColorPalette || resolvedRecord.colorPalette || legacyColorPalette,
      resolved.colorPalette
    ),
    stylePack: resolved.colorPalette,
    layoutFamily: resolved.layoutFamily,
    blocks: toAiLayoutBlocks(blocks).map((block) => {
      const blockRecord = block;
      const inferredType = inferBlockType(blockRecord);
      if (!inferredType) return blockRecord;
      const repaired = {
        ...blockRecord,
        type: inferredType,
      };
      delete repaired.blockType;
      delete repaired.block_type;
      delete repaired.kind;
      delete repaired.component;
      return repaired;
    }),
  };
}

/**
 * @param {unknown} value
 * @param {string} [fallback='']
 * @returns {string}
 */
function coerceString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeTitleKey(value) {
  return coerceString(value).toLowerCase().replace(/\s+/g, '');
}

/**
 * @param {unknown} value
 * @param {number} [fallback=-1]
 * @returns {number}
 */
function toSectionIndex(value, fallback = -1) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = parseInt(value.trim(), 10);
    return parsed >= 0 ? parsed : fallback;
  }
  return fallback;
}

/**
 * @param {unknown} value
 * @param {number} [limit=6]
 * @returns {string[]}
 */
function toTextArray(value, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceString(item))
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * @param {unknown} value
 * @param {Set<string>} imageIds
 * @param {number} [limit=4]
 * @returns {string[]}
 */
function toImageIdArray(value, imageIds, limit = 4) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceString(item))
    .filter((item) => imageIds.has(item))
    .slice(0, limit);
}

/**
 * @param {AiLayoutSourceSectionLike | null | undefined} section
 * @param {{ imageIds?: string[], fallbackIndex?: number }} [options={}]
 * @returns {AiLayoutBlockLike | null}
 */
function buildSectionBlockFromSource(section, {
  imageIds = [],
  fallbackIndex = 0,
} = {}) {
  if (!section || typeof section !== 'object') return null;
  const sectionRecord = /** @type {AiLayoutSourceSectionLike} */ (section);
  const title = coerceString(sectionRecord.title || sectionRecord.heading || '');
  const paragraphs = Array.isArray(section.paragraphs)
    ? section.paragraphs.map((item) => coerceString(item)).filter(Boolean)
    : [];
  const bulletGroups = Array.isArray(section.bulletGroups)
    ? section.bulletGroups
      .map((group) => Array.isArray(group) ? group.map((item) => coerceString(item)).filter(Boolean).slice(0, 10) : [])
      .filter((group) => group.length)
    : [];
  const callouts = Array.isArray(section.callouts)
    ? section.callouts
      .map((callout) => ({
        type: coerceString(callout?.type),
        title: coerceString(callout?.title),
        body: coerceString(callout?.body),
      }))
      .filter((callout) => callout.title || callout.body || callout.type)
    : [];
  const normalizedImageIds = Array.isArray(imageIds)
    ? imageIds.map((item) => coerceString(item)).filter(Boolean).slice(0, 3)
    : [];
  const subsections = Array.isArray(section.subsections)
    ? section.subsections.map((subsection) => ({
      title: coerceString(subsection?.title || subsection?.heading || ''),
      level: Number.isInteger(subsection?.level) ? subsection.level : 3,
      paragraphs: Array.isArray(subsection?.paragraphs)
        ? subsection.paragraphs.map((item) => coerceString(item)).filter(Boolean)
        : [],
      bulletGroups: Array.isArray(subsection?.bulletGroups)
        ? subsection.bulletGroups
          .map((group) => Array.isArray(group) ? group.map((item) => coerceString(item)).filter(Boolean).slice(0, 10) : [])
          .filter((group) => group.length)
        : [],
      callouts: Array.isArray(subsection?.callouts)
        ? subsection.callouts
          .map((callout) => ({
            type: coerceString(callout?.type),
            title: coerceString(callout?.title),
            body: coerceString(callout?.body),
          }))
          .filter((callout) => callout.title || callout.body || callout.type)
        : [],
    })).filter((subsection) => subsection.title || subsection.paragraphs.length || subsection.bulletGroups.length || subsection.callouts.length)
    : [];
  if (!title && !paragraphs.length && !bulletGroups.length && !callouts.length) return null;
  return {
    type: 'section-block',
    sectionIndex: toSectionIndex(sectionRecord.index, fallbackIndex),
    sectionLabel: (sectionRecord.level || 2) >= 3 ? `SUB ${String(fallbackIndex + 1).padStart(2, '0')}` : `PART ${String(fallbackIndex + 1).padStart(2, '0')}`,
    headingLevel: Number.isInteger(sectionRecord.level) ? sectionRecord.level : 2,
    title,
    paragraphs,
    bulletGroups,
    callouts,
    imageIds: normalizedImageIds,
    subsections,
  };
}

/**
 * @param {AiLayoutBlockLike[]} [blocks=[]]
 * @param {number} [maxSectionBlocks=0]
 * @returns {AiLayoutBlockLike[]}
 */
function mergeSectionBlocksByBudget(blocks = [], maxSectionBlocks = 0) {
  if (!Number.isInteger(maxSectionBlocks) || maxSectionBlocks <= 0) return blocks.slice();
  let sectionCount = 0;
  /** @type {AiLayoutBlockLike[]} */
  const merged = [];

  /** @returns {AiLayoutBlockLike | null} */
  const getLastSectionBlock = () => {
    for (let index = merged.length - 1; index >= 0; index -= 1) {
      if (merged[index]?.type === 'section-block') return merged[index];
    }
    return null;
  };

  blocks.forEach((block) => {
    if (!block || block.type !== 'section-block') {
      merged.push(block);
      return;
    }

    if (sectionCount < maxSectionBlocks) {
      merged.push({
        ...block,
        paragraphs: Array.isArray(block.paragraphs) ? block.paragraphs.slice() : [],
        bulletGroups: Array.isArray(block.bulletGroups) ? block.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length) : [],
        callouts: Array.isArray(block.callouts) ? block.callouts.map((callout) => ({ ...callout })) : [],
        imageIds: Array.isArray(block.imageIds) ? block.imageIds.slice() : [],
        subsections: Array.isArray(block.subsections) ? block.subsections.map((subsection) => ({
          ...subsection,
          paragraphs: Array.isArray(subsection.paragraphs) ? subsection.paragraphs.slice() : [],
          bulletGroups: Array.isArray(subsection.bulletGroups) ? subsection.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length) : [],
          callouts: Array.isArray(subsection.callouts) ? subsection.callouts.map((callout) => ({ ...callout })) : [],
        })) : [],
      });
      sectionCount += 1;
      return;
    }

    const lastSectionBlock = getLastSectionBlock();
    if (!lastSectionBlock) {
      merged.push(block);
      return;
    }

    /** @type {AiLayoutSubsectionLike} */
    const promotedSubsection = {
      title: coerceString(block.title || block.sectionLabel || `Section ${sectionCount + 1}`),
      level: Math.max(3, Number.isInteger(block.headingLevel) ? block.headingLevel : 2),
      paragraphs: Array.isArray(block.paragraphs) ? block.paragraphs.slice() : [],
      bulletGroups: Array.isArray(block.bulletGroups)
        ? block.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length)
        : [],
      callouts: Array.isArray(block.callouts) ? block.callouts.map((callout) => ({ ...callout })) : [],
    };
    /** @type {AiLayoutSubsectionLike[]} */
    const nestedSubsections = Array.isArray(block.subsections)
      ? block.subsections.map((subsection) => ({
        title: coerceString(subsection?.title || ''),
        level: Math.max(3, Number.isInteger(subsection?.level) ? subsection.level : 3),
        paragraphs: Array.isArray(subsection?.paragraphs) ? subsection.paragraphs.slice() : [],
        bulletGroups: Array.isArray(subsection?.bulletGroups)
          ? subsection.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length)
          : [],
        callouts: Array.isArray(subsection?.callouts) ? subsection.callouts.map((callout) => ({ ...callout })) : [],
      })).filter((subsection) => subsection.title || subsection.paragraphs.length || subsection.bulletGroups.length || subsection.callouts.length)
      : [];

    lastSectionBlock.subsections = (Array.isArray(lastSectionBlock.subsections) ? lastSectionBlock.subsections : [])
      .concat([promotedSubsection], nestedSubsections);
    if (Array.isArray(block.imageIds) && block.imageIds.length) {
      lastSectionBlock.imageIds = Array.from(new Set([...(Array.isArray(lastSectionBlock.imageIds) ? lastSectionBlock.imageIds : []), ...block.imageIds])).slice(0, 3);
    }
  });

  return merged;
}

/**
 * @param {AiLayoutSourceSectionLike[]} [sourceSections=[]]
 * @param {unknown} [title='']
 * @returns {AiLayoutSourceSectionLike | null}
 */
function findSourceSectionByTitle(sourceSections = [], title = '') {
  const expectedKey = normalizeTitleKey(title);
  if (!expectedKey) return null;
  return sourceSections.find((section) => normalizeTitleKey(section?.title) === expectedKey) || null;
}

/**
 * @param {AiLayoutBlockLike | Record<string, unknown> | null | undefined} block
 * @param {Set<string>} imageIds
 * @param {AiLayoutSourceSectionLike[]} sourceSections
 * @param {number} index
 * @returns {AiLayoutBlockLike | null}
 */
function normalizeLayoutBlock(block, imageIds, sourceSections, index) {
  if (!block || typeof block !== 'object') return null;
  const type = coerceString(block.type);
  if (!type) return null;

  if (type === 'hero') {
    return {
      type,
      eyebrow: coerceString(block.eyebrow),
      title: coerceString(block.title),
      subtitle: coerceString(block.subtitle),
      coverImageId: imageIds.has(coerceString(block.coverImageId)) ? coerceString(block.coverImageId) : '',
      variant: ['cover-right', 'cover-left'].includes(block.variant) ? block.variant : 'cover-right',
    };
  }

  if (type === 'part-nav') {
    const items = Array.isArray(block.items)
      ? block.items.map((item, itemIndex) => {
        const itemRecord = toRecord(item);
        return {
          label: coerceString(itemRecord.label || `PART ${String(itemIndex + 1).padStart(2, '0')}`),
          text: coerceString(itemRecord.text || itemRecord.title),
        };
      }).filter((item) => item.text).slice(0, MAX_PART_NAV_ITEMS)
      : [];
    return items.length ? { type, items } : null;
  }

  if (type === 'lead-quote') {
    const text = coerceString(block.text || block.quote);
    if (!text) return null;
    return {
      type,
      text,
      note: coerceString(block.note),
    };
  }

  if (type === 'case-block') {
    const title = coerceString(block.title);
    const summary = coerceString(block.summary);
    if (!title && !summary) return null;
    const matchedSection = findSourceSectionByTitle(sourceSections, title);
    if (matchedSection) {
      return buildSectionBlockFromSource(matchedSection, {
        imageIds: toImageIdArray(block.imageIds, imageIds, MAX_CASE_BLOCK_IMAGE_IDS),
        fallbackIndex: toSectionIndex(matchedSection.index, index),
      });
    }
    return {
      type,
      caseLabel: coerceString(block.caseLabel || `CASE ${String(index + 1).padStart(2, '0')}`),
      title,
      summary,
      bullets: toTextArray(block.bullets, MAX_CASE_BLOCK_BULLETS),
      imageIds: toImageIdArray(block.imageIds, imageIds, MAX_CASE_BLOCK_IMAGE_IDS),
      highlight: coerceString(block.highlight),
    };
  }

  if (type === 'section-block') {
    const sectionIndex = toSectionIndex(block.sectionIndex, -1);
    const sourceSection = sectionIndex >= 0 ? sourceSections.find((item) => toSectionIndex(item?.index, -1) === sectionIndex) : null;
    if (!sourceSection) return null;
    return buildSectionBlockFromSource(sourceSection, {
      imageIds: toImageIdArray(block.imageIds, imageIds, 3),
      fallbackIndex: sectionIndex,
    });
  }

  if (type === 'phone-frame') {
    const imageId = coerceString(block.imageId);
    if (!imageIds.has(imageId)) return null;
    return {
      type,
      imageId,
      caption: coerceString(block.caption),
    };
  }

  if (type === 'cta-card') {
    const title = coerceString(block.title);
    const body = coerceString(block.body);
    if (!title && !body) return null;
    return {
      type,
      title,
      body,
      buttonText: coerceString(block.buttonText || '继续阅读'),
      note: coerceString(block.note),
    };
  }

  return null;
}

function summarizeText(value, maxLength = 80) {
  const text = coerceString(value).replace(/\s+/g, ' ');
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function looksLikeScreenshotRef(image = {}) {
  const signature = [
    image.id,
    image.alt,
    image.caption,
    image.src,
  ].map((item) => coerceString(item).toLowerCase()).join(' ');
  if (!signature) return false;
  return /(截图|界面|对话|聊天|微信|面板|后台|screenshot|screen|cleanshot|dialog|chat|ui)/i.test(signature);
}

function stripFrontmatterBlock(markdown = '') {
  const content = String(markdown || '').replace(/^\uFEFF/, '');
  if (!content.startsWith('---')) return content;
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return match ? content.slice(match[0].length) : content;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarkdownCalloutStart(line = '') {
  const quoteLine = String(line || '').trim();
  const match = quoteLine.match(/^>\s*\[!\s*([^\]\r\n]+?)\s*\](?:\s*(.*))?$/u);
  if (!match) return null;
  return {
    type: coerceString(match[1]).toLowerCase(),
    title: stripMarkdown(match[2] || ''),
  };
}

function formatCalloutLabel(type = '') {
  const normalized = coerceString(type).toLowerCase();
  /** @type {Record<string, string>} */
  const labels = {
    note: 'Note',
    info: 'Info',
    tip: 'Tip',
    warning: 'Warning',
    caution: 'Caution',
    danger: 'Danger',
    success: 'Success',
    abstract: 'Abstract',
    summary: 'Summary',
    quote: 'Quote',
    important: 'Important',
    todo: 'Todo',
  };
  if (labels[normalized]) return labels[normalized];
  if (!normalized) return 'Callout';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function serializeClonedNodes(nodes = []) {
  const activeDocument = getActiveDocument();
  if (!activeDocument) return '';
  const container = activeDocument.createElement('div');
  trimTrailingDecorativeNodes(nodes).forEach((node) => {
    if (!node) return;
    container.appendChild(node.cloneNode(true));
  });
  return container.innerHTML.trim();
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
function hasMeaningfulNodeContent(node) {
  const currentNode = /** @type {Node | null} */ (node || null);
  if (!currentNode) return false;
  if (currentNode.nodeType === Node.TEXT_NODE) return /\S/.test(currentNode.textContent || '');
  if (currentNode.nodeType !== Node.ELEMENT_NODE) return false;

  const element = /** @type {HTMLElement} */ (currentNode);
  const tagName = String(element.tagName || '').toUpperCase();
  if (['IMG', 'TABLE', 'PRE', 'UL', 'OL', 'BLOCKQUOTE', 'FIGURE', 'SVG', 'VIDEO', 'AUDIO', 'CANVAS'].includes(tagName)) {
    return true;
  }
  if (element.querySelector('img,table,pre,ul,ol,blockquote,figure,svg,video,audio,canvas')) {
    return true;
  }
  return /\S/.test((element.textContent || '').replace(/\u00a0/g, ''));
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
function isTrailingDecorativeNode(node) {
  const currentNode = /** @type {Node | null} */ (node || null);
  if (!currentNode) return true;
  if (currentNode.nodeType === Node.TEXT_NODE) return !/\S/.test(currentNode.textContent || '');
  if (currentNode.nodeType !== Node.ELEMENT_NODE) return true;

  const tagName = String(/** @type {HTMLElement} */ (currentNode).tagName || '').toUpperCase();
  if (tagName === 'HR') return true;
  if (['P', 'DIV', 'SECTION'].includes(tagName) && !hasMeaningfulNodeContent(node)) {
    return true;
  }
  return false;
}

/**
 * @param {unknown[]} nodes
 * @returns {Node[]}
 */
function trimTrailingDecorativeNodes(nodes = []) {
  /** @type {Node[]} */
  const trimmed = [];
  if (Array.isArray(nodes)) {
    nodes.forEach((node) => {
      if (node instanceof Node) trimmed.push(node);
    });
  }
  while (trimmed.length && isTrailingDecorativeNode(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }
  return trimmed;
}

/**
 * @param {string} html
 * @param {AiColorTokens} tokens
 * @returns {string}
 */
function remapPreservedFragmentColors(html = '', tokens = {}) {
  const source = coerceString(html);
  if (!source) return source;

  const container = createHtmlContainer('div', source);
  if (!container) return source;

  /** @param {Element | null | undefined} element */
  const isInsideCodeChrome = (element) => {
    if (!element || typeof element.closest !== 'function') return false;
    return !!element.closest('.code-snippet__fix, pre, code, svg, mjx-container');
  };

  container.querySelectorAll('strong, b').forEach((element) => {
    if (isInsideCodeChrome(element)) return;
    const htmlElement = /** @type {HTMLElement} */ (element);
    applyElementCssStyles(htmlElement, {
      color: tokens.accentDeep || tokens.accent || '',
      fontWeight: htmlElement.style.fontWeight || '700',
    });
  });

  container.querySelectorAll('span').forEach((element) => {
    if (isInsideCodeChrome(element)) return;
    const inlineStyle = (element.getAttribute('style') || '').toLowerCase();
    if (!/font-weight\s*:\s*(bold|[6-9]00)/.test(inlineStyle)) return;
    applyElementCssStyles(element, { color: tokens.accentDeep || tokens.accent || '' });
  });

  container.querySelectorAll('a').forEach((element) => {
    if (isInsideCodeChrome(element)) return;
    applyElementCssStyles(element, {
      color: tokens.accentDeep || tokens.accent || '',
      textDecoration: 'none',
      borderBottom: `1px dashed ${tokens.accent || tokens.accentDeep || '#000000'}`,
    });
  });

  container.querySelectorAll('section, div, blockquote').forEach((element) => {
    if (isInsideCodeChrome(element)) return;
    const inlineStyle = (element.getAttribute('style') || '').toLowerCase();
    const looksLikeLegacyCallout = /border-left\s*:/.test(inlineStyle)
      && /overflow\s*:\s*hidden/.test(inlineStyle)
      && /background\s*:/.test(inlineStyle);
    if (!looksLikeLegacyCallout) return;

    const htmlElement = /** @type {HTMLElement} */ (element);
    applyElementCssStyles(htmlElement, {
      borderLeftColor: tokens.accent || '',
      borderLeftStyle: htmlElement.style.borderLeftStyle || 'solid',
      borderLeftWidth: htmlElement.style.borderLeftWidth || '3px',
      background: tokens.accentSoft || '',
      backgroundColor: tokens.accentSoft || '',
    });

    const [header, body] = Array.from(element.children || []);
    if (header && !isInsideCodeChrome(header)) {
      applyElementCssStyles(header, {
        background: tokens.quoteBg || tokens.accentSoft || '',
        backgroundColor: tokens.quoteBg || tokens.accentSoft || '',
        color: tokens.text || '',
      });
    }
    if (body && !isInsideCodeChrome(body)) {
      applyElementCssStyles(body, { color: tokens.text || '' });
    }
  });

  return container.innerHTML.trim();
}

/**
 * @param {string} html
 * @returns {{ sections: AiLayoutSourceSectionLike[] }}
 */
function extractRenderedSectionFragments(html = '') {
  if (!html) {
    return { sections: [] };
  }

  const container = createHtmlContainer('div', String(html || ''));
  if (!container) return { sections: [] };
  const root = container.children.length === 1 ? container.firstElementChild : container;
  const childNodes = Array.from(root?.childNodes || []).filter((node) => (
    node.nodeType !== 3 || /\S/.test(node.textContent || '')
  ));
  /** @type {AiLayoutSourceSectionLike[]} */
  const sections = [];
  /** @type {{ title: string, titleKey: string, leadNodes: Node[], subsections: Array<{ title: string, titleKey: string, nodes: Node[] }> } | null} */
  let currentSection = null;
  /** @type {{ title: string, titleKey: string, nodes: Node[] } | null} */
  let currentSubsection = null;

  const finalizeSection = () => {
    if (!currentSection) return;
    sections.push({
      index: sections.length,
      title: currentSection.title,
      titleKey: currentSection.titleKey,
      leadHtml: serializeClonedNodes(currentSection.leadNodes),
      subsections: currentSection.subsections.map((subsection, subsectionIndex) => ({
        index: subsectionIndex,
        title: subsection.title,
        titleKey: subsection.titleKey,
        contentHtml: serializeClonedNodes(subsection.nodes),
      })),
    });
    currentSection = null;
    currentSubsection = null;
  };

  childNodes.forEach((node) => {
    if (node.nodeType === 1) {
      const tagName = String(node.tagName || '').toUpperCase();
      const headingMatch = tagName.match(/^H([2-6])$/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        const title = coerceString(node.textContent).trim();
        if (level === 2 || !currentSection) {
          finalizeSection();
          currentSection = {
            title,
            titleKey: normalizeTitleKey(title),
            leadNodes: [],
            subsections: [],
          };
          currentSubsection = null;
          return;
        }
        if (level >= 3 && currentSection) {
          currentSubsection = {
            title,
            titleKey: normalizeTitleKey(title),
            nodes: [],
          };
          currentSection.subsections.push(currentSubsection);
          return;
        }
      }
    }

    if (!currentSection) return;
    if (currentSubsection) {
      currentSubsection.nodes.push(node);
    } else {
      currentSection.leadNodes.push(node);
    }
  });

  finalizeSection();
  return { sections };
}

/**
 * @param {unknown} markdown
 * @returns {MarkdownStructure}
 */
function extractMarkdownSections(markdown = '') {
  const lines = stripFrontmatterBlock(markdown).split(/\r?\n/);
  /** @type {MarkdownSection[]} */
  const sections = [];
  /** @type {string[]} */
  const introParagraphs = [];
  /** @type {string[][]} */
  const introBulletGroups = [];
  /** @type {MarkdownCallout[]} */
  const introCallouts = [];
  /** @type {MarkdownHeading[]} */
  const headings = [];
  /** @type {MarkdownSection | null} */
  let currentSection = null;
  /** @type {MarkdownSubsection | null} */
  let currentSubsection = null;
  /** @type {string[]} */
  let currentParagraph = [];
  /** @type {string[]} */
  let currentBullets = [];
  /** @type {{ type: string, title: string, lines: string[] } | null} */
  let currentCallout = null;

  const getCurrentTarget = () => currentSubsection || currentSection || null;

  const getCurrentCalloutTarget = () => {
    const target = getCurrentTarget();
    if (target) {
      return target.callouts;
    }
    return introCallouts;
  };

  const pushParagraphToTarget = () => {
    const text = stripMarkdown(currentParagraph.join(' ').trim());
    if (text) {
      const target = getCurrentTarget();
      if (target) {
        target.paragraphs.push(text);
      } else {
        introParagraphs.push(text);
      }
    }
    currentParagraph = [];
  };

  const pushBulletsToTarget = () => {
    if (currentBullets.length) {
      const target = getCurrentTarget();
      if (target) {
        target.bulletGroups.push(currentBullets);
      } else {
        introBulletGroups.push(currentBullets);
      }
    }
    currentBullets = [];
  };

  const pushCalloutToTarget = () => {
    if (!currentCallout) return;
    const body = stripMarkdown(currentCallout.lines.join(' ').trim());
    if (body || currentCallout.title || currentCallout.type) {
      getCurrentCalloutTarget().push({
        type: currentCallout.type,
        title: currentCallout.title,
        body,
      });
    }
    currentCallout = null;
  };

  const finalizeSection = () => {
    pushCalloutToTarget();
    if (currentSection && (currentSection.title || currentSection.paragraphs.length || currentSection.bulletGroups.length || currentSection.callouts?.length)) {
      currentSection.index = sections.length;
      sections.push(currentSection);
    }
    currentSection = null;
    currentSubsection = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pushParagraphToTarget();
      pushBulletsToTarget();
      pushCalloutToTarget();
      continue;
    }

    const calloutStart = parseMarkdownCalloutStart(rawLine);
    if (calloutStart) {
      pushParagraphToTarget();
      pushBulletsToTarget();
      pushCalloutToTarget();
      currentCallout = {
        type: calloutStart.type,
        title: calloutStart.title,
        lines: [],
      };
      continue;
    }

    if (currentCallout) {
      const calloutLineMatch = rawLine.match(/^\s*>\s?(.*)$/);
      if (calloutLineMatch) {
        const calloutText = stripMarkdown(calloutLineMatch[1] || '');
        if (calloutText) currentCallout.lines.push(calloutText);
        continue;
      }
      pushCalloutToTarget();
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pushParagraphToTarget();
      pushBulletsToTarget();
      const level = headingMatch[1].length;
      const title = stripMarkdown(headingMatch[2]);
      headings.push({ level, text: title });
      if (level === 1) {
        currentSubsection = null;
        continue;
      }
      if (level === 2 || !currentSection) {
        finalizeSection();
        currentSection = {
          index: sections.length,
          level: 2,
          title,
          paragraphs: [],
          bulletGroups: [],
          callouts: [],
          subsections: [],
        };
        currentSubsection = null;
        continue;
      }
      currentSubsection = {
        level,
        title,
        paragraphs: [],
        bulletGroups: [],
        callouts: [],
      };
      currentSection.subsections.push(currentSubsection);
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      pushParagraphToTarget();
      currentBullets.push(stripMarkdown(bulletMatch[1]));
      continue;
    }

    currentParagraph.push(line);
  }

  pushParagraphToTarget();
  pushBulletsToTarget();
  pushCalloutToTarget();
  finalizeSection();

  if (!sections.length && (introParagraphs.length || introBulletGroups.length || introCallouts.length)) {
    sections.push({
      index: 0,
      level: 2,
      title: '核心内容',
      paragraphs: introParagraphs.slice(),
      bulletGroups: introBulletGroups.slice(),
      callouts: introCallouts.slice(),
      subsections: [],
    });
  }

  return {
    introParagraphs,
    introBulletGroups,
    introCallouts,
    headings,
    sections,
  };
}

/**
 * @param {unknown} markdown
 * @returns {MarkdownSignals}
 */
function extractMarkdownSignals(markdown = '') {
  const structure = extractMarkdownSections(markdown);
  const headings = Array.isArray(structure.headings)
    ? structure.headings.map((heading) => ({
      level: heading.level || 2,
      text: coerceString(heading.text),
    })).filter((heading) => heading.text)
    : [];
  const bulletGroups = [
    ...structure.introBulletGroups,
    ...structure.sections.flatMap((section) => [
      ...(section.bulletGroups || []),
      ...((section.subsections || []).flatMap((subsection) => subsection.bulletGroups || [])),
    ]),
  ];
  const paragraphs = [
    ...structure.introParagraphs,
    ...structure.sections.flatMap((section) => [
      ...(section.paragraphs || []),
      ...((section.subsections || []).flatMap((subsection) => subsection.paragraphs || [])),
    ]),
  ];
  const leadParagraphs = paragraphs.slice(0, 3);
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const sectionTitles = structure.sections.map((section) => coerceString(section.title)).filter(Boolean).slice(0, 12);
  return {
    headings,
    sectionTitles,
    paragraphs,
    leadParagraphs,
    bulletGroups,
    lastParagraph,
  };
}

/**
 * @param {{ rawLayout?: unknown, signals?: MarkdownSignals | null, imageRefs?: unknown[] }} [options={}]
 * @returns {string}
 */
function recommendLayoutFamily({ rawLayout = {}, signals = null, imageRefs = [] } = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const resolvedRecord = toRecord(rawLayoutRecord.resolved);
  const rawRecommended = coerceString(
    rawLayoutRecord.recommendedLayoutFamily || resolvedRecord.layoutFamily || rawLayoutRecord.layoutFamily
  );
  if (rawRecommended && AI_LAYOUT_FAMILY_DEFS[rawRecommended]) return normalizeResolvedLayoutFamily(rawRecommended);
  const safeSignals = signals || extractMarkdownSignals('');
  const headingCount = safeSignals.headings?.length || 0;
  const sectionCount = safeSignals.sectionTitles?.length || 0;
  const bulletGroupCount = safeSignals.bulletGroups?.length || 0;
  const imageCount = Array.isArray(imageRefs) ? imageRefs.length : 0;
  const hintText = `${coerceString(rawLayoutRecord.title)} ${Array.isArray(safeSignals.sectionTitles) ? safeSignals.sectionTitles.join(' ') : ''}`.toLowerCase();
  if (/(观点|经验|复盘|写作|表达|品牌|故事|思考|方法论|内容创作|心得|感受|editorial|essay|brand)/i.test(hintText)) {
    return 'editorial-lite';
  }
  if (sectionCount >= 2 || headingCount >= 4 || bulletGroupCount >= 2 || imageCount >= 2) {
    return 'tutorial-cards';
  }
  return 'source-first';
}

/**
 * @param {{ rawLayout?: unknown, signals?: MarkdownSignals | null }} [options={}]
 * @returns {string}
 */
function recommendColorPalette({ rawLayout = {}, signals = null } = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const resolvedRecord = toRecord(rawLayoutRecord.resolved);
  const rawRecommended = coerceString(
    rawLayoutRecord.recommendedColorPalette || resolvedRecord.colorPalette || rawLayoutRecord.stylePack
  );
  if (rawRecommended && rawRecommended !== 'custom' && AI_COLOR_PALETTES[rawRecommended]) {
    return normalizeResolvedColorPalette(rawRecommended);
  }
  const safeSignals = signals || extractMarkdownSignals('');
  const headingTitles = Array.isArray(safeSignals.sectionTitles)
    ? safeSignals.sectionTitles.join(' ')
    : '';
  const titleHints = `${coerceString(rawLayoutRecord.title)} ${headingTitles}`.toLowerCase();
  if (/(教程|指南|入门|步骤|实践|实操|配置|接入|使用|标签|双链|知识库|workflow|guide|tutorial|how to)/i.test(titleHints)) {
    return 'ocean-blue';
  }
  if (/(观点|品牌|复盘|内容|经验|编辑|写作|表达)/i.test(titleHints)) {
    return 'graphite-rose';
  }
  if (/(清单|合集|推荐|总结|收藏)/i.test(titleHints)) {
    return 'sunset-amber';
  }
  return 'tech-green';
}

/**
 * @param {{ title?: string, selection?: AiLayoutSelectionLike, stylePack?: string, layoutFamily?: string, colorPalette?: string, sourcePath?: string, markdown?: string, imageRefs?: AiImageRefLike[], provider?: AiProviderLike, signals?: MarkdownSignals }} [context={}]
 * @returns {AiLayoutBlockLike[]}
 */
function buildFallbackLayout(context = {}) {
  const source = toRecord(context);
  const title = coerceString(source.title || '未命名文章');
  const selectionResolution = resolveLayoutSelection({
    requestedSelection: source.selection || { colorPalette: source.stylePack },
    rawLayout: source.rawLayout,
    signals: /** @type {MarkdownSignals | null} */ (source.signals || extractMarkdownSignals(source.markdown || '')),
    imageRefs: Array.isArray(source.imageRefs) ? source.imageRefs : [],
  });
  const resolved = selectionResolution.resolved;
  const skill = getLayoutSkillById(resolved.layoutFamily);
  const fallbackConfig = toRecord(skill?.fallback);
  /** @type {AiImageRefLike[]} */
  const imageRefs = Array.isArray(source.imageRefs) ? source.imageRefs.map((item) => /** @type {AiImageRefLike} */ (toRecord(item))) : [];
  const signals = /** @type {MarkdownSignals} */ (source.signals || extractMarkdownSignals(source.markdown || ''));
  const sourceSections = Array.isArray(source.sourceSections)
    ? /** @type {AiLayoutSourceSectionLike[]} */ (source.sourceSections.map((item) => toRecord(item)))
    : extractMarkdownSections(source.markdown || '').sections;
  const firstImageId = coerceString(imageRefs[0]?.id);
  const leadText = summarizeText(signals.leadParagraphs[0] || signals.paragraphs[0] || '');
  const leadNote = summarizeText(signals.leadParagraphs[1] || '');
  const partItems = signals.sectionTitles.slice(0, MAX_PART_NAV_ITEMS).map((text, index) => ({
    label: `PART ${String(index + 1).padStart(2, '0')}`,
    text,
  }));

  /** @type {AiLayoutBlockLike[]} */
  const headBlocks = [];
  /** @type {AiLayoutBlockLike[]} */
  const bodyBlocks = [];
  if (fallbackConfig.includeHero) {
    headBlocks.push({
      type: 'hero',
      eyebrow: signals.sectionTitles[0] ? (fallbackConfig.heroEyebrow || 'AI Layout Draft') : (fallbackConfig.heroEyebrow || 'AI Article Layout'),
      title,
      subtitle: leadText || summarizeText(signals.lastParagraph || title, 64),
      coverImageId: firstImageId,
      variant: fallbackConfig.heroVariant || 'cover-right',
    });
  }

  if (fallbackConfig.includePartNav && partItems.length >= 2) {
    headBlocks.push({ type: 'part-nav', items: partItems });
  }

  if (fallbackConfig.includeLeadQuote && leadText) {
    headBlocks.push({
      type: 'lead-quote',
      text: leadText,
      note: leadNote,
    });
  }

  const heroCoverImageId = coerceString(headBlocks.find((block) => block?.type === 'hero')?.coverImageId);
  const safeSourceSections = Array.isArray(sourceSections)
    ? sourceSections.map((section) => /** @type {AiLayoutSourceSectionLike} */ (toRecord(section)))
    : [];
  safeSourceSections.forEach((section, index) => {
    const block = buildSectionBlockFromSource(section, {
      imageIds: index === 0 && firstImageId && heroCoverImageId !== firstImageId ? [firstImageId] : [],
      fallbackIndex: index,
    });
    if (block) bodyBlocks.push(block);
  });
  const maxSectionBlocks = Number.isInteger(fallbackConfig.maxSectionBlocks) ? fallbackConfig.maxSectionBlocks : 0;
  const budgetedBodyBlocks = mergeSectionBlocksByBudget(bodyBlocks, maxSectionBlocks);

  const screenshotImage = imageRefs.find((image, index) => index > 0 && looksLikeScreenshotRef(image)) || null;
  if (fallbackConfig.includePhoneFrame && screenshotImage?.id) {
    budgetedBodyBlocks.push({
      type: 'phone-frame',
      imageId: screenshotImage.id,
      caption: screenshotImage.caption || screenshotImage.alt || '示意截图',
    });
  }

  /**
   * @param {AiLayoutBlockLike[]} blocks
   * @returns {Set<string>}
   */
  const collectUsedImageIds = (blocks = []) => {
    /** @type {Set<string>} */
    const used = new Set();
    blocks.forEach((block) => {
      const blockRecord = toRecord(block);
      const coverImageId = coerceString(blockRecord.coverImageId);
      if (coverImageId) used.add(coverImageId);
      const singleImageId = coerceString(blockRecord.imageId);
      if (singleImageId) used.add(singleImageId);
      if (Array.isArray(blockRecord.imageIds)) {
        blockRecord.imageIds.map((item) => coerceString(item)).filter(Boolean).forEach((item) => used.add(item));
      }
    });
    return used;
  };
  /**
   * @param {AiLayoutBlockLike[]} blocks
   * @param {string[]} remainingImageIds
   * @param {string} familyId
   * @returns {AiLayoutBlockLike[]}
   */
  const appendRemainingImages = (blocks = [], remainingImageIds = [], familyId = '') => {
    const queue = remainingImageIds.slice();
    if (!queue.length) return blocks;

    /** @type {number[]} */
    const attachableIndexes = [];
    blocks.forEach((block, index) => {
      const blockType = coerceString(toRecord(block).type);
      if (blockType === 'section-block' || blockType === 'case-block') {
        attachableIndexes.push(index);
      }
    });

    attachableIndexes.forEach((blockIndex) => {
      if (!queue.length) return;
      const block = blocks[blockIndex];
      const blockRecord = toRecord(block);
      const limit = blockRecord.type === 'case-block' ? MAX_CASE_BLOCK_IMAGE_IDS : 3;
      const currentImageIds = Array.isArray(blockRecord.imageIds)
        ? blockRecord.imageIds.map((item) => coerceString(item)).filter(Boolean)
        : [];
      const availableSlots = Math.max(0, limit - currentImageIds.length);
      if (!availableSlots) return;
      blocks[blockIndex] = {
        ...block,
        imageIds: currentImageIds.concat(queue.splice(0, availableSlots)),
      };
    });

    while (queue.length) {
      blocks.push({
        type: 'case-block',
        caseLabel: fallbackConfig.galleryCaseLabel || (familyId === 'editorial-lite' ? 'IMAGES' : 'GALLERY'),
        title: fallbackConfig.galleryTitle || (familyId === 'editorial-lite' ? '图像摘录' : '配图补充'),
        summary: '',
        bullets: [],
        imageIds: queue.splice(0, MAX_CASE_BLOCK_IMAGE_IDS),
        highlight: '',
      });
    }

    return blocks;
  };
  const usedImageIds = collectUsedImageIds([...headBlocks, ...budgetedBodyBlocks]);
  const remainingImageIds = imageRefs
    .map((image) => coerceString(image?.id))
    .filter(Boolean)
    .filter((imageId) => !usedImageIds.has(imageId));
  appendRemainingImages(budgetedBodyBlocks, remainingImageIds, resolved.layoutFamily);

  return {
    version: AI_LAYOUT_SCHEMA_VERSION,
    articleType: signals.sectionTitles.length >= 2 ? 'tutorial' : 'article',
    selection: selectionResolution.selection,
    resolved,
    recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
    recommendedColorPalette: selectionResolution.recommendedColorPalette,
    stylePack: resolved.colorPalette,
    layoutFamily: resolved.layoutFamily,
    title,
    summary: summarizeText(leadText || signals.lastParagraph || title, 90),
    blocks: [...headBlocks, ...budgetedBodyBlocks].filter(Boolean).slice(0, MAX_LAYOUT_BLOCKS),
  };
}

/**
 * @param {AiLayoutBlockLike[]} aiBlocks
 * @param {AiLayoutBlockLike[]} fallbackBlocks
 * @returns {AiLayoutBlockLike[]}
 */
function mergeBlocksWithFallback(aiBlocks = [], fallbackBlocks = []) {
  return mergeBlocksWithFallbackDetailed(aiBlocks, fallbackBlocks).map((entry) => entry.block);
}

/**
 * @param {AiLayoutBlockLike[]} aiBlocks
 * @param {AiLayoutBlockLike[]} fallbackBlocks
 * @returns {Array<{ block: AiLayoutBlockLike, source: 'ai' | 'fallback' }>}
 */
function mergeBlocksWithFallbackDetailed(aiBlocks = [], fallbackBlocks = []) {
  const introOrder = ['hero', 'part-nav', 'lead-quote'];
  /** @type {Map<string, AiLayoutBlockLike>} */
  const introAiByType = new Map();
  /** @type {Map<string, AiLayoutBlockLike>} */
  const introFallbackByType = new Map();
  /** @type {Map<number, AiLayoutBlockLike>} */
  const fallbackSectionsByIndex = new Map();
  /** @type {Array<{ block: AiLayoutBlockLike, source: 'ai' }>} */
  const deferredAi = [];
  /** @type {Array<{ block: AiLayoutBlockLike, source: 'ai' | 'fallback' }>} */
  const deferredFallback = [];
  /** @type {Set<string>} */
  const seenKeys = new Set();
  /** @type {Array<{ block: AiLayoutBlockLike, source: 'ai' | 'fallback' }>} */
  const merged = [];

  /**
   * @param {AiLayoutBlockLike | null | undefined} block
   * @param {'ai' | 'fallback'} source
   */
  const addBlock = (block, source) => {
    const blockRecord = toRecord(block);
    if (!block || !coerceString(blockRecord.type)) return;
    const dedupeKey = getLayoutBlockKey(block);
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    merged.push({ block, source });
  };

  /** @type {number[]} */
  const fallbackSectionIndices = [];
  fallbackBlocks.forEach((block) => {
    const blockRecord = toRecord(block);
    const blockType = coerceString(blockRecord.type);
    if (!block || !blockType) return;
    if (introOrder.includes(blockType)) {
      if (!introFallbackByType.has(blockType)) {
        introFallbackByType.set(blockType, block);
      }
      return;
    }
    if (blockType === 'section-block' && Number.isInteger(blockRecord.sectionIndex) && blockRecord.sectionIndex >= 0) {
      const sectionIndex = Number(blockRecord.sectionIndex);
      if (!fallbackSectionsByIndex.has(sectionIndex)) {
        fallbackSectionsByIndex.set(sectionIndex, block);
        fallbackSectionIndices.push(sectionIndex);
      }
      return;
    }
    deferredFallback.push({ block, source: 'fallback' });
  });

  aiBlocks.forEach((block) => {
    const blockType = coerceString(toRecord(block).type);
    if (!block || !blockType) return;
    if (introOrder.includes(blockType)) {
      if (!introAiByType.has(blockType)) {
        introAiByType.set(blockType, block);
      }
      return;
    }
    deferredAi.push({ block, source: 'ai' });
  });

  introOrder.forEach((type) => {
    const aiBlock = introAiByType.get(type);
    const fallbackBlock = introFallbackByType.get(type);
    if (aiBlock) {
      addBlock(aiBlock, 'ai');
    } else if (fallbackBlock) {
      addBlock(fallbackBlock, 'fallback');
    }
  });

  const sortedFallbackIndices = Array.from(new Set(fallbackSectionIndices)).sort((a, b) => a - b);
  let fallbackPointer = 0;
  /** @param {number} targetIndex */
  const flushFallbackSectionsBefore = (targetIndex) => {
    while (fallbackPointer < sortedFallbackIndices.length && sortedFallbackIndices[fallbackPointer] < targetIndex) {
      const sectionIndex = sortedFallbackIndices[fallbackPointer];
      addBlock(fallbackSectionsByIndex.get(sectionIndex), 'fallback');
      fallbackPointer += 1;
    }
  };
  /** @param {number} sectionIndex */
  const consumeFallbackSection = (sectionIndex) => {
    while (fallbackPointer < sortedFallbackIndices.length && sortedFallbackIndices[fallbackPointer] <= sectionIndex) {
      fallbackPointer += 1;
    }
  };

  deferredAi.forEach((entry) => {
    const block = entry.block;
    const blockRecord = toRecord(block);
    if (blockRecord.type === 'section-block' && Number.isInteger(blockRecord.sectionIndex) && blockRecord.sectionIndex >= 0) {
      const sectionIndex = Number(blockRecord.sectionIndex);
      flushFallbackSectionsBefore(sectionIndex);
      addBlock(block, 'ai');
      consumeFallbackSection(sectionIndex);
      return;
    }
    if (blockRecord.type === 'hero' || blockRecord.type === 'part-nav' || blockRecord.type === 'lead-quote') {
      return;
    }
    deferredFallback.push(entry);
  });

  flushFallbackSectionsBefore(Number.POSITIVE_INFINITY);
  deferredFallback.forEach((entry) => addBlock(entry.block, entry.source));

  return merged.slice(0, MAX_LAYOUT_BLOCKS);
}

function normalizeArticleLayout(rawLayout = {}, context = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const contextRecord = toRecord(context);
  const imageRefs = toAiImageRefs(contextRecord.imageRefs);
  const imageIds = new Set(imageRefs.map((image) => coerceString(image.id)).filter(Boolean));
  const selectionResolution = resolveLayoutSelection({
    requestedSelection: contextRecord.selection || { colorPalette: contextRecord.stylePack },
    rawLayout: rawLayoutRecord,
    signals: /** @type {MarkdownSignals | null} */ (contextRecord.signals || extractMarkdownSignals(contextRecord.markdown || '')),
    imageRefs,
  });
  const sourceSections = Array.isArray(contextRecord.sourceSections)
    ? /** @type {AiLayoutSourceSectionLike[]} */ (contextRecord.sourceSections.map((section) => toRecord(section)))
    : extractMarkdownSections(contextRecord.markdown || '').sections;
  const rawBlocks = toAiLayoutBlocks(rawLayoutRecord.blocks);
  const normalizedAiBlocks = rawBlocks.length
    ? rawBlocks
      .map((block, index) => normalizeLayoutBlock(block, imageIds, sourceSections, index))
      .filter(Boolean)
    : [];
  const fallbackLayout = buildFallbackLayout({
    title: rawLayoutRecord.title || contextRecord.title,
    markdown: contextRecord.markdown,
    selection: selectionResolution.selection,
    rawLayout: rawLayoutRecord,
    imageRefs,
    signals: contextRecord.signals,
    sourceSections,
  });
  const blocks = mergeBlocksWithFallback(
    /** @type {AiLayoutBlockLike[]} */ (normalizedAiBlocks.filter(Boolean)),
    toAiLayoutBlocks(fallbackLayout.blocks)
  );

  return {
    version: AI_LAYOUT_SCHEMA_VERSION,
    articleType: coerceString(rawLayoutRecord.articleType || fallbackLayout.articleType || 'article'),
    selection: selectionResolution.selection,
    resolved: selectionResolution.resolved,
    recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
    recommendedColorPalette: selectionResolution.recommendedColorPalette,
    stylePack: selectionResolution.resolved.colorPalette,
    layoutFamily: selectionResolution.resolved.layoutFamily,
    title: coerceString(rawLayoutRecord.title || contextRecord.title || fallbackLayout.title),
    summary: coerceString(rawLayoutRecord.summary || fallbackLayout.summary),
    blocks,
  };
}

/**
 * @param {{ provider?: AiProviderLike, layoutFamily?: string, colorPalette?: string, recommendedLayoutFamily?: string, recommendedColorPalette?: string, mergedEntries?: Array<{ source?: 'ai' | 'fallback', block?: AiLayoutBlockLike }>, signals?: MarkdownSignals, imageRefs?: AiImageRefLike[], schemaValidation?: AiLayoutSchemaValidationLike }} [options={}]
 * @returns {AiLayoutGenerationMetaLike}
 */
function createLayoutGenerationMeta({
  provider,
  layoutFamily,
  colorPalette,
  recommendedLayoutFamily,
  recommendedColorPalette,
  signals,
  imageRefs = [],
  normalizedAiBlocks = [],
  mergedEntries = [],
  schemaValidation = null,
}) {
  const safeSignals = signals || extractMarkdownSignals('');
  const safeImageRefs = toAiImageRefs(imageRefs);
  const safeNormalizedAiBlocks = toAiLayoutBlocks(normalizedAiBlocks);
  /** @type {Array<{ source?: 'ai' | 'fallback', block?: AiLayoutBlockLike }>} */
  const safeMergedEntries = Array.isArray(mergedEntries)
    ? mergedEntries.map((entry) => {
      const entryRecord = toRecord(entry);
      return {
        source: entryRecord.source === 'fallback' ? 'fallback' : 'ai',
        block: /** @type {AiLayoutBlockLike} */ (toRecord(entryRecord.block)),
      };
    })
    : [];
  const layoutFamilyInfo = getLayoutFamilyById(layoutFamily);
  const colorPaletteInfo = getColorPaletteById(colorPalette);
  const fallbackEntries = safeMergedEntries.filter((entry) => entry.source === 'fallback');
  const executionMode = fallbackEntries.length > 0 && safeNormalizedAiBlocks.length === 0
    ? 'local-fallback'
    : 'ai-enhanced';
  return {
    providerName: coerceString(provider?.name),
    providerModel: coerceString(provider?.model),
    skillId: layoutFamilyInfo?.id || coerceString(layoutFamily),
    skillLabel: layoutFamilyInfo?.label || '',
    skillVersion: layoutFamilyInfo?.version || '',
    executionMode,
    layoutFamilyLabel: layoutFamilyInfo?.label || '',
    colorPaletteLabel: colorPaletteInfo?.label || '',
    stylePackLabel: colorPaletteInfo?.label || '',
    recommendedLayoutFamilyLabel: getLayoutFamilyById(recommendedLayoutFamily)?.label || '',
    recommendedColorPaletteLabel: getColorPaletteById(recommendedColorPalette)?.label || '',
    headingCount: safeSignals.headings.length,
    sectionCount: safeSignals.sectionTitles.length,
    leadParagraphCount: safeSignals.leadParagraphs.length,
    bulletGroupCount: safeSignals.bulletGroups.length,
    imageCount: safeImageRefs.length,
    aiBlockCount: safeNormalizedAiBlocks.length,
    finalBlockCount: safeMergedEntries.length,
    fallbackUsed: fallbackEntries.length > 0,
    fallbackBlockCount: fallbackEntries.length,
    fallbackBlockTypes: Array.from(new Set(fallbackEntries.map((entry) => entry.block?.type).filter(Boolean))).slice(0, 6),
    schemaValidation: normalizeSchemaValidation(schemaValidation),
    blockOrigins: safeMergedEntries.map((entry, index) => ({
      index,
      type: coerceString(entry.block?.type),
      source: entry.source === 'fallback' ? 'fallback' : 'ai',
      label: getLayoutBlockLabel(entry.block),
    })),
  };
}

/**
 * @param {AiLayoutJsonLike | Record<string, unknown>} [rawLayout={}]
 * @param {{ markdown?: string, selection?: AiLayoutSelectionLike, stylePack?: string, imageRefs?: AiImageRefLike[], signals?: MarkdownSignals, provider?: AiProviderLike }} [context={}]
 * @returns {AiLayoutStateLike}
 */
function buildLayoutResult(rawLayout = {}, context = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const contextRecord = toRecord(context);
  const validation = validateAiLayoutPayload(rawLayout);
  const signals = /** @type {MarkdownSignals} */ (contextRecord.signals || extractMarkdownSignals(contextRecord.markdown || ''));
  const imageRefs = toAiImageRefs(contextRecord.imageRefs);
  const selectionResolution = resolveLayoutSelection({
    requestedSelection: contextRecord.selection || { colorPalette: contextRecord.stylePack },
    rawLayout: rawLayoutRecord,
    signals,
    imageRefs,
  });
  if (validation.fatal) {
    const generationMeta = createLayoutGenerationMeta({
      provider: /** @type {AiProviderLike} */ (toRecord(contextRecord.provider)),
      layoutFamily: selectionResolution.resolved.layoutFamily,
      colorPalette: selectionResolution.resolved.colorPalette,
      recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
      recommendedColorPalette: selectionResolution.recommendedColorPalette,
      signals,
      imageRefs,
      normalizedAiBlocks: [],
      mergedEntries: [],
      schemaValidation: validation,
    });
    throw new AiLayoutSchemaError(`AI 返回的布局结果未通过 schema 校验（${validation.issueCount} 项）`, validation, generationMeta);
  }

  const imageIds = new Set(imageRefs.map((image) => coerceString(image.id)).filter(Boolean));
  const sourceSections = Array.isArray(contextRecord.sourceSections)
    ? /** @type {AiLayoutSourceSectionLike[]} */ (contextRecord.sourceSections.map((section) => toRecord(section)))
    : extractMarkdownSections(contextRecord.markdown || '').sections;
  const rawBlocks = toAiLayoutBlocks(rawLayoutRecord.blocks);
  const normalizedAiBlocks = rawBlocks.length
    ? rawBlocks
      .map((block, index) => normalizeLayoutBlock(block, imageIds, sourceSections, index))
      .filter(Boolean)
    : [];
  const fallbackLayout = buildFallbackLayout({
    title: rawLayoutRecord.title || contextRecord.title,
    markdown: contextRecord.markdown,
    selection: selectionResolution.selection,
    rawLayout: rawLayoutRecord,
    imageRefs,
    signals,
    sourceSections,
  });
  const mergedEntries = mergeBlocksWithFallbackDetailed(
    /** @type {AiLayoutBlockLike[]} */ (normalizedAiBlocks.filter(Boolean)),
    toAiLayoutBlocks(fallbackLayout.blocks)
  );
  const layoutJson = {
    version: AI_LAYOUT_SCHEMA_VERSION,
    articleType: coerceString(rawLayoutRecord.articleType || fallbackLayout.articleType || 'article'),
    selection: selectionResolution.selection,
    resolved: selectionResolution.resolved,
    recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
    recommendedColorPalette: selectionResolution.recommendedColorPalette,
    stylePack: selectionResolution.resolved.colorPalette,
    layoutFamily: selectionResolution.resolved.layoutFamily,
    title: coerceString(rawLayoutRecord.title || contextRecord.title || fallbackLayout.title),
    summary: coerceString(rawLayoutRecord.summary || fallbackLayout.summary),
    blocks: mergedEntries.map((entry) => entry.block),
  };

  return {
    layoutJson,
    generationMeta: createLayoutGenerationMeta({
      provider: /** @type {AiProviderLike} */ (toRecord(contextRecord.provider)),
      layoutFamily: layoutJson.resolved.layoutFamily,
      colorPalette: layoutJson.resolved.colorPalette,
      recommendedLayoutFamily: layoutJson.recommendedLayoutFamily,
      recommendedColorPalette: layoutJson.recommendedColorPalette,
      signals,
      imageRefs,
      normalizedAiBlocks,
      mergedEntries,
      schemaValidation: validation,
    }),
  };
}

/**
 * @param {unknown} html
 * @returns {AiImageRefLike[]}
 */
function extractImageRefsFromHtml(html) {
  const source = coerceString(html);
  if (!source) return [];
  const container = createHtmlContainer('div', source);
  if (!container) return [];
  const figures = Array.from(container.querySelectorAll('figure'));
  /** @type {AiImageRefLike[]} */
  const refs = [];

  figures.forEach((figure, index) => {
    const img = figure.querySelector('img');
    if (!img || !img.src || img.alt === 'logo') return;
    const caption = figure.querySelector('figcaption')?.textContent?.trim() || img.alt || `配图 ${index + 1}`;
    refs.push({
      id: `image-${index + 1}`,
      src: img.src,
      alt: img.alt || caption,
      caption,
    });
  });

  return refs;
}

/**
 * @param {{ title?: unknown, markdown?: unknown, selection?: AiLayoutSelectionLike, stylePack?: string, imageRefs?: AiImageRefLike[] }} params
 * @returns {Array<{ role: string, content: string }>}
 */
function buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs = [] }) {
  const safeImageRefs = toAiImageRefs(imageRefs);
  const resolvedSelection = resolveLayoutSelection({
    requestedSelection: selection || { colorPalette: stylePack },
    rawLayout: { title },
    signals: extractMarkdownSignals(markdown),
    imageRefs: safeImageRefs,
  });
  const selectedLayoutFamily = selection?.layoutFamily || AI_LAYOUT_SELECTION_AUTO;
  const selectedColorPalette = selection?.colorPalette || AI_LAYOUT_SELECTION_AUTO;
  const selectedLayoutFamilyInfo = selectedLayoutFamily === AI_LAYOUT_SELECTION_AUTO
    ? { label: '自动推荐', description: '由 AI 根据文章内容推荐布局风格。' }
    : getLayoutFamilyById(selectedLayoutFamily);
  const selectedColorPaletteInfo = selectedColorPalette === AI_LAYOUT_SELECTION_AUTO
    ? { label: '自动推荐', description: '由 AI 根据文章内容推荐颜色。' }
    : getColorPaletteById(selectedColorPalette);
  const selectedSkill = selectedLayoutFamily === AI_LAYOUT_SELECTION_AUTO
    ? null
    : getLayoutSkillById(selectedLayoutFamily);
  const recommendedSkill = getLayoutSkillById(resolvedSelection.recommendedLayoutFamily);
  const signals = extractMarkdownSignals(markdown);
  const promptMarkdown = truncateMarkdownForPrompt(markdown);
  const imageSummary = safeImageRefs.length
    ? safeImageRefs.map((image) => {
      const imageRecord = toRecord(image);
      return `- ${coerceString(imageRecord.id)}: ${coerceString(imageRecord.caption || imageRecord.alt)}`;
    }).join('\n')
    : '- 无可用图片';
  const sectionSummary = signals.sectionTitles.length
    ? signals.sectionTitles.map((item, index) => `- ${index}: ${item}`).join('\n')
    : '- 无明显章节结构';
  const headingSummary = signals.sectionTitles.length
    ? signals.sectionTitles.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '- 无明显标题结构';
  const leadSummary = signals.leadParagraphs.length
    ? signals.leadParagraphs.map((item, index) => `${index + 1}. ${summarizeText(item, 90)}`).join('\n')
    : '- 无可提取导语';
  const bulletSummary = signals.bulletGroups.length
    ? signals.bulletGroups.slice(0, 2).map((group, groupIndex) => `组 ${groupIndex + 1}: ${group.slice(0, 4).join(' / ')}`).join('\n')
    : '- 无明显列表信息';
  const skillSummary = AI_LAYOUT_SKILL_LIST.map((skill) => {
    const manifest = /** @type {AiLayoutSkillManifest} */ (skill.manifest || {});
    return `- ${manifest.id}: ${manifest.label}（${manifest.description || '无描述'}）`;
  }).join('\n');
  const safeStyleNotes = Array.isArray(AI_WECHAT_SAFE_STYLE_PRIMITIVES.allowedCssNotes)
    ? AI_WECHAT_SAFE_STYLE_PRIMITIVES.allowedCssNotes.map((item) => `- ${coerceString(item)}`).join('\n')
    : '- 仅允许 inline style';
  const selectedSkillPrompt = selectedSkill?.prompt
    ? selectedSkill.prompt
    : '当前 layoutFamily 为 auto，请在内置 skill 中做选择，并给出最合适的 recommendedLayoutFamily。';
  const recommendedSkillPrompt = recommendedSkill?.prompt
    ? recommendedSkill.prompt
    : '';

  return [
    {
      role: 'system',
      content: AI_LAYOUT_SKILL_SYSTEM_LINES.join('\n'),
    },
    {
      role: 'user',
      content: [
        `文章标题：${title || '未命名文章'}`,
        `布局选择：${selectedLayoutFamilyInfo.label}`,
        `布局说明：${selectedLayoutFamilyInfo.description}`,
        `颜色选择：${selectedColorPaletteInfo.label}`,
        `颜色说明：${selectedColorPaletteInfo.description}`,
        `推荐布局：${getLayoutFamilyById(resolvedSelection.recommendedLayoutFamily).label}`,
        `推荐颜色：${getColorPaletteById(resolvedSelection.recommendedColorPalette).label}`,
        '',
        '内置布局 skills：',
        skillSummary,
        '',
        selectedSkill ? `当前 skill：${selectedSkill.manifest.label}（${selectedSkill.manifest.version}）` : '当前 skill：自动推荐',
        '当前 skill 目标：',
        selectedSkillPrompt,
        recommendedSkillPrompt ? ['', '当前推荐 skill 参考：', recommendedSkillPrompt, ''] .join('\n') : '',
        '微信安全样式约束：',
        safeStyleNotes,
        '',
        '可用图片：',
        imageSummary,
        '',
        '可用正文 section：',
        sectionSummary,
        '',
        '文章结构摘要：',
        '标题大纲：',
        headingSummary,
        '导语候选：',
        leadSummary,
        '列表信息：',
        bulletSummary,
        '',
        '请输出一个 JSON 对象，包含：',
        ...AI_LAYOUT_OUTPUT_FIELDS.map((field) => `- ${field}`),
        '',
        'selection 规则：',
        `- layoutFamily 只能是 ${AI_LAYOUT_SELECTION_AUTO} / ${AI_LAYOUT_FAMILIES.join(' / ')}`,
        `- colorPalette 只能是 ${AI_LAYOUT_SELECTION_AUTO} / ${AI_LAYOUT_COLOR_PALETTES.join(' / ')}`,
        '- 当 selection.colorPalette = auto 时，请只从内置非 custom 颜色中推荐；custom 只在用户明确选择自定义时使用。',
        `- 当前 selection.layoutFamily = ${selectedLayoutFamily}`,
        `- 当前 selection.colorPalette = ${selectedColorPalette}`,
        '如果 selection 为 auto，请你给出 recommended* 并写入 resolved；如果不是 auto，请尊重用户选择。',
        '',
        'block 约束：',
        ...getAiLayoutBlockConstraintLines(),
        '',
        '正文主体请优先使用 section-block，并通过 sectionIndex 引用原文章节。',
        'sectionIndex 从 0 开始，对应上面“可用正文 section”的编号。',
        '默认只把 H2 级标题当作 major section；H3/H4 更适合留在对应 section-block 内部，作为 subsection 或段内层级。',
        '优先覆盖全文主要章节，不要只处理前半篇，也不要遗漏后半部分内容。',
        '不要机械地把每个小标题都升级成独立 block；结构清晰比 block 数量更多更重要。',
        'CTA 和 phone-frame 都是可选块，不要默认强加。',
        '',
        '原文如下：',
        promptMarkdown,
      ].filter(Boolean).join('\n'),
    },
  ];
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function readChatCompletionContent(data) {
  const source = toRecord(data);
  const choices = Array.isArray(source.choices) ? source.choices : [];
  const firstChoice = toRecord(choices[0]);
  const message = toRecord(firstChoice.message);
  if (!message) throw new Error('AI 响应缺少 message');
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        const part = toRecord(item);
        return typeof part.text === 'string' ? part.text : '';
      })
      .join('')
      .trim();
  }
  throw new Error('AI 响应格式无法识别');
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function readGeminiContent(data) {
  const source = toRecord(data);
  const candidates = Array.isArray(source.candidates) ? source.candidates : [];
  const candidate = toRecord(candidates[0]);
  const content = toRecord(candidate.content);
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .map((item) => {
      const part = toRecord(item);
      return typeof part.text === 'string' ? part.text : '';
    })
    .join('')
    .trim();
  if (text) return text;
  throw new Error('Gemini 响应缺少可解析文本');
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function readAnthropicContent(data) {
  const source = toRecord(data);
  if (source.stop_reason === 'max_tokens') {
    throw new Error('Anthropic 响应达到 max_tokens 输出上限，排版 JSON 可能被截断。请缩短文章或减少图片后重试。');
  }
  const content = Array.isArray(source.content) ? source.content : [];
  const text = content
    .map((item) => {
      const part = toRecord(item);
      return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .join('')
    .trim();
  if (text) return text;
  throw new Error('Anthropic 响应缺少可解析文本');
}

/**
 * @param {Array<{ role?: string, content?: string }>} messages
 * @returns {string}
 */
function toPlainPromptFromMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => {
      const record = toRecord(message);
      const roleLabel = record.role === 'system' ? '系统要求' : '用户请求';
      return `${roleLabel}：\n${String(record.content || '').trim()}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * @param {unknown} error
 * @param {unknown} selection
 */
function shouldUseLocalFallbackLayout(error, selection = {}) {
  const selectionRecord = toSelectionRecord(selection);
  const requestedLayoutFamily = normalizeLayoutFamily(selectionRecord.layoutFamily, AI_LAYOUT_SELECTION_AUTO);
  return requestedLayoutFamily === 'source-first' && !!error;
}

/** @param {unknown} error */
function isAbortError(error) {
  return toRecord(error).name === 'AbortError';
}

/**
 * @param {string} jsonPayload
 * @returns {Record<string, unknown>}
 */
function parseAndRepairLayoutPayload(jsonPayload) {
  const parsedPayload = /** @type {unknown} */ (JSON.parse(jsonPayload));
  return /** @type {Record<string, unknown>} */ (repairRawLayoutPayload(parsedPayload));
}

/**
 * @param {AiLayoutRequestOptions} options
 * @returns {Promise<Record<string, unknown>>}
 */
async function requestOpenAICompatibleLayout({
  provider,
  title,
  markdown,
  selection,
  stylePack,
  imageRefs,
  timeoutMs,
  abortTimeoutMs,
  fetchImpl,
}) {
  const controller = new AbortController();
  const timer = setAiLayoutTimeout(() => controller.abort(), abortTimeoutMs || timeoutMs);

  try {
    const response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages: buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
    }

    const data = await response.json();
    const content = readChatCompletionContent(data);
    const jsonPayload = extractJsonPayload(content);
    try {
      return parseAndRepairLayoutPayload(jsonPayload);
    } catch (error) {
      const sanitizedPayload = sanitizeJsonStringLiteralControls(jsonPayload);
      if (sanitizedPayload !== jsonPayload) {
        return parseAndRepairLayoutPayload(sanitizedPayload);
      }
      throw error;
    }
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AiLayoutTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearAiLayoutTimeout(timer);
  }
}

/**
 * @param {AiLayoutRequestOptions} options
 * @returns {Promise<Record<string, unknown>>}
 */
async function requestGeminiLayout({
  provider,
  title,
  markdown,
  selection,
  stylePack,
  imageRefs,
  timeoutMs,
  abortTimeoutMs,
  fetchImpl,
}) {
  const controller = new AbortController();
  const timer = setAiLayoutTimeout(() => controller.abort(), abortTimeoutMs || timeoutMs);

  try {
    const messages = buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs });
    const systemInstruction = String(messages[0]?.content || '').trim();
    const userPrompt = String(messages[1]?.content || '').trim() || toPlainPromptFromMessages(messages);
    const endpoint = `${provider.baseUrl}/models/${encodeURIComponent(provider.model)}:generateContent`;
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': provider.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: systemInstruction
          ? {
            role: 'system',
            parts: [{ text: systemInstruction }],
          }
          : undefined,
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
    }

    const data = await response.json();
    const content = readGeminiContent(data);
    const jsonPayload = extractJsonPayload(content);
    try {
      return parseAndRepairLayoutPayload(jsonPayload);
    } catch (error) {
      const sanitizedPayload = sanitizeJsonStringLiteralControls(jsonPayload);
      if (sanitizedPayload !== jsonPayload) {
        return parseAndRepairLayoutPayload(sanitizedPayload);
      }
      throw error;
    }
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AiLayoutTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearAiLayoutTimeout(timer);
  }
}

/**
 * @param {AiLayoutRequestOptions} options
 * @returns {Promise<Record<string, unknown>>}
 */
async function requestAnthropicLayout({
  provider,
  title,
  markdown,
  selection,
  stylePack,
  imageRefs,
  timeoutMs,
  abortTimeoutMs,
  fetchImpl,
}) {
  const controller = new AbortController();
  const timer = setAiLayoutTimeout(() => controller.abort(), abortTimeoutMs || timeoutMs);

  try {
    const messages = buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs });
    const systemInstruction = String(messages[0]?.content || '').trim();
    const userPrompt = String(messages[1]?.content || '').trim() || toPlainPromptFromMessages(messages);
    const response = await fetchImpl(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: ANTHROPIC_LAYOUT_MAX_TOKENS,
        temperature: 0.2,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
    }

    const data = await response.json();
    const content = readAnthropicContent(data);
    const jsonPayload = extractJsonPayload(content);
    try {
      return parseAndRepairLayoutPayload(jsonPayload);
    } catch (error) {
      const sanitizedPayload = sanitizeJsonStringLiteralControls(jsonPayload);
      if (sanitizedPayload !== jsonPayload) {
        return parseAndRepairLayoutPayload(sanitizedPayload);
      }
      throw error;
    }
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AiLayoutTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearAiLayoutTimeout(timer);
  }
}

/**
 * @param {{ provider?: AiProviderLike | null, title?: unknown, markdown?: unknown, stylePack?: string, selection?: AiLayoutSelectionLike, imageRefs?: AiImageRefLike[], timeoutMs?: number, fetchImpl?: FetchLike | GlobalFetchLike }} options
 */
async function generateArticleLayout({
  provider,
  title,
  markdown,
  stylePack = '',
  selection = {
    layoutFamily: AI_LAYOUT_SELECTION_AUTO,
    colorPalette: AI_LAYOUT_SELECTION_AUTO,
  },
  imageRefs = [],
  timeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS,
  fetchImpl = getDefaultFetch(),
}) {
  const safeProvider = provider ? normalizeAiProvider(provider) : null;
  const safeTitle = coerceString(title);
  const safeMarkdown = coerceString(markdown);
  const safeSelection = normalizeLayoutSelection(selection, {
    layoutFamily: AI_LAYOUT_SELECTION_AUTO,
    colorPalette: AI_LAYOUT_SELECTION_AUTO,
  });
  const safeStylePack = normalizeColorPalette(stylePack, AI_LAYOUT_SELECTION_AUTO);
  const safeImageRefs = toAiImageRefs(imageRefs);
  const requestedTimeoutMs = Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : DEFAULT_AI_REQUEST_TIMEOUT_MS;
  const safeTimeoutMs = clampNumber(requestedTimeoutMs, DEFAULT_AI_REQUEST_TIMEOUT_MS, 1000, 180000);
  if (!safeMarkdown) throw new Error('文章内容为空，无法进行 AI 编排');
  const signals = extractMarkdownSignals(safeMarkdown);
  const sourceSections = extractMarkdownSections(safeMarkdown).sections;
  const requestedLayoutFamily = normalizeLayoutFamily(safeSelection.layoutFamily, AI_LAYOUT_SELECTION_AUTO);

  /** @type {Record<string, unknown>} */
  let rawLayout;
  if (!safeProvider) {
    if (requestedLayoutFamily !== 'source-first') {
      throw new Error('未找到可用的 AI Provider');
    }
    rawLayout = {
      articleType: 'article',
      title: safeTitle,
      summary: '',
      fallbackUsed: true,
      blocks: [],
    };
  } else {
    if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持 AI 网络请求');
    try {
      switch (safeProvider.kind) {
        case AI_PROVIDER_KINDS.OPENAI_COMPATIBLE:
          rawLayout = await requestOpenAICompatibleLayout({
            provider: safeProvider,
            title: safeTitle,
            markdown: safeMarkdown,
            selection: safeSelection,
            stylePack: safeStylePack,
            imageRefs: safeImageRefs,
            timeoutMs: requestedTimeoutMs,
            abortTimeoutMs: safeTimeoutMs,
            fetchImpl: /** @type {FetchLike} */ (fetchImpl),
          });
          break;
        case AI_PROVIDER_KINDS.GEMINI:
          rawLayout = await requestGeminiLayout({
            provider: safeProvider,
            title: safeTitle,
            markdown: safeMarkdown,
            selection: safeSelection,
            stylePack: safeStylePack,
            imageRefs: safeImageRefs,
            timeoutMs: requestedTimeoutMs,
            abortTimeoutMs: safeTimeoutMs,
            fetchImpl: /** @type {FetchLike} */ (fetchImpl),
          });
          break;
        case AI_PROVIDER_KINDS.ANTHROPIC:
          rawLayout = await requestAnthropicLayout({
            provider: safeProvider,
            title: safeTitle,
            markdown: safeMarkdown,
            selection: safeSelection,
            stylePack: safeStylePack,
            imageRefs: safeImageRefs,
            timeoutMs: requestedTimeoutMs,
            abortTimeoutMs: safeTimeoutMs,
            fetchImpl: /** @type {FetchLike} */ (fetchImpl),
          });
          break;
        default:
          throw new Error(`暂不支持的 AI Provider 类型: ${safeProvider.kind}`);
      }
    } catch (error) {
      if (!shouldUseLocalFallbackLayout(error, safeSelection)) {
        throw error;
      }
      rawLayout = {
        articleType: 'article',
        title: safeTitle,
        summary: '',
        fallbackUsed: true,
        blocks: [],
      };
    }
  }

  try {
    return buildLayoutResult(rawLayout, {
      title: safeTitle,
      selection: safeSelection,
      stylePack: safeStylePack,
      imageRefs: safeImageRefs,
      markdown: safeMarkdown,
      provider: safeProvider,
      signals,
      sourceSections,
    });
  } catch (error) {
    if (!shouldUseLocalFallbackLayout(error, safeSelection)) {
      throw error;
    }
    return buildLayoutResult({
      articleType: 'article',
      title: safeTitle,
      summary: '',
      fallbackUsed: true,
      blocks: [],
    }, {
      title: safeTitle,
      selection: safeSelection,
      stylePack: safeStylePack,
      imageRefs: safeImageRefs,
      markdown: safeMarkdown,
      provider: null,
      signals,
      sourceSections,
    });
  }
}

/**
 * @param {AiProviderLike} provider
 * @param {FetchLike | GlobalFetchLike | undefined} [fetchImpl=getDefaultFetch()]
 * @returns {Promise<boolean>}
 */
async function testAiProviderConnection(provider, fetchImpl = getDefaultFetch()) {
  const result = await generateArticleLayout({
    provider,
    title: '连接测试',
    markdown: '这是一个连接测试。请输出最小可用的教程排版 JSON。',
    selection: {
      layoutFamily: 'tutorial-cards',
      colorPalette: 'tech-green',
    },
    imageRefs: [],
    timeoutMs: 15000,
    fetchImpl,
  });
  return !!result?.layoutJson?.blocks?.length;
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function normalizeWechatTaskMarkerText(text) {
  return String(text || '').replace(
    /(^|\n)(\s*)\[([ xX])\]\s+/g,
    (_match, lineStart, indent, state) =>
      `${lineStart}${indent}${String(state || '').trim().toLowerCase() === 'x' ? '☑' : '☐'} `,
  );
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function escapeHtml(text) {
  /** @type {Record<string, string>} */
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return normalizeWechatTaskMarkerText(text).replace(/[&<>"']/g, (char) => replacements[char] || char);
}

/**
 * AI layout blocks are text-first. If the model echoes a markdown image token
 * from the source, keep the real rendered image path separate and hide the raw
 * local path from the text card.
 * @param {unknown} text
 * @returns {string}
 */
function normalizeAiLayoutDisplayText(text) {
  return String(text || '')
    .replace(/!\[\[[^[\]\r\n]+]]/g, '')
    .replace(/!\[[^\]\r\n]*]\([^) \r\n]+(?:\s+"[^"]*")?\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function escapeAiLayoutText(text) {
  return escapeHtml(normalizeAiLayoutDisplayText(text));
}

/**
 * @param {unknown} fontFamily
 * @returns {string}
 */
function normalizeInlineFontFamily(fontFamily = '') {
  return String(fontFamily || '').replace(/"/g, '\'');
}

/**
 * @param {string} tagName
 * @param {unknown} text
 * @param {string} style
 * @param {{ mode?: 'preview' | 'draft' | 'export' }} [options={}]
 * @returns {string}
 */
function renderStyledText(tagName, text, style, { mode = 'preview' } = {}) {
  if (text === undefined || text === null || text === '') return '';
  const actualTagName = mode === 'draft' && /^h[1-6]$/i.test(tagName) ? 'p' : tagName;
  return `<${actualTagName} style="${style}">${escapeHtml(text)}</${actualTagName}>`;
}

/**
 * @param {AiColorTokens} tokens
 * @returns {string}
 */
function renderEditorialDraftDivider(tokens) {
  return `<section style="margin:24px 0 0;padding:0;font-size:0;line-height:0;overflow:hidden;">
    <section style="width:100%;height:1px;background:${tokens.border};font-size:0;line-height:0;overflow:hidden;">
      <span style="display:block;width:48px;height:1px;background:${tokens.accent};font-size:0;line-height:0;overflow:hidden;">&nbsp;</span>
    </section>
  </section>`;
}

/**
 * @param {AiColorTokens} tokens
 * @returns {string}
 */
function renderEditorialPreviewDivider(tokens) {
  return `<div style="margin-top:24px;font-size:0;line-height:0;overflow:hidden;">
    <div style="width:100%;height:1px;background:${tokens.border};font-size:0;line-height:0;overflow:hidden;">
      <span style="display:block;width:48px;height:1px;background:${tokens.accent};font-size:0;line-height:0;overflow:hidden;">&nbsp;</span>
    </div>
  </div>`;
}

/**
 * @param {AiLayoutStateLike | AiLayoutJsonLike | null | undefined} layout
 * @param {{ imageRefs?: AiImageRefLike[], mode?: 'preview' | 'draft' | 'export', renderedSectionFragments?: Map<string, unknown> | null, colorPaletteOverride?: AiColorPaletteOverride | null }} [options={}]
 * @returns {string}
 */
function renderArticleLayoutHtml(layout, { imageRefs = [], mode = 'preview', renderedSectionFragments = null, colorPaletteOverride = null } = {}) {
  const layoutRecord = toRecord(layout);
  const layoutJson = /** @type {AiLayoutJsonLike} */ (toRecord(layoutRecord.layoutJson || layoutRecord));
  const layoutFamily = getLayoutFamilyById(layoutJson.resolved?.layoutFamily || layoutJson.layoutFamily);
  const colorPalette = resolveColorPaletteForRender(
    layoutJson.resolved?.colorPalette || layoutJson.stylePack,
    colorPaletteOverride
  );
  const tokens = /** @type {AiColorTokens} */ (colorPalette.tokens || {});
  const renderProfile = getWechatSafeRenderProfile(layoutFamily.id);
  const typography = toRecord(AI_WECHAT_SAFE_STYLE_PRIMITIVES.typography);
  const sectionLabelPrefix = AI_WECHAT_SAFE_STYLE_PRIMITIVES.sectionLabels?.[layoutFamily.id] || 'SECTION';
  const isSourceFirst = layoutFamily.id === 'source-first';
  const isTutorialCards = layoutFamily.id === 'tutorial-cards';
  const isEditorialLite = layoutFamily.id === 'editorial-lite';
  const isDraft = mode === 'draft';
  const editorialDisplayFont = normalizeInlineFontFamily(
    typography.editorialDisplayFont || 'Georgia,"Times New Roman","Songti SC","Noto Serif SC",serif'
  );
  const bodyFontFamily = normalizeInlineFontFamily(
    typography.bodyFontFamily || '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
  );
  const safeImageRefs = toAiImageRefs(imageRefs);
  const imageMap = new Map(safeImageRefs.map((image) => [coerceString(image.id), image]));
  const renderedSectionContainer = isRecord(renderedSectionFragments)
    ? /** @type {{ sections?: RenderedSectionFragmentLike[] }} */ (toRecord(renderedSectionFragments))
    : {};
  /** @type {RenderedSectionFragmentLike[]} */
  const renderedSections = Array.isArray(renderedSectionContainer.sections)
    ? renderedSectionContainer.sections
    : [];
  /** @type {Map<string, RenderedSectionFragmentLike>} */
  const renderedSectionByTitle = new Map(renderedSections.map((section) => [normalizeTitleKey(section?.title || ''), section]));
  const tutorialSpacing = isTutorialCards
    ? (isDraft
      ? {
        wrapperPadding: '12px 4px 10px',
        cardPadding: '10px',
        cardMargin: 8,
        bodyParagraphGap: 12,
        heroPadding: '12px',
        leadQuoteMarginY: 8,
        leadQuotePadding: '10px',
        sectionMarginY: 10,
        sectionCardPadding: '10px',
        subsectionSpacingTop: 6,
        subsectionCardPadding: '18px 24px 16px',
      }
      : {
        wrapperPadding: '22px 16px 30px',
        cardPadding: '18px',
        cardMargin: 16,
        bodyParagraphGap: 18,
        heroPadding: '20px',
        leadQuoteMarginY: 16,
        leadQuotePadding: '18px',
        sectionMarginY: 22,
        sectionCardPadding: '18px',
        subsectionSpacingTop: 16,
        subsectionCardPadding: '14px 16px 12px',
      })
    : null;
  const bodyFontSize = Number(typography.bodyFontSize || 16);
  const bodyLineHeight = Number(typography.bodyLineHeight || 1.8);
  const bodyParagraphGap = tutorialSpacing?.bodyParagraphGap || Number(typography.paragraphGap || 20);
  const sharedImageRadius = Number(AI_WECHAT_SAFE_STYLE_PRIMITIVES.image?.borderRadius || 14);
  const wrapperPadding = isTutorialCards
    ? tutorialSpacing.wrapperPadding
    : (renderProfile.wrapperPadding || (isEditorialLite ? '30px 22px 40px' : '20px 16px 28px'));
  const cardRadius = Number(renderProfile.cardRadius ?? (isSourceFirst ? 10 : (isEditorialLite ? 0 : 18)));
  const cardPadding = isTutorialCards
    ? tutorialSpacing.cardPadding
    : (renderProfile.cardPadding ?? (isSourceFirst ? '0' : (isEditorialLite ? '0' : '18px')));
  const cardMargin = isTutorialCards
    ? tutorialSpacing.cardMargin
    : Number(renderProfile.cardMargin ?? (isSourceFirst ? 8 : (isEditorialLite ? 30 : 18)));
  const cardShadow = isDraft
    ? 'none'
    : (renderProfile.cardShadow ?? (isTutorialCards ? '0 10px 30px -24px rgba(0,0,0,0.18)' : 'none'));
  const heroProfile = toRecord(renderProfile.hero);
  const partNavProfile = toRecord(renderProfile.partNav);
  const leadQuoteProfile = toRecord(renderProfile.leadQuote);
  const caseBlockProfile = toRecord(renderProfile.caseBlock);
  const subsectionProfile = toRecord(renderProfile.subsection);
  const wrapperStyle = [
    `font-family:${bodyFontFamily}`,
    `color:${tokens.text}`,
    `font-size:${bodyFontSize}px`,
    `line-height:${bodyLineHeight}`,
    `letter-spacing:${typography.letterSpacing || '0'}`,
    `padding:${wrapperPadding}`,
    `background:${tokens.surface}`,
  ].join(';');

  const cardStyle = [
    `background:${tokens.surface}`,
    `border:1px solid ${tokens.border}`,
    `border-radius:${cardRadius}px`,
    `padding:${cardPadding}`,
    `margin:${cardMargin}px 0`,
    `box-shadow:${cardShadow}`,
  ].join(';');
  const ctaCardPadding = isTutorialCards
    ? (isDraft ? '14px 14px 12px' : '18px 18px 16px')
    : (isEditorialLite
      ? (isDraft ? '16px 18px 14px' : '18px 20px 16px')
      : (isSourceFirst ? '14px 14px 12px' : '16px 16px 14px'));

  /**
   * @param {unknown} imageId
   * @param {string} [extraStyle='']
   * @returns {string}
   */
  const renderImage = (imageId, extraStyle = '') => {
    const image = imageMap.get(imageId);
    if (!image) return '';
    const style = [
      'display:block',
      'width:100%',
      'height:auto',
      `border-radius:${sharedImageRadius}px`,
      extraStyle,
    ].filter(Boolean).join(';');
    return `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || image.caption)}" style="${style}">`;
  };

  /**
   * @param {unknown} html
   * @returns {Set<string>}
   */
  const collectImageSrcsFromHtml = (html = '') => {
    const normalizedHtml = coerceString(html);
    if (!normalizedHtml) return new Set();
    const container = createHtmlContainer('div', normalizedHtml);
    if (!container) return new Set();
    return new Set(
      Array.from(container.querySelectorAll('img'))
        .map((img) => {
          const imageElement = /** @type {HTMLImageElement} */ (img);
          return coerceString(imageElement.getAttribute('src') || imageElement.src);
        })
        .filter(Boolean)
    );
  };

  /** @param {RenderedSectionFragmentLike | null | undefined} [sectionFragment=null] */
  const collectImageSrcsFromRenderedSection = (sectionFragment = null) => {
    /** @type {Set<string>} */
    const allSrcs = new Set();
    collectImageSrcsFromHtml(sectionFragment?.leadHtml).forEach((src) => allSrcs.add(src));
    const subsectionFragments = Array.isArray(sectionFragment?.subsections) ? sectionFragment.subsections : [];
    subsectionFragments.forEach((subsection) => {
      collectImageSrcsFromHtml(subsection?.contentHtml).forEach((src) => allSrcs.add(src));
    });
    return allSrcs;
  };

  /**
   * @param {AiLayoutBlockLike} [block={}]
   * @returns {RenderedSectionFragmentLike | null}
   */
  const findRenderedSection = (block = {}) => {
    if (Number.isInteger(block.sectionIndex) && block.sectionIndex >= 0 && renderedSections[block.sectionIndex]) {
      const renderedSection = /** @type {RenderedSectionFragmentLike | undefined} */ (renderedSections.at(block.sectionIndex));
      return renderedSection || null;
    }
    return renderedSectionByTitle.get(normalizeTitleKey(block.title || '')) || null;
  };

  /**
   * @param {RenderedSectionFragmentLike | null | undefined} sectionFragment
   * @param {AiLayoutSubsectionLike} [subsection={}]
   * @param {number} [subsectionIndex=0]
   */
  const findRenderedSubsection = (sectionFragment, subsection = {}, subsectionIndex = 0) => {
    const candidates = Array.isArray(sectionFragment?.subsections) ? sectionFragment.subsections : [];
    const titleKey = normalizeTitleKey(subsection?.title || '');
    if (titleKey) {
      const matched = candidates.find((item) => item.titleKey === titleKey);
      if (matched) return matched;
    }
    return candidates[subsectionIndex] || null;
  };

  /**
   * @param {AiLayoutCalloutLike} [callout={}]
   * @param {{ compact?: boolean }} [options={}]
   * @returns {string}
   */
  const renderCalloutCard = (callout = {}, { compact = false } = {}) => {
    const label = coerceString(callout?.title || formatCalloutLabel(callout?.type));
    const body = coerceString(callout?.body);
    if (!label && !body) return '';
    const chipHtml = label
      ? `<div style="margin-bottom:${compact ? 8 : 10}px;">
          <span style="display:inline-block;padding:${compact ? '3px 8px' : '4px 10px'};border-radius:999px;background:${tokens.accentSoft};font-size:10px;font-weight:700;letter-spacing:0.8px;color:${tokens.accentDeep};text-transform:uppercase;">${escapeHtml(label)}</span>
        </div>`
      : '';
    return `<section style="margin:${compact ? '10px 0 16px' : '14px 0 20px'};padding:${compact ? '12px 12px 10px' : '14px 14px 12px'};border:1px solid ${tokens.border};border-left:${compact ? 3 : 4}px solid ${tokens.accent};border-radius:${compact ? 12 : 14}px;background:${isDraft && isTutorialCards ? tokens.surface : tokens.accentSoft};">
      ${chipHtml}
      ${body ? `<p style="margin:0;color:${tokens.text};font-size:${compact ? bodyFontSize : Math.max(bodyFontSize, 15)}px;line-height:${bodyLineHeight};font-weight:${compact ? 500 : 600};letter-spacing:0;">${escapeAiLayoutText(body)}</p>` : ''}
    </section>`;
  };

  const layoutBlocks = toAiLayoutBlocks(layoutJson.blocks);
  const blocksHtml = layoutBlocks.map((block, index) => {
    const previousBlock = layoutBlocks[index - 1] || null;
    const nextBlock = layoutBlocks[index + 1] || null;
    if (block.type === 'hero') {
      const heroImageStyle = isDraft
        ? (isTutorialCards
          ? `width:100%;max-width:none;height:100%;object-fit:cover;border-radius:${heroProfile.imageRadius || 12}px;`
          : `width:100%;max-width:none;border-radius:${heroProfile.imageRadius || (isEditorialLite ? 28 : 18)}px;`)
        : (isEditorialLite
          ? `width:100%;max-width:none;flex:none;border-radius:${heroProfile.imageRadius || 28}px;`
          : (isSourceFirst
            ? `max-width:none;width:100%;flex:none;border-radius:${heroProfile.imageRadius || 18}px;`
            : `max-width:116px;flex:0 0 116px;border-radius:${heroProfile.imageRadius || 18}px;`));
      const imageHtml = block.coverImageId ? renderImage(block.coverImageId, heroImageStyle) : '';
      const contentHtml = [
        block.eyebrow ? `<div style="font-size:${heroProfile.eyebrowSize || (isEditorialLite ? 10 : 11)}px;font-weight:700;letter-spacing:${heroProfile.eyebrowLetterSpacing || (isEditorialLite ? 2 : 1.2)}px;color:${tokens.accentDeep};text-transform:uppercase;margin-bottom:${isSourceFirst ? 8 : 10}px;">${escapeHtml(block.eyebrow)}</div>` : '',
        renderStyledText(
          'h1',
          block.title,
          `margin:0 0 ${isSourceFirst ? 6 : (isEditorialLite ? 14 : 10)}px;font-size:${heroProfile.titleSize || (isSourceFirst ? 26 : (isEditorialLite ? 36 : 28))}px;line-height:${isEditorialLite ? 1.12 : 1.24};color:${tokens.text};font-weight:${isEditorialLite ? 700 : 700};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};`,
          { mode }
        ),
        block.subtitle ? `<p style="margin:0;color:${tokens.muted};font-size:${heroProfile.subtitleSize || (isSourceFirst ? 16 : (isEditorialLite ? 17 : 14))}px;line-height:${heroProfile.subtitleLineHeight || (isSourceFirst ? 1.8 : (isEditorialLite ? 1.88 : 1.7))};letter-spacing:0;">${escapeHtml(block.subtitle)}</p>` : '',
      ].join('');
      const flexDirection = block.variant === 'cover-left' ? 'row-reverse' : 'row';
      const heroFooter = isDraft
        ? (heroProfile.footerMode === 'editorial-divider'
          ? ((isEditorialLite && nextBlock?.type === 'part-nav')
            ? renderEditorialDraftDivider(tokens)
            : `<p style="margin:24px 0 0;height:1px;background:${tokens.border};border-radius:999px;font-size:0;line-height:0;overflow:hidden;">&nbsp;</p>`)
          : `<p style="margin:18px 0 0;height:${heroProfile.footerMode === 'accent-bar' ? 10 : 1}px;background:${heroProfile.footerMode === 'accent-bar' ? tokens.accent : tokens.border};border-radius:999px;font-size:0;line-height:0;overflow:hidden;">&nbsp;</p>`)
        : (heroProfile.footerMode === 'editorial-divider'
          ? renderEditorialPreviewDivider(tokens)
          : (heroProfile.footerMode === 'divider'
            ? `<div style="height:1px;margin-top:18px;background:${tokens.border};border-radius:999px;"></div>`
            : `<div style="height:10px;margin-top:18px;background:${tokens.accent};border-radius:999px;"></div>`));
      if (isDraft) {
        if (isTutorialCards) {
          const heroThumbHtml = imageHtml
            ? `<div style="width:112px;height:112px;padding:6px;border-radius:18px;background:linear-gradient(135deg, ${tokens.accentDeep} 0%, ${tokens.accent} 60%, ${tokens.accentSoft} 100%);box-sizing:border-box;">
                ${imageHtml}
              </div>`
            : '';
          const heroBodyHtml = heroThumbHtml
            ? `<section style="display:flex;align-items:center;${block.variant === 'cover-left' ? 'flex-direction:row-reverse;' : ''}">
                <section style="flex:1;min-width:0;${block.variant === 'cover-left' ? 'padding-left:16px;' : 'padding-right:16px;'}">${contentHtml}</section>
                <section style="flex-shrink:0;width:124px;">${heroThumbHtml}</section>
              </section>`
            : `<div>${contentHtml}</div>`;
          return `<section style="${cardStyle};padding:${tutorialSpacing?.heroPadding || '16px'};background:${tokens.surfaceSoft};overflow:hidden;">
            ${heroBodyHtml}
            ${heroFooter}
          </section>`;
        }
        const draftHeroStyle = isTutorialCards
          ? `${cardStyle};padding:14px;background:${tokens.surfaceSoft};`
          : `margin:${isEditorialLite ? '4px 0 34px' : '2px 0 24px'};`;
        return `<section style="${draftHeroStyle}">
          <div>${contentHtml}</div>
          ${imageHtml ? `<div style="margin-top:14px;">${imageHtml}</div>` : ''}
          ${heroFooter}
        </section>`;
      }
      if (isEditorialLite) {
        return `<section style="margin:4px 0 34px;">
          <div style="max-width:680px;">${contentHtml}</div>
          ${imageHtml ? `<div style="margin-top:20px;">${imageHtml}</div>` : ''}
          ${heroFooter}
        </section>`;
      }
      if (isSourceFirst) {
        return `<section style="margin:2px 0 24px;">
          ${imageHtml ? `<div style="margin-bottom:14px;">${imageHtml}</div>` : ''}
          <div style="max-width:720px;">${contentHtml}</div>
          ${heroFooter}
        </section>`;
      }
      return `<section style="${cardStyle};padding:${isTutorialCards ? tutorialSpacing?.heroPadding || '18px' : '22px'};background:linear-gradient(180deg, ${tokens.surfaceSoft} 0%, ${tokens.surface} 100%);">
        <div style="display:flex;flex-direction:${flexDirection};gap:16px;align-items:center;">
          <div style="flex:1 1 auto;min-width:0;">${contentHtml}</div>
          ${imageHtml}
        </div>
        ${heroFooter}
      </section>`;
    }

    if (block.type === 'part-nav') {
      if (isDraft) {
        if (isTutorialCards) {
          const navHintHtml = `<p style="margin:0 2px 6px 0;font-size:11px;line-height:1.5;color:${tokens.muted};text-align:right;">← 左右滑动</p>`;
          const itemsHtml = block.items.map((item, itemIndex) => `
            <section style="display:inline-block;white-space:normal;vertical-align:top;width:${partNavProfile.cardWidth || 112}px;height:${partNavProfile.cardHeight || 116}px;padding:10px 10px 12px;margin-right:${itemIndex === block.items.length - 1 ? 0 : 8}px;border:1px solid ${tokens.border};border-radius:${partNavProfile.useCard ? 16 : 12}px;background:${partNavProfile.useCard ? tokens.surfaceSoft : tokens.surface};box-sizing:border-box;overflow:hidden;">
              <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:${tokens.accentDeep};letter-spacing:0.8px;text-transform:uppercase;">${escapeHtml(item.label)}</p>
              <p style="margin:0;height:60px;overflow:hidden;font-size:13px;font-weight:600;color:${tokens.text};line-height:1.55;">${escapeHtml(item.text)}</p>
            </section>
          `).join('');
          return `<section style="margin:${isEditorialLite ? 20 : (isSourceFirst ? 20 : 10)}px 0 ${isSourceFirst ? 18 : 4}px;">
            ${navHintHtml}
            <section style="overflow-x:scroll;-webkit-overflow-scrolling:touch;white-space:nowrap;padding-bottom:8px;">
              ${itemsHtml}
            </section>
          </section>`;
        }
        if (isEditorialLite) {
          const itemsHtml = block.items.map((item) => `
            <section style="padding:14px 0 16px;border-bottom:1px solid ${tokens.border};">
              <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:1.2px;color:${tokens.accentDeep};text-transform:uppercase;">${escapeHtml(item.label)}</p>
              <p style="margin:0;font-size:17px;font-weight:500;line-height:1.72;color:${tokens.text};font-family:${editorialDisplayFont};">${escapeHtml(item.text)}</p>
            </section>
          `).join('');
          return `<section style="margin:14px 0 8px;">
            <section>
              ${itemsHtml}
            </section>
          </section>`;
        }
        const itemsHtml = block.items.map((item, itemIndex) => `
          <div style="margin:${itemIndex === 0 ? 0 : 8}px 0 0;padding:12px 12px;border:1px solid ${tokens.border};border-radius:${partNavProfile.useCard ? 14 : 10}px;background:${partNavProfile.useCard ? tokens.surfaceSoft : tokens.surface};">
            <div style="font-size:10px;font-weight:700;color:${tokens.accentDeep};letter-spacing:${isEditorialLite ? 1.2 : 0.8}px;text-transform:uppercase;">${escapeHtml(item.label)}</div>
            <div style="margin-top:8px;font-size:${isSourceFirst ? 14 : (isEditorialLite ? 17 : 13)}px;font-weight:${isSourceFirst ? 500 : (isEditorialLite ? 500 : 600)};color:${tokens.text};line-height:${isEditorialLite ? 1.72 : 1.55};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};">${escapeHtml(item.text)}</div>
          </div>
        `).join('');
        return `<section style="margin:${isEditorialLite ? 20 : (isSourceFirst ? 20 : 16)}px 0 ${isSourceFirst ? 18 : 8}px;">
          <div>${itemsHtml}</div>
        </section>`;
      }
      const itemsHtml = block.items.map((item) => `
        <div style="flex:${partNavProfile.direction === 'column' ? '1 1 100%' : (isEditorialLite ? '1 1 100%' : '1 1 0')};min-width:0;padding:${isSourceFirst ? '0 0 0 0' : (isEditorialLite ? '14px 0' : '12px 10px')};border:${partNavProfile.useCard ? `1px solid ${tokens.border}` : 'none'};border-radius:${partNavProfile.useCard ? 14 : 0}px;background:${partNavProfile.useCard ? tokens.surfaceSoft : 'transparent'};border-bottom:${partNavProfile.useDivider ? `1px solid ${tokens.border}` : 'none'};">
          <div style="font-size:10px;font-weight:700;color:${tokens.accentDeep};letter-spacing:${isEditorialLite ? 1.2 : 0.8}px;text-transform:uppercase;">${escapeHtml(item.label)}</div>
          <div style="margin-top:8px;font-size:${isSourceFirst ? 14 : (isEditorialLite ? 17 : 13)}px;font-weight:${isSourceFirst ? 500 : (isEditorialLite ? 500 : 600)};color:${tokens.text};line-height:${isEditorialLite ? 1.72 : 1.55};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};">${escapeHtml(item.text)}</div>
        </div>
      `).join('');
      return `<section style="margin:${isEditorialLite ? 20 : (isSourceFirst ? 20 : 16)}px 0 ${isSourceFirst ? 18 : 8}px;">
        <div style="display:flex;gap:${partNavProfile.gap || (isSourceFirst ? 16 : 10)}px;flex-wrap:wrap;${partNavProfile.useDivider && isSourceFirst ? `padding:0 0 10px;border-bottom:1px solid ${tokens.border};` : ''}${partNavProfile.direction === 'column' ? 'flex-direction:column;' : ''}">${itemsHtml}</div>
      </section>`;
    }

    if (block.type === 'lead-quote') {
      const leadQuoteFontSize = leadQuoteProfile.fontSize || (isSourceFirst ? 16 : (isEditorialLite ? 26 : (isDraft && isTutorialCards ? 20 : 18)));
      const editorialLeadQuoteBorderTop = isEditorialLite && previousBlock?.type !== 'part-nav'
        ? `1px solid ${tokens.border}`
        : 'none';
      return `<section style="margin:${isSourceFirst ? 14 : (isEditorialLite ? 26 : (isTutorialCards ? tutorialSpacing?.leadQuoteMarginY || 14 : 18))}px 0;padding:${isSourceFirst ? '0 0 0 14px' : (isEditorialLite ? '24px 0' : (isTutorialCards ? tutorialSpacing?.leadQuotePadding || '14px' : '18px'))};border-radius:${isTutorialCards ? 16 : 0}px;background:${leadQuoteProfile.background === 'quoteBg' ? tokens.quoteBg : 'transparent'};border:${isTutorialCards ? `1px solid ${tokens.border}` : 'none'};border-left:${leadQuoteProfile.borderLeft ? `3px solid ${tokens.accent}` : 'none'};border-top:${editorialLeadQuoteBorderTop};border-bottom:${isEditorialLite ? `1px solid ${tokens.border}` : 'none'};">
        <p style="margin:0;font-size:${leadQuoteFontSize}px;font-weight:${leadQuoteProfile.fontWeight || (isSourceFirst ? 600 : (isEditorialLite ? 600 : 700))};line-height:${isEditorialLite ? 1.7 : 1.75};color:${tokens.text};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};letter-spacing:0;">${escapeAiLayoutText(block.text)}</p>
        ${block.note ? `<p style="margin:${isTutorialCards ? 8 : 10}px 0 0;font-size:${isTutorialCards ? 13 : 12}px;line-height:1.8;color:${tokens.muted};letter-spacing:0;">${escapeAiLayoutText(block.note)}</p>` : ''}
      </section>`;
    }

    if (block.type === 'case-block') {
      const caseImageIds = Array.isArray(block.imageIds) ? block.imageIds : [];
      const caseBullets = Array.isArray(block.bullets) ? block.bullets : [];
      const imagesHtml = caseImageIds.map((imageId) => `<div style="margin-top:14px;">${renderImage(imageId)}</div>`).join('');
      const bulletsHtml = caseBullets.length
        ? `<ul style="margin:12px 0 0 18px;padding:0;color:${tokens.text};">${caseBullets.map((bullet) => `<li style="margin:6px 0;">${escapeAiLayoutText(bullet)}</li>`).join('')}</ul>`
        : '';
      const caseHeaderHtml = isDraft
        ? `<div style="margin-bottom:8px;">
            <span style="display:inline-block;font-size:${caseBlockProfile.indexSize || (isSourceFirst ? 22 : (isEditorialLite ? 14 : 28))}px;font-weight:${isEditorialLite ? 700 : 800};color:${tokens.accent};line-height:1;letter-spacing:${isEditorialLite ? 1.2 : 0};text-transform:${isEditorialLite ? 'uppercase' : 'none'};">${String(index + 1).padStart(2, '0')}</span>
            <span style="display:inline-block;margin-left:8px;font-size:11px;font-weight:700;letter-spacing:1px;color:${tokens.muted};text-transform:uppercase;">${escapeHtml(block.caseLabel)}</span>
          </div>`
        : `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="font-size:${caseBlockProfile.indexSize || (isSourceFirst ? 22 : (isEditorialLite ? 14 : 28))}px;font-weight:${isEditorialLite ? 700 : 800};color:${tokens.accent};line-height:1;letter-spacing:${isEditorialLite ? 1.2 : 0};text-transform:${isEditorialLite ? 'uppercase' : 'none'};">${String(index + 1).padStart(2, '0')}</div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${tokens.muted};text-transform:uppercase;">${escapeHtml(block.caseLabel)}</div>
          </div>`;
      return `<section style="margin:${isSourceFirst ? 22 : (isEditorialLite ? 32 : (isTutorialCards ? tutorialSpacing?.sectionMarginY || 18 : 26))}px 0;${caseBlockProfile.useCard ? `padding:${isTutorialCards ? tutorialSpacing?.sectionCardPadding || '14px' : '18px'};border:1px solid ${tokens.border};border-radius:${cardRadius}px;background:${tokens.surfaceSoft};` : ''}">
        ${caseHeaderHtml}
        ${renderStyledText(
          'h2',
          block.title,
          `margin:0 0 ${isEditorialLite ? 10 : 8}px;font-size:${caseBlockProfile.titleSize || (isSourceFirst ? 20 : (isEditorialLite ? 26 : 22))}px;line-height:${isEditorialLite ? 1.28 : 1.4};color:${tokens.text};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};`,
          { mode }
        )}
        ${block.summary ? `<p style="margin:0 0 ${bodyParagraphGap}px;color:${tokens.muted};font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${escapeAiLayoutText(block.summary)}</p>` : ''}
        ${block.highlight ? `<div style="margin-top:12px;padding:10px 12px;border-left:4px solid ${tokens.accent};background:${tokens.accentSoft};border-radius:10px;color:${tokens.accentDeep};font-weight:600;font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${escapeAiLayoutText(block.highlight)}</div>` : ''}
        ${bulletsHtml}
        ${imagesHtml}
      </section>`;
    }

    if (block.type === 'section-block') {
      const renderedSection = findRenderedSection(block);
      const numericSectionIndex = Number.isInteger(block.sectionIndex) ? Number(block.sectionIndex) : -1;
      const sectionDisplayIndex = numericSectionIndex >= 0
        ? numericSectionIndex + 1
        : index + 1;
      const headingLevel = Number.isInteger(block.headingLevel) ? block.headingLevel : 2;
      const titleFontSize = headingLevel >= 3 ? (isSourceFirst ? 17 : (isEditorialLite ? 18 : 18)) : (isSourceFirst ? 20 : (isEditorialLite ? 26 : 22));
      const titleMarginBottom = headingLevel >= 3 ? 10 : (isEditorialLite ? 14 : 12);
      const titleColor = headingLevel >= 3 ? tokens.accentDeep : tokens.text;
      const paragraphsHtml = Array.isArray(block.paragraphs)
        ? block.paragraphs.map((paragraph) => `<p style="margin:0 0 ${bodyParagraphGap}px;color:${tokens.text};font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${escapeAiLayoutText(paragraph)}</p>`).join('')
        : '';
      const bulletGroupsHtml = Array.isArray(block.bulletGroups)
        ? block.bulletGroups.map((group) => {
          if (!Array.isArray(group) || !group.length) return '';
          return `<ul style="margin:12px 0 ${bodyParagraphGap}px 20px;padding:0;color:${tokens.text};font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${group.map((bullet) => `<li style="margin:4px 0;">${escapeAiLayoutText(bullet)}</li>`).join('')}</ul>`;
        }).join('')
        : '';
      const calloutsHtml = Array.isArray(block.callouts)
        ? block.callouts.map((callout) => renderCalloutCard(callout)).join('')
        : '';
      const preservedLeadHtml = remapPreservedFragmentColors(renderedSection?.leadHtml, tokens);
      const preservedSectionImageSrcs = collectImageSrcsFromRenderedSection(renderedSection);
      const uniqueImageIds = Array.isArray(block.imageIds)
        ? block.imageIds.filter((imageId) => {
          const imageSrc = coerceString(imageMap.get(imageId)?.src);
          return imageSrc && !preservedSectionImageSrcs.has(imageSrc);
        })
        : [];
      const imagesHtml = uniqueImageIds.map((imageId) => `<div style="margin-top:14px;">${renderImage(imageId)}</div>`).join('');
      const subsectionsHtml = Array.isArray(block.subsections)
        ? block.subsections.map((subsection, subsectionIndex) => {
          const renderedSubsection = /** @type {RenderedSubsectionFragmentLike | null} */ (findRenderedSubsection(renderedSection, subsection, subsectionIndex));
          const subsectionLevel = Number.isInteger(subsection?.level) ? subsection.level : 3;
          const subsectionParagraphs = Array.isArray(subsection?.paragraphs)
            ? subsection.paragraphs.map((paragraph) => `<p style="margin:0 0 ${bodyParagraphGap}px;color:${tokens.text};font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${escapeAiLayoutText(paragraph)}</p>`).join('')
            : '';
          const subsectionBullets = Array.isArray(subsection?.bulletGroups)
            ? subsection.bulletGroups.map((group) => {
              if (!Array.isArray(group) || !group.length) return '';
              return `<ul style="margin:10px 0 ${bodyParagraphGap}px 20px;padding:0;color:${tokens.text};font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${group.map((bullet) => `<li style="margin:4px 0;">${escapeAiLayoutText(bullet)}</li>`).join('')}</ul>`;
            }).join('')
            : '';
          const subsectionCallouts = Array.isArray(subsection?.callouts)
            ? subsection.callouts.map((callout) => renderCalloutCard(callout, { compact: true })).join('')
            : '';
          const preservedSubsectionHtml = remapPreservedFragmentColors(renderedSubsection?.contentHtml, tokens);
          const subsectionTitle = coerceString(subsection?.title);
          const subsectionLabel = isTutorialCards
            ? `STEP ${String(subsectionIndex + 1).padStart(2, '0')}`
            : (isEditorialLite ? `Scene ${String(subsectionIndex + 1).padStart(2, '0')}` : `Sub ${String(subsectionIndex + 1).padStart(2, '0')}`);
          const subsectionHasAccentRail = !!subsectionProfile.useBorderLeft;
          const tutorialSubsectionContentPadding = isTutorialCards
            ? (tutorialSpacing?.subsectionCardPadding || (isDraft ? '18px 24px 16px' : '14px 16px 12px'))
            : null;
          const tutorialPreviewSubsectionContentPadding = isTutorialCards ? '14px 16px 12px' : null;
          const tutorialSubsectionShellStyle = isTutorialCards && subsectionProfile.useCard
            ? (isDraft
              ? `padding:${tutorialSubsectionContentPadding || '18px 24px 16px'};box-sizing:border-box;border:1px solid ${tokens.border};border-left:3px solid ${tokens.accent};border-radius:14px;background:${tokens.surfaceSoft};background-color:${tokens.surfaceSoft};overflow:hidden`
              : `border:1px solid ${tokens.border};border-left:3px solid ${tokens.accent};border-radius:14px;background:${tokens.surfaceSoft};overflow:hidden`)
            : null;
          const subsectionContainerStyle = [
            `margin-top:${subsectionProfile.spacingTop || (isEditorialLite ? 18 : (isTutorialCards ? tutorialSpacing?.subsectionSpacingTop || 12 : 14))}px`,
            subsectionProfile.useCard
              ? (tutorialSubsectionShellStyle
                ? tutorialSubsectionShellStyle
                : `padding:${isTutorialCards ? tutorialSpacing?.subsectionCardPadding || '18px 24px 16px' : '0'};border:1px solid ${tokens.border};border-radius:${isTutorialCards ? 14 : 0}px;background:${isTutorialCards ? (isDraft ? tokens.surface : tokens.surfaceSoft) : 'transparent'}`)
              : '',
            isEditorialLite ? `padding-top:6px;border-top:1px dashed ${tokens.border};` : '',
          ].filter(Boolean).join(';');
          const subsectionTitleSize = subsectionLevel >= 4
            ? Math.max(14, Number(subsectionProfile.titleSize || (isEditorialLite ? 18 : 16)) - 1)
            : Number(subsectionProfile.titleSize || (isEditorialLite ? 18 : 16));
          const subsectionLabelHtml = subsectionTitle
            ? (isDraft
              ? `<div style="margin-bottom:8px;">
                  <span style="display:inline-block;padding:${isTutorialCards ? '3px 8px' : '0'};border-radius:${isTutorialCards ? '999px' : '0'};background:${isTutorialCards ? tokens.accentSoft : 'transparent'};font-size:10px;font-weight:700;letter-spacing:${isEditorialLite ? 1.4 : 1}px;color:${tokens.accentDeep};text-transform:uppercase;${isEditorialLite ? `font-family:${editorialDisplayFont};` : ''}">${escapeHtml(subsectionLabel)}</span>
                </div>`
              : `<div style="display:flex;align-items:center;gap:${isEditorialLite ? 10 : 8}px;margin-bottom:8px;">
                  <span style="font-size:10px;font-weight:700;letter-spacing:${isEditorialLite ? 1.4 : 1}px;color:${tokens.accentDeep};text-transform:uppercase;${isEditorialLite ? `font-family:${editorialDisplayFont};` : ''}">${escapeHtml(subsectionLabel)}</span>
                  <div style="flex:1;height:1px;background:${isEditorialLite ? tokens.border : 'transparent'};"></div>
                </div>`)
            : '';
          const subsectionTitleStyle = isDraft && isTutorialCards
            ? `margin:0 0 8px;font-size:${subsectionTitleSize}px;line-height:1.5;font-weight:${subsectionProfile.titleWeight || 700};color:${tokens.accentDeep};font-family:inherit;`
            : `margin:0 0 8px;font-size:${subsectionTitleSize}px;line-height:${isEditorialLite ? 1.45 : 1.5};font-weight:${subsectionProfile.titleWeight || (isEditorialLite ? 600 : 700)};color:${tokens.accentDeep};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};`;
          const subsectionInnerHtml = `
            ${subsectionLabelHtml}
            ${renderStyledText(
              'h3',
              subsectionTitle,
              subsectionTitleStyle,
              { mode }
            )}
            ${preservedSubsectionHtml || `${subsectionParagraphs}${subsectionBullets}${subsectionCallouts}`}
          `;
          const subsectionContentHtml = subsectionHasAccentRail
            ? (isDraft && isTutorialCards
              ? subsectionInnerHtml
              : `<div style="${tutorialPreviewSubsectionContentPadding ? `padding:${tutorialPreviewSubsectionContentPadding};` : ''}">${subsectionInnerHtml}</div>`)
            : subsectionInnerHtml;
          const subsectionWrapperTag = isTutorialCards && isDraft ? 'section' : 'div';
          return `<${subsectionWrapperTag} style="${subsectionContainerStyle}">
            ${subsectionContentHtml}
          </${subsectionWrapperTag}>`;
        }).join('')
        : '';
      const sectionHead = isDraft
        ? (isTutorialCards
          ? `<div style="margin-bottom:8px;">
              <span style="display:inline-block;font-size:28px;font-weight:800;color:${tokens.accent};line-height:1;">${String(sectionDisplayIndex).padStart(2, '0')}</span>
              <span style="display:inline-block;margin-left:8px;font-size:11px;font-weight:700;letter-spacing:1px;color:${tokens.muted};text-transform:uppercase;">${escapeHtml(block.sectionLabel || `${sectionLabelPrefix} ${String(sectionDisplayIndex).padStart(2, '0')}`)}</span>
            </div>`
          : `<div style="margin-bottom:${isEditorialLite ? 14 : 10}px;">
              <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:${isEditorialLite ? 1.4 : 1.2}px;color:${tokens.accentDeep};text-transform:uppercase;">${escapeHtml(`${sectionLabelPrefix} ${String(sectionDisplayIndex).padStart(2, '0')}`)}</span>
            </div>`)
        : (isSourceFirst
          ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:${tokens.accentDeep};text-transform:uppercase;">${escapeHtml(`${sectionLabelPrefix} ${String(sectionDisplayIndex).padStart(2, '0')}`)}</div>
              <div style="height:1px;flex:1;background:${tokens.border};"></div>
            </div>`
          : isEditorialLite
            ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;color:${tokens.accentDeep};text-transform:uppercase;">${escapeHtml(`${sectionLabelPrefix} ${String(sectionDisplayIndex).padStart(2, '0')}`)}</div>
                <div style="width:42px;height:1px;background:${tokens.border};"></div>
              </div>`
            : `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="font-size:28px;font-weight:800;color:${tokens.accent};line-height:1;">${String(sectionDisplayIndex).padStart(2, '0')}</div>
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${tokens.muted};text-transform:uppercase;">${escapeHtml(block.sectionLabel || `${sectionLabelPrefix} ${String(sectionDisplayIndex).padStart(2, '0')}`)}</div>
            </div>`);
      return `<section style="margin:${isSourceFirst ? 22 : (isEditorialLite ? 36 : (isTutorialCards ? tutorialSpacing?.sectionMarginY || 18 : 26))}px 0;${caseBlockProfile.useCard && isTutorialCards ? `padding:${tutorialSpacing?.sectionCardPadding || '14px'};border:1px solid ${tokens.border};border-radius:${cardRadius}px;background:${tokens.surfaceSoft};box-shadow:${cardShadow};` : ''}${isSourceFirst ? `padding-top:4px;` : ''}">
        ${sectionHead}
        ${renderStyledText(
          'h2',
          block.title,
          `margin:0 0 ${titleMarginBottom}px;font-size:${titleFontSize}px;line-height:${isEditorialLite ? 1.28 : 1.4};color:${titleColor};font-family:${isEditorialLite ? editorialDisplayFont : 'inherit'};`,
          { mode }
        )}
        ${preservedLeadHtml || `${paragraphsHtml}${bulletGroupsHtml}${calloutsHtml}${imagesHtml}`}
        ${subsectionsHtml}
        ${preservedLeadHtml ? imagesHtml : ''}
      </section>`;
    }

    if (block.type === 'phone-frame') {
      return `<section style="margin:24px auto;max-width:${isSourceFirst ? 420 : (isEditorialLite ? 460 : 380)}px;padding:${isSourceFirst ? 10 : (isEditorialLite ? 12 : 14)}px;border:1px solid ${tokens.border};border-radius:${isSourceFirst ? 24 : (isEditorialLite ? 18 : 42)}px;background:${isDraft ? tokens.surfaceSoft : `linear-gradient(180deg, ${tokens.surfaceSoft} 0%, ${tokens.surface} 100%)`};${isDraft ? '' : 'box-shadow:0 20px 40px -28px rgba(36,50,61,0.18);'}">
        <div style="width:${isEditorialLite ? 28 : 42}%;height:${isEditorialLite ? 2 : 18}px;margin:0 auto 14px;border-radius:999px;background:${tokens.border};"></div>
        <div style="background:${tokens.surface};border:1px solid ${tokens.border};border-radius:${isSourceFirst ? 16 : (isEditorialLite ? 14 : 28)}px;padding:10px;overflow:hidden;">
          ${renderImage(block.imageId, `border-radius:${isSourceFirst ? 12 : (isEditorialLite ? 12 : 22)}px;`)}
        </div>
        ${block.caption ? `<div style="margin-top:10px;font-size:12px;text-align:center;color:${tokens.muted};">${escapeHtml(block.caption)}</div>` : ''}
      </section>`;
    }

    if (block.type === 'cta-card') {
      const ctaButtonHtml = `<p style="margin:14px 0 0;font-size:0;line-height:0;">
        <span style="display:inline-block;padding:${isEditorialLite ? '9px 18px' : '10px 16px'};border-radius:999px;background:${tokens.accent};color:#ffffff;font-weight:700;font-size:14px;line-height:1.2;letter-spacing:0;white-space:nowrap;">${escapeHtml(block.buttonText || '继续阅读')}</span>
      </p>`;
      return `<section style="${cardStyle};padding:${ctaCardPadding};background:${isDraft ? tokens.accentSoft : `linear-gradient(135deg, ${tokens.accentSoft} 0%, #ffffff 100%)`};">
        ${renderStyledText(
          'h3',
          block.title,
          `margin:0 0 10px;font-size:${isEditorialLite ? 22 : 20}px;line-height:${isEditorialLite ? 1.3 : 1.35};color:${tokens.text};`,
          { mode }
        )}
        ${block.body ? `<p style="margin:0;color:${tokens.muted};font-size:${bodyFontSize}px;line-height:${bodyLineHeight};letter-spacing:0;">${escapeHtml(block.body)}</p>` : ''}
        ${ctaButtonHtml}
        ${block.note ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.75;color:${tokens.muted};letter-spacing:0;">${escapeAiLayoutText(block.note)}</p>` : ''}
      </section>`;
    }

    return '';
  }).join('');

  return `<section style="${wrapperStyle}">${blocksHtml}</section>`;
}

export {
  AI_LAYOUT_SCHEMA_VERSION,
  AI_LAYOUT_SKILL_VERSION,
  AI_LAYOUT_SELECTION_AUTO,
  AI_LAYOUT_FAMILY_DEFS,
  AI_PROVIDER_KINDS,
  AI_COLOR_PALETTES,
  AI_STYLE_PACKS,
  createDefaultAiSettings,
  normalizeAiSettings,
  normalizeAiProvider,
  isAllowedAiProviderBaseUrl,
  getAiProviderIssues,
  isAiProviderRunnable,
  summarizeAiProviderIssues,
  normalizeArticleLayoutState,
  normalizeArticleLayoutCacheEntry,
  normalizeSchemaValidation,
  normalizeLayoutFamily,
  normalizeColorPalette,
  normalizeLayoutSelection,
  normalizeResolvedSelection,
  getArticleLayoutSelectionKey,
  getArticleLayoutSelectionState,
  getArticleLayoutSelectionStateKey,
  getLayoutFamilyList,
  getLayoutFamilyById,
  getColorPaletteList,
  getColorPaletteById,
  resolveColorPaletteForRender,
  normalizeHexColor,
  getStylePackList,
  getStylePackById,
  listEnabledAiProviders,
  resolveAiProvider,
  deriveArticleLayoutStateForSelection,
  extractImageRefsFromHtml,
  extractRenderedSectionFragments,
  extractMarkdownSections,
  extractMarkdownSignals,
  buildFallbackLayout,
  normalizeArticleLayout,
  normalizeLayoutGenerationMeta,
  buildLayoutResult,
  AiLayoutSchemaError,
  AiLayoutTimeoutError,
  generateArticleLayout,
  renderArticleLayoutHtml,
  testAiProviderConnection,
};
