import { describe, it, expect } from 'vitest';
const {
  buildPublishTarget,
  mergePublishTargets,
  resolvePublishStatus,
  updatePublishFrontmatter,
  FRONTMATTER_KEYS,
  PUBLISH_STATUS_SYNCED,
  PUBLISH_STATUS_PARTIAL,
} = require('../services/publish-status');

describe('publish-status service', () => {
  describe('buildPublishTarget', () => {
    it('normalizes platform to lowercase and defaults kind/time', () => {
      const entry = buildPublishTarget({ platform: 'WeChat' }, '2026-07-03T00:00:00.000Z');
      expect(entry).toEqual({ platform: 'wechat', kind: 'draft', time: '2026-07-03T00:00:00.000Z' });
    });

    it('includes optional account/url only when present', () => {
      const entry = buildPublishTarget(
        { platform: 'feishu', kind: 'doc', url: 'https://x', account: '主号' },
        '2026-07-03T00:00:00.000Z',
      );
      expect(entry).toEqual({
        platform: 'feishu',
        kind: 'doc',
        account: '主号',
        url: 'https://x',
        time: '2026-07-03T00:00:00.000Z',
      });
    });

    it('returns null when platform is missing', () => {
      expect(buildPublishTarget({ platform: '' }, 'now')).toBeNull();
      expect(buildPublishTarget({}, 'now')).toBeNull();
    });
  });

  describe('mergePublishTargets', () => {
    it('appends new platforms and preserves order', () => {
      const existing = [{ platform: 'wechat', kind: 'draft', time: 't1' }];
      const merged = mergePublishTargets(existing, [{ platform: 'zhihu', kind: 'draft', time: 't2' }]);
      expect(merged.map((e) => e.platform)).toEqual(['wechat', 'zhihu']);
    });

    it('updates the same platform in place (latest wins), no duplicates', () => {
      const existing = [{ platform: 'wechat', kind: 'draft', time: 't1' }];
      const merged = mergePublishTargets(existing, [{ platform: 'wechat', kind: 'draft', time: 't2', url: 'u2' }]);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({ platform: 'wechat', time: 't2', url: 'u2' });
    });

    it('dedupes by platform + account', () => {
      const existing = [{ platform: 'wechat', account: 'A', time: 't1' }];
      const merged = mergePublishTargets(existing, [
        { platform: 'wechat', account: 'B', time: 't2' },
        { platform: 'wechat', account: 'A', time: 't3' },
      ]);
      expect(merged).toHaveLength(2);
      expect(merged.find((e) => e.account === 'A').time).toBe('t3');
    });

    it('tolerates a non-array existing value', () => {
      expect(mergePublishTargets(undefined, [{ platform: 'wechat', time: 't' }])).toHaveLength(1);
      expect(mergePublishTargets('garbage', [{ platform: 'wechat', time: 't' }])).toHaveLength(1);
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
    it('writes status/targets/last_publish_at with English keys', () => {
      const fm = {};
      updatePublishFrontmatter(fm, {
        targets: [{ platform: 'wechat', kind: 'draft', account: '主号' }],
        requestedCount: 1,
        now: '2026-07-03T01:00:00.000Z',
      });
      expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_SYNCED);
      expect(fm[FRONTMATTER_KEYS.lastAt]).toBe('2026-07-03T01:00:00.000Z');
      expect(fm[FRONTMATTER_KEYS.targets]).toEqual([
        { platform: 'wechat', kind: 'draft', account: '主号', time: '2026-07-03T01:00:00.000Z' },
      ]);
    });

    it('marks partial when not all requested platforms succeeded', () => {
      const fm = {};
      updatePublishFrontmatter(fm, {
        targets: [{ platform: 'zhihu' }],
        requestedCount: 3,
        now: 'n',
      });
      expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_PARTIAL);
    });

    it('accumulates across multiple publish actions without duplicating', () => {
      const fm = { title: 'keep-me' };
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, now: 't1' });
      updatePublishFrontmatter(fm, { targets: [{ platform: 'feishu', kind: 'doc', url: 'u' }], requestedCount: 1, now: 't2' });
      updatePublishFrontmatter(fm, { targets: [{ platform: 'wechat' }], requestedCount: 1, now: 't3' });
      expect(fm.title).toBe('keep-me');
      const targets = fm[FRONTMATTER_KEYS.targets];
      expect(targets.map((e) => e.platform)).toEqual(['wechat', 'feishu']);
      expect(targets.find((e) => e.platform === 'wechat').time).toBe('t3');
      expect(fm[FRONTMATTER_KEYS.lastAt]).toBe('t3');
    });

    it('is a no-op when there are no successful targets', () => {
      const fm = {};
      updatePublishFrontmatter(fm, { targets: [], requestedCount: 2, now: 'n' });
      expect(fm[FRONTMATTER_KEYS.status]).toBeUndefined();
      expect(fm[FRONTMATTER_KEYS.targets]).toBeUndefined();
    });
  });
});
