// services/publish-status.js
//
// Pure helpers for recording per-note "publish status" into the note's
// YAML frontmatter after a successful 发布与分发 action.
//
// Design (confirmed with user):
// - English frontmatter keys, flattened for readability in Obsidian's
//   properties panel (no nested object list).
// - Wording is "已同步/synced" (most flows create drafts, not public posts).
// - Only successful platforms are recorded. No filename / folder changes.
// - Timestamp is Beijing wall time (UTC+8) WITHOUT an offset suffix, and
//   carries an ISO week + weekday marker, e.g. `2026-07-03W27-5T13:54:59`
//   (W27 = 27th ISO week of the year, -5 = Friday; Mon=1 ... Sun=7).

export const PUBLISH_STATUS_SYNCED = 'synced';
export const PUBLISH_STATUS_PARTIAL = 'partial';

export const FRONTMATTER_KEYS = Object.freeze({
  status: 'publish_status',
  platforms: 'publish_platforms',
  platform: 'publish_platform',
  kind: 'publish_kind',
  time: 'publish_time',
});

// Keys from earlier versions that we now flatten away.
const DEPRECATED_KEYS = ['publish_targets', 'last_publish_at'];

/**
 * @typedef {{ platform: string, kind?: string, account?: string, url?: string, time?: string }} PublishTargetInput
 * @typedef {{ platform: string, kind: string, time: string }} PublishTargetEntry
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * ISO-8601 week number for a Y/M/D (treated in UTC).
 * @param {number} year
 * @param {number} monthIndex 0-based
 * @param {number} day
 * @returns {number}
 */
function isoWeekNumber(year, monthIndex, day) {
  const date = new Date(Date.UTC(year, monthIndex, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // move to the Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/**
 * Format a Date as Beijing (UTC+8) wall time with ISO week + weekday marker,
 * e.g. `2026-07-03W27-5T13:54:59`. No timezone offset suffix. Computed from
 * UTC math so it is correct regardless of the host machine's local timezone.
 * @param {Date} [date]
 * @returns {string}
 */
export function formatBeijingTimestamp(date = new Date()) {
  const base = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const shifted = new Date(base.getTime() + 8 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const monthIndex = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const week = isoWeekNumber(year, monthIndex, day);
  const weekday = shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(); // Mon=1 ... Sun=7
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}W${week}-${weekday}`
    + `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}

/**
 * @returns {string} current time as Beijing (UTC+8) timestamp
 */
export function nowBeijingTimestamp() {
  return formatBeijingTimestamp(new Date());
}

/**
 * Normalize a raw target descriptor.
 * @param {PublishTargetInput} input
 * @param {string} [now] timestamp fallback for `time`
 * @returns {PublishTargetEntry | null}
 */
export function buildPublishTarget(input, now) {
  const platform = toTrimmedString(input && input.platform).toLowerCase();
  if (!platform) return null;
  const kind = toTrimmedString(input && input.kind) || 'draft';
  const time = toTrimmedString(input && input.time) || toTrimmedString(now) || nowBeijingTimestamp();
  return { platform, kind, time };
}

/**
 * @param {number} requestedCount
 * @param {number} successCount
 * @returns {'synced' | 'partial'}
 */
export function resolvePublishStatus(requestedCount, successCount) {
  const requested = Number.isFinite(requestedCount) ? Number(requestedCount) : 0;
  const succeeded = Number.isFinite(successCount) ? Number(successCount) : 0;
  return requested > 0 && succeeded >= requested ? PUBLISH_STATUS_SYNCED : PUBLISH_STATUS_PARTIAL;
}

/**
 * Cumulative, de-duplicated (case-insensitive) union of platform strings.
 * @param {unknown} existing
 * @param {string[]} incoming
 * @returns {string[]}
 */
export function mergePlatformList(existing, incoming) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const key = toTrimmedString(value).toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  };
  if (Array.isArray(existing)) existing.forEach(push);
  (Array.isArray(incoming) ? incoming : []).forEach(push);
  return out;
}

/**
 * Mutate a frontmatter object in place with flattened publish status.
 * Intended to be called inside `fileManager.processFrontMatter`.
 * @param {Record<string, unknown>} frontmatter
 * @param {{ targets: PublishTargetInput[], requestedCount?: number, now?: string }} options
 * @returns {Record<string, unknown>}
 */
export function updatePublishFrontmatter(frontmatter, { targets, requestedCount, now } = { targets: [] }) {
  const fm = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const timestamp = toTrimmedString(now) || nowBeijingTimestamp();

  const normalized = (Array.isArray(targets) ? targets : [])
    .map((t) => buildPublishTarget(t, timestamp))
    .filter((t) => t !== null);

  if (normalized.length === 0) return fm; // never write an empty/false status

  const latest = normalized[normalized.length - 1];
  fm[FRONTMATTER_KEYS.platforms] = mergePlatformList(fm[FRONTMATTER_KEYS.platforms], normalized.map((t) => t.platform));
  fm[FRONTMATTER_KEYS.platform] = latest.platform;
  fm[FRONTMATTER_KEYS.kind] = latest.kind;
  fm[FRONTMATTER_KEYS.time] = timestamp;
  fm[FRONTMATTER_KEYS.status] = resolvePublishStatus(
    typeof requestedCount === 'number' ? requestedCount : normalized.length,
    normalized.length,
  );

  // Clean up nested/legacy keys from earlier versions for readability.
  for (const key of DEPRECATED_KEYS) {
    if (fm[key] !== undefined) delete fm[key];
  }
  return fm;
}
