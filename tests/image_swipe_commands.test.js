import { describe, it, expect } from 'vitest';
const { loadInputModule } = require('./helpers/input-module.cjs');

const {
  default: AppleStylePlugin,
  createImageSwipeCalloutMarkdown,
  getImageSwipeCommandCopy,
} = loadInputModule();

describe('Image swipe editor commands', () => {
  it('should wrap selected images in an image-swipe callout', () => {
    const selected = [
      '![[png1.png]]',
      '![[png2.png]]',
    ].join('\n');

    const markdown = createImageSwipeCalloutMarkdown('image-swipe', selected, {
      vault: { getConfig: () => 'zh-CN' },
    });

    expect(markdown).toBe([
      '> [!image-swipe] 左右滑动查看图片',
      '> ![[png1.png]]',
      '> ![[png2.png]]',
    ].join('\n'));
  });

  it('should insert an image-sensitive template when nothing is selected', () => {
    const markdown = createImageSwipeCalloutMarkdown('image-sensitive', '', {
      vault: { getConfig: () => 'zh-CN' },
    });

    expect(markdown).toContain('> [!image-sensitive] 此类图片可能引发不适，向左滑动查看');
    expect(markdown).toContain('> ![[图片1.png]]');
    expect(markdown).toContain('> ![[图片2.png]]');
  });

  it('should expose Chinese command names so the command palette can find image swipe actions', () => {
    const imageCopy = getImageSwipeCommandCopy({
      vault: { getConfig: () => 'en' },
    }, 'image-swipe');
    const sensitiveCopy = getImageSwipeCommandCopy({
      vault: { getConfig: () => 'en' },
    }, 'image-sensitive');

    expect(imageCopy.name).toBe('插入横滑图片块');
    expect(sensitiveCopy.name).toBe('插入横滑敏感图片块');
  });

  it('should keep generated templates localized for non-Chinese Obsidian locales', () => {
    const markdown = createImageSwipeCalloutMarkdown('image-swipe', '', {
      vault: { getConfig: () => 'en' },
    });

    expect(markdown).toContain('> [!image-swipe] Swipe to view images');
    expect(markdown).toContain('> ![[image-1.png]]');
    expect(markdown).toContain('> ![[image-2.png]]');
  });

  it('should register image swipe commands as always-visible command palette actions', async () => {
    const commands = [];
    const editor = {
      getSelection: () => '![[a.png]]\n![[b.png]]',
      replaceSelection: (value) => {
        editor.inserted = value;
      },
    };
    const plugin = new AppleStylePlugin();
    plugin.app = {
      vault: { getConfig: () => 'zh-CN' },
      workspace: {
        getActiveViewOfType: () => ({ editor }),
        getLeavesOfType: () => [],
        onLayoutReady: () => {},
      },
    };
    plugin.loadData = async () => ({});
    plugin.saveData = async () => {};
    plugin.registerView = () => {};
    plugin.addRibbonIcon = () => {};
    plugin.addCommand = (command) => commands.push(command);
    plugin.addSettingTab = () => {};
    plugin.startWechatSyncBridgeInBackground = () => {};

    await plugin.onload();

    const imageCommand = commands.find((command) => command.id === 'insert-image-swipe-block');
    const sensitiveCommand = commands.find((command) => command.id === 'insert-image-sensitive-block');

    expect(imageCommand?.name).toBe('插入横滑图片块');
    expect(sensitiveCommand?.name).toBe('插入横滑敏感图片块');
    expect(typeof imageCommand?.callback).toBe('function');
    expect(imageCommand?.editorCallback).toBeUndefined();

    imageCommand.callback();

    expect(editor.inserted).toContain('> [!image-swipe] 左右滑动查看图片');
    expect(editor.inserted).toContain('> ![[a.png]]');
  });
});
