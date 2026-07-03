// services/publish-status.js
//
// Pure helpers for recording per-note "publish status" into the note's
// YAML frontmatter after a successful 发布与分发 action.
//
// Design (confirmed with user):
// - English frontmatter keys.
// - Wording is "已同步/synced" (most flows create drafts, not public posts).
// - `publish_targets` is a CUMULATIVE list, de-duplicated by platform(+account):
//   re-publishing the same platform updates that entry's time/url in place
//   instead of appending duplicates.
// - `publish_status` reflects the completeness of the MOST RECENT action:
//   'synced' when every requested platform succeeded, otherwise 'partial'.
// - Only successful platforms are recorded. No filename / folder changes.

export const PUBLISH_STATUS_SYNCED = 'synced';
export const PUBLISH_STATUS_PARTIAL = 'partial';

export const FRONTMATTER_KEYS = Object.freeze({
  status: 'publish_status',
  targets: 'publish_targets',
  lastAt: 'last_publish_at',
});

/**
 * @typedef {{ platform: string, kind?: string, account?: string, url?: string, time?: string }} PublishTargetInput
 * @typedef {{ platform: string, kind: string, account?: string, url?: string, time: string }} PublishTargetEntry
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalize a raw target descriptor into a stable frontmatter entry.
 * Optional fields (account/url) are only included when present.
 * @param {PublishTargetInput} input
 * @param {string} [now] ISO timestamp fallback for `time`
 * @returns {PublishTargetEntry | null}
 */
export function buildPublishTarget(input, now) {
  const platform = toTrimmedString(input && input.platform).toLowerCase();
  if (!platform) return null;

  const kind = toTrimmedString(input && input.kind) || 'draft';
  const account = toTrimmedString(input && input.account);
  const url = toTrimmedString(input && input.url);
  const time = toTrimmedString(input && input.time) || toTrimmedString(now) || new Date().toISOString();

  /** @type {PublishTargetEntry} */
  const entry = { platform, kind, time };
  if (account) entry.account = account;
  if (url) entry.url = url;
  return entry;
}

/**
 * De-dup key for a target: platform (+ account when present).
 * @param {{ platform?: unknown, account?: unknown }} entry
 * @returns {string}
 */
function targetKey(entry) {
  const platform = toTrimmedString(entry && entry.platform).toLowerCase();
  const account = toTrimmedString(entry && entry.account);
  return account ? `${platform}::${account}` : platform;
}

/**
 * Coerce an unknown existing frontmatter value into an array of entries.
 * @param {unknown} value
 * @returns {PublishTargetEntry[]}
 */
function toExistingTargets(value) {
  if (!Array.isArray(value)) return [];
  /** @type {PublishTargetEntry[]} */
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const built = buildPublishTarget(/** @type {PublishTargetInput} */ (item), '');
    if (built) out.push(built);
  }
  return out;
}

/**
 * Cumulative merge: keep existing entries, update-in-place on matching key,
 * append new platforms. Latest wins for time/url/kind. Order preserved
 * (existing first, then newly-added platforms).
 * @param {unknown} existing
 * @param {PublishTargetEntry[]} incoming
 * @returns {PublishTargetEntry[]}
 */
export function mergePublishTargets(existing, incoming) {
  const merged = toExistingTargets(existing);
  const indexByKey = new Map();
  merged.forEach((entry, index) => indexByKey.set(targetKey(entry), index));

  for (const entry of Array.isArray(incoming) ? incoming : []) {
    if (!entry || !toTrimmedString(entry.platform)) continue;
    const key = targetKey(entry);
    if (indexByKey.has(key)) {
      merged[indexByKey.get(key)] = { ...merged[indexByKey.get(key)], ...entry };
    } else {
      indexByKey.set(key, merged.length);
      merged.push(entry);
    }
  }
  return merged;
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
 * Mutate a frontmatter object in place with the merged publish status.
 * Intended to be called inside Obsidian's `fileManager.processFrontMatter`.
 * Returns the same object for convenience/testing.
 * @param {Record<string, unknown>} frontmatter
 * @param {{ targets: PublishTargetInput[], requestedCount?: number, now?: string }} options
 * @returns {Record<string, unknown>}
 */
export function updatePublishFrontmatter(frontmatter, { targets, requestedCount, now } = { targets: [] }) {
  const fm = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const timestamp = toTrimmedString(now) || new Date().toISOString();

  const normalized = (Array.isArray(targets) ? targets : [])
    .map((t) => buildPublishTarget(t, timestamp))
    .filter((t) => t !== null);

  if (normalized.length === 0) return fm; // never write an empty/false status

  fm[FRONTMATTER_KEYS.targets] = mergePublishTargets(fm[FRONTMATTER_KEYS.targets], /** @type {PublishTargetEntry[]} */ (normalized));
  fm[FRONTMATTER_KEYS.status] = resolvePublishStatus(
    typeof requestedCount === 'number' ? requestedCount : normalized.length,
    normalized.length,
  );
  fm[FRONTMATTER_KEYS.lastAt] = timestamp;
  return fm;
}
