import { describe, it, expect, vi } from 'vitest';

const {
  DRAFT_CACHE_VERSION,
  createEmptyDraftCache,
  normalizeDraftCache,
  getDraftAssociation,
  setDraftAssociation,
  clearDraftAssociation,
} = require('../services/wechat-draft-cache');

describe('wechat draft cache', () => {
  it('creates the versioned empty cache shape', () => {
    expect(createEmptyDraftCache()).toEqual({
      version: DRAFT_CACHE_VERSION,
      articles: {},
    });
  });

  it('normalizes legacy flat cache entries', () => {
    const { cache, changed } = normalizeDraftCache({
      'folder\\note.md': {
        mediaId: ' media-1 ',
        accountId: 'acc-1',
        title: 'Note',
        updatedAt: 100,
      },
    });

    expect(changed).toBe(true);
    expect(cache.articles['folder/note.md']).toEqual({
      sourcePath: 'folder/note.md',
      mediaId: 'media-1',
      accountId: 'acc-1',
      title: 'Note',
      index: 0,
      updatedAt: 100,
    });
  });

  it('drops invalid entries while keeping valid ones', () => {
    const { cache, changed } = normalizeDraftCache({
      version: DRAFT_CACHE_VERSION,
      articles: {
        'ok.md': { mediaId: 'media-ok', accountId: 'acc' },
        'bad.md': { accountId: 'acc' },
      },
    });

    expect(changed).toBe(true);
    expect(Object.keys(cache.articles)).toEqual(['ok.md']);
  });

  it('returns associations only for the matching account', () => {
    const settings = {
      draftCache: {
        version: DRAFT_CACHE_VERSION,
        articles: {
          'note.md': {
            sourcePath: 'note.md',
            mediaId: 'media-1',
            accountId: 'acc-1',
            title: 'Note',
            index: 0,
            updatedAt: 100,
          },
        },
      },
    };

    expect(getDraftAssociation(settings, 'note.md', 'acc-1')?.mediaId).toBe('media-1');
    expect(getDraftAssociation(settings, 'note.md', 'acc-2')).toBeNull();
  });

  it('sets and clears associations in place', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const settings = {};

    setDraftAssociation(settings, {
      sourcePath: '/folder/note.md',
      mediaId: 'media-1',
      accountId: 'acc-1',
      title: 'Note',
    });

    expect(settings.draftCache.articles['folder/note.md']).toMatchObject({
      mediaId: 'media-1',
      accountId: 'acc-1',
      title: 'Note',
      updatedAt: 1234,
    });

    clearDraftAssociation(settings, 'folder/note.md');
    expect(settings.draftCache.articles).toEqual({});
    Date.now.mockRestore();
  });
});
