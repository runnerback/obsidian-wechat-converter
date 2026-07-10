import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadInputModule } = require('./helpers/input-module.cjs');
describe('AppleStylePlugin - openConverter title refresh', () => {
  let AppleStylePlugin;

  beforeEach(() => {
    vi.resetModules();
    AppleStylePlugin = loadInputModule().default;
  });

  it('should refresh stale converter leaf title to unified name', async () => {
    const plugin = new AppleStylePlugin();
    const setViewState = vi.fn().mockResolvedValue(undefined);
    const revealLeaf = vi.fn();
    const staleLeaf = {
      getViewState: vi.fn(() => ({
        type: 'apple-style-converter',
        state: {},
        icon: 'send',
        title: '微信排版转换',
      })),
      setViewState,
    };

    plugin.app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [staleLeaf]),
        revealLeaf,
      },
    };

    await plugin.openConverter();

    expect(setViewState).toHaveBeenCalledTimes(1);
    expect(setViewState).toHaveBeenCalledWith({
      type: 'apple-style-converter',
      state: {},
      icon: 'send',
      title: 'Content Studio',
      active: true,
    });
    expect(revealLeaf).toHaveBeenCalledWith(staleLeaf);
  });

  it('should not reset converter leaf when title is already up to date', async () => {
    const plugin = new AppleStylePlugin();
    const setViewState = vi.fn().mockResolvedValue(undefined);
    const revealLeaf = vi.fn();
    const freshLeaf = {
      getViewState: vi.fn(() => ({
        type: 'apple-style-converter',
        state: { keep: true },
        icon: 'send',
        title: 'Content Studio',
      })),
      setViewState,
    };

    plugin.app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [freshLeaf]),
        revealLeaf,
      },
    };

    await plugin.openConverter();

    expect(setViewState).not.toHaveBeenCalled();
    expect(revealLeaf).toHaveBeenCalledWith(freshLeaf);
  });

  it('should fallback to setActiveLeaf when revealLeaf is unavailable', async () => {
    const plugin = new AppleStylePlugin();
    const setActiveLeaf = vi.fn();
    const freshLeaf = {
      getViewState: vi.fn(() => ({
        type: 'apple-style-converter',
        state: { keep: true },
        icon: 'send',
        title: 'Content Studio',
      })),
      setViewState: vi.fn().mockResolvedValue(undefined),
    };

    plugin.app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [freshLeaf]),
        setActiveLeaf,
      },
    };

    await plugin.openConverter();

    expect(setActiveLeaf).toHaveBeenCalledWith(freshLeaf, { focus: true });
  });

  it('should migrate stale leaf titles during startup reconciliation', async () => {
    const plugin = new AppleStylePlugin();
    const staleLeafSetViewState = vi.fn().mockResolvedValue(undefined);
    const freshLeafSetViewState = vi.fn().mockResolvedValue(undefined);
    const staleLeaf = {
      getViewState: vi.fn(() => ({
        type: 'apple-style-converter',
        state: { from: 'restore' },
        icon: 'send',
        title: '微信排版转换',
      })),
      setViewState: staleLeafSetViewState,
    };
    const freshLeaf = {
      getViewState: vi.fn(() => ({
        type: 'apple-style-converter',
        state: { from: 'restore' },
        icon: 'send',
        title: 'Content Studio',
      })),
      setViewState: freshLeafSetViewState,
    };

    plugin.app = {
      workspace: {
        getLeavesOfType: vi.fn(() => [staleLeaf, freshLeaf]),
      },
    };

    await plugin.migrateLegacyConverterLeafTitles();

    expect(staleLeafSetViewState).toHaveBeenCalledTimes(1);
    expect(staleLeafSetViewState).toHaveBeenCalledWith({
      type: 'apple-style-converter',
      state: { from: 'restore' },
      icon: 'send',
      title: 'Content Studio',
      active: false,
    });
    expect(freshLeafSetViewState).not.toHaveBeenCalled();
  });
});
