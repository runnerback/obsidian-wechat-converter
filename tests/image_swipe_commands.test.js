import { describe, it, expect } from 'vitest';
const { loadInputModule } = require('./helpers/input-module.cjs');

const {
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
});
