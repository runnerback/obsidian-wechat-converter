import { describe, it, expect } from 'vitest';
const {
  buildPublishTarget,
  mergePlatformList,
  resolvePublishStatus,
  updatePublishFrontmatter,
  formatBeijingTimestamp,
  FRONTMATTER_KEYS,
  PUBLISH_STATUS_SYNCED,
  PUBLISH_STATUS_PARTIAL,
} = require('../services/publish-status');

describe('publish-status service', () => {
  describe('formatBeijingTimestamp', () => {
    it('renders Beijing wall time with ISO week + weekday, no offset suffix', () => {
      // 2026-07-03 is a Friday (weekday 5), ISO week 27
      expect(formatBeijingTimestamp(new Date('2026-07-03T05:43:00.000Z'))).toBe('2026-07-03W27-5T13:43:00');
      // crosses date boundary -> next day, Saturday (6)
      expect(formatBeijingTimestamp(new Date('2026-07-03T23:30:00.000Z'))).toBe('2026-07-04W27-6T07:30:00');
      // Jan 1 2026 is a Thursday (4), ISO week 1
      expect(formatBeijingTimestamp(new Date('2026-01-01T02:00:00.000Z'))).toBe('2026-01-01W1-4T10:00:00');
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
    it('writes flattened English fields for the latest publish', () => {
      const fm = {};
      updatePublishFrontmatter(fm, {
        targets: [{ platform: 'wechat', kind: 'draft', account: '主号' }],
        requestedCount: 1,
        now: '2026-07-03W27-5T13:00:00',
      });
      expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_SYNCED);
      expect(fm[FRONTMATTER_KEYS.platforms]).toEqual(['wechat']);
      expect(fm[FRONTMATTER_KEYS.platform]).toBe('wechat');
      expect(fm[FRONTMATTER_KEYS.kind]).toBe('draft');
      expect(fm[FRONTMATTER_KEYS.time]).toBe('2026-07-03W27-5T13:00:00');
    });

    it('marks partial when not all requested platforms succeeded', () => {
      const fm = {};
      updatePublishFrontmatter(fm, { targets: [{ platform: 'zhihu' }], requestedCount: 3, now: 'n' });
      expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_PARTIAL);
    });

    it('accumulates platforms across actions and tracks the latest publish', () => {
      const fm = { title: 'keep-me' };
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, now: 't1' });
      updatePublishFrontmatter(fm, { targets: [{ platform: 'feishu', kind: 'doc' }], requestedCount: 1, now: 't2' });
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, now: 't3' });
      expect(fm.title).toBe('keep-me');
      expect(fm[FRONTMATTER_KEYS.platforms]).toEqual(['wechat', 'feishu']);
      expect(fm[FRONTMATTER_KEYS.platform]).toBe('wechat');
      expect(fm[FRONTMATTER_KEYS.kind]).toBe('draft');
      expect(fm[FRONTMATTER_KEYS.time]).toBe('t3');
    });

    it('cleans up legacy nested keys from earlier versions', () => {
      const fm = { publish_targets: [{ platform: 'x' }], last_publish_at: 'old' };
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, now: 't' });
      expect(fm.publish_targets).toBeUndefined();
      expect(fm.last_publish_at).toBeUndefined();
    });

    it('is a no-op when there are no successful targets', () => {
      const fm = {};
      updatePublishFrontmatter(fm, { targets: [], requestedCount: 2, now: 'n' });
      expect(fm[FRONTMATTER_KEYS.status]).toBeUndefined();
      expect(fm[FRONTMATTER_KEYS.platform]).toBeUndefined();
    });
  });
});
