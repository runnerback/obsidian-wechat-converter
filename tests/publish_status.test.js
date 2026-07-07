import { describe, it, expect } from 'vitest';
const {
  buildPublishTarget,
  mergePlatformList,
  resolvePublishStatus,
  updatePublishFrontmatter,
  formatBeijingTimestamp,
  formatBeijingIso,
  FRONTMATTER_KEYS,
  PUBLISH_STATUS_SYNCED,
  PUBLISH_STATUS_PARTIAL,
} = require('../services/publish-status');

describe('publish-status service', () => {
  describe('formatBeijingTimestamp', () => {
    it('renders Beijing wall time with ISO week + weekday, no offset suffix', () => {
      expect(formatBeijingTimestamp(new Date('2026-07-03T05:43:00.000Z'))).toBe('2026-07-03W27-5T13:43:00');
      expect(formatBeijingTimestamp(new Date('2026-07-03T23:30:00.000Z'))).toBe('2026-07-04W27-6T07:30:00');
      expect(formatBeijingTimestamp(new Date('2026-01-01T02:00:00.000Z'))).toBe('2026-01-01W1-4T10:00:00');
    });
  });

  describe('formatBeijingIso', () => {
    it('renders standard sortable ISO-8601 with +08:00 offset', () => {
      expect(formatBeijingIso(new Date('2026-07-03T05:43:00.000Z'))).toBe('2026-07-03T13:43:00+08:00');
      expect(formatBeijingIso(new Date('2026-07-03T23:30:00.000Z'))).toBe('2026-07-04T07:30:00+08:00');
    });
  });

  describe('buildPublishTarget', () => {
    it('normalizes platform to lowercase and defaults kind', () => {
      expect(buildPublishTarget({ platform: 'WeChat' }, '2026-07-03W27-5T13:00:00')).toEqual({
        platform: 'wechat',
        kind: 'draft',
        time: '2026-07-03W27-5T13:00:00',
      });
    });

    it('returns null when platform is missing', () => {
      expect(buildPublishTarget({ platform: '' }, 'now')).toBeNull();
      expect(buildPublishTarget({}, 'now')).toBeNull();
    });
  });

  describe('mergePlatformList', () => {
    it('unions and de-dupes platforms case-insensitively, preserving order', () => {
      expect(mergePlatformList(['wechat'], ['feishu', 'WeChat'])).toEqual(['wechat', 'feishu']);
      expect(mergePlatformList(undefined, ['zhihu'])).toEqual(['zhihu']);
      expect(mergePlatformList('garbage', ['wechat'])).toEqual(['wechat']);
    });
  });

  describe('resolvePublishStatus', () => {
    it('is synced only when every requested platform succeeded', () => {
      expect(resolvePublishStatus(2, 2)).toBe(PUBLISH_STATUS_SYNCED);
      expect(resolvePublishStatus(3, 2)).toBe(PUBLISH_STATUS_PARTIAL);
      expect(resolvePublishStatus(0, 0)).toBe(PUBLISH_STATUS_PARTIAL);
    });
  });

  describe('updatePublishFrontmatter', () => {
    it('writes flattened fields plus human + ISO timestamps from one instant', () => {
      const fm = {};
      updatePublishFrontmatter(fm, {
        targets: [{ platform: 'wechat', kind: 'draft', account: '主号' }],
        requestedCount: 1,
        date: new Date('2026-07-03T05:43:00.000Z'),
      });
      expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_SYNCED);
      expect(fm[FRONTMATTER_KEYS.platforms]).toEqual(['wechat']);
      expect(fm.platform_wechat).toBe(1);
      expect(fm.publish_platform).toBeUndefined();
      expect(fm[FRONTMATTER_KEYS.kind]).toBe('draft');
      expect(fm[FRONTMATTER_KEYS.time]).toBe('2026-07-03W27-5T13:43:00');
      expect(fm[FRONTMATTER_KEYS.at]).toBe('2026-07-03T13:43:00+08:00');
    });

    it('marks partial when not all requested platforms succeeded', () => {
      const fm = {};
      updatePublishFrontmatter(fm, { targets: [{ platform: 'zhihu' }], requestedCount: 3, date: new Date() });
      expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_PARTIAL);
    });

    it('accumulates platforms across actions and tracks the latest publish', () => {
      const fm = { title: 'keep-me' };
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, date: new Date('2026-07-01T00:00:00.000Z') });
      updatePublishFrontmatter(fm, { targets: [{ platform: 'feishu', kind: 'doc' }], requestedCount: 1, date: new Date('2026-07-02T00:00:00.000Z') });
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, date: new Date('2026-07-03T05:43:00.000Z') });
      expect(fm.title).toBe('keep-me');
      expect(fm[FRONTMATTER_KEYS.platforms]).toEqual(['wechat', 'feishu']);
      expect(fm.platform_wechat).toBe(1);
      expect(fm.platform_feishu).toBe(1);
      expect(fm[FRONTMATTER_KEYS.kind]).toBe('draft');
      expect(fm[FRONTMATTER_KEYS.time]).toBe('2026-07-03W27-5T13:43:00');
      expect(fm[FRONTMATTER_KEYS.at]).toBe('2026-07-03T13:43:00+08:00');
    });

    it('normalizes platform aliases: xiaohongshu → rednote (list + per-platform flag)', () => {
      const fm = { publish_platforms: ['wechat', 'xiaohongshu'] };
      updatePublishFrontmatter(fm, { targets: [{ platform: 'xiaohongshu' }], requestedCount: 1, date: new Date() });
      expect(fm[FRONTMATTER_KEYS.platforms]).toEqual(['wechat', 'rednote']);
      expect(fm.platform_rednote).toBe(1);
      expect(fm.platform_xiaohongshu).toBeUndefined();
    });

    it('cleans up legacy keys from earlier versions (incl. publish_platform)', () => {
      const fm = { publish_targets: [{ platform: 'x' }], last_publish_at: 'old', publish_platform: 'wechat' };
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, date: new Date() });
      expect(fm.publish_targets).toBeUndefined();
      expect(fm.last_publish_at).toBeUndefined();
      expect(fm.publish_platform).toBeUndefined();
    });

    it('is a no-op when there are no successful targets', () => {
      const fm = {};
      updatePublishFrontmatter(fm, { targets: [], requestedCount: 2, date: new Date() });
      expect(fm[FRONTMATTER_KEYS.status]).toBeUndefined();
      expect(fm[FRONTMATTER_KEYS.at]).toBeUndefined();
    });
  });
});
