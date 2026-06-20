import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/feishu-sync.js', () => ({
  syncNoteToFeishu: vi.fn(),
}));

const obsidian = require('obsidian');
const { __applyExtensions: applyExtensions } = obsidian;
const { syncNoteToFeishu } = await import('../services/feishu-sync.js');
const { renderFeishuPublishTab } = await import('../views/publish-modal/feishu.js');

class TestSetting {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.settingEl = applyExtensions(document.createElement('div'));
    this.settingEl.addClass('setting-item');
    containerEl.appendChild(this.settingEl);
  }

  setName(name) {
    this.settingEl.createEl('div', { text: name, cls: 'setting-item-name' });
    return this;
  }

  setDesc(desc) {
    this.settingEl.createEl('div', { text: desc, cls: 'setting-item-description' });
    return this;
  }

  addText(callback) {
    const input = applyExtensions(document.createElement('input'));
    this.settingEl.appendChild(input);
    const control = {
      setPlaceholder(value) {
        input.setAttribute('placeholder', String(value || ''));
        return control;
      },
      setValue(value) {
        input.value = String(value || '');
        return control;
      },
      onChange(handler) {
        input.oninput = () => handler(input.value);
        return control;
      },
    };
    callback(control);
    return this;
  }
}

class TestNotice {
  constructor(message = '', duration = 0) {
    this.message = message;
    this.duration = duration;
    this.hidden = false;
    globalThis.__feishuPublishNotices.push(this);
  }

  setMessage(message) {
    this.message = message;
  }

  hide() {
    this.hidden = true;
  }
}

function makeView() {
  const plugin = {
    settings: {
      feishuSync: {
        enabled: true,
        appId: 'app-id',
        appSecret: 'app-secret',
        folderToken: 'folder-token',
        userId: 'ou-user',
        uploadHistory: [],
      },
    },
    saveSettings: vi.fn(),
    openExternalUrl: vi.fn(),
  };

  return {
    plugin,
    app: {
      vault: {
        read: vi.fn(async () => '# Feishu Test'),
      },
    },
    getPublishContextFile: vi.fn(() => ({
      path: 'notes/feishu-test.md',
      basename: '飞书测试',
    })),
    showSyncModal: vi.fn(),
    showMultiPlatformSyncModal: vi.fn(),
    openPluginSettings: vi.fn(),
  };
}

describe('Feishu publish modal UX', () => {
  beforeEach(() => {
    globalThis.__feishuPublishNotices = [];
    syncNoteToFeishu.mockReset();
    navigator.clipboard = {
      writeText: vi.fn(async () => undefined),
    };
  });

  it('uses Notice for in-progress updates and renders one clean result action area', async () => {
    syncNoteToFeishu.mockImplementation(async ({ onProgress }) => {
      onProgress('importing', '正在导入为飞书云文档...');
      return {
        title: '飞书测试',
        url: 'https://feishu.cn/docx/doc-token',
        docToken: 'doc-token',
        transferOwnerWarning: 'field_validation failed: very long raw api message',
        imageSummary: {
          uploaded: 1,
          skipped: 2,
          failed: 0,
          details: [],
        },
      };
    });

    const view = makeView();
    const modal = { close: vi.fn() };
    const containerEl = applyExtensions(document.createElement('div'));

    renderFeishuPublishTab(view, modal, containerEl, {
      obsidianApi: {
        Setting: TestSetting,
        Notice: TestNotice,
        requestUrl: vi.fn(),
      },
    });

    const syncBtn = Array.from(containerEl.querySelectorAll('button'))
      .find((button) => button.textContent === '同步至飞书');
    await syncBtn.onclick();

    expect(globalThis.__feishuPublishNotices[0].message).toBe('正在导入为飞书云文档...');
    expect(globalThis.__feishuPublishNotices[0].hidden).toBe(true);
    expect(containerEl.querySelector('.wechat-feishu-progress')).toBeNull();

    const resultCard = containerEl.querySelector('.wechat-feishu-result-card');
    expect(resultCard.classList.contains('is-hidden')).toBe(false);
    expect(resultCard.textContent).toContain('同步完成');
    expect(resultCard.textContent).toContain('所有权转移未完成');
    expect(resultCard.textContent).toContain('有 2 张本地图片未处理');
    expect(resultCard.textContent).not.toContain('field_validation failed');
    expect(resultCard.textContent).not.toContain('飞书链接:');
    expect(resultCard.querySelector('a')).toBeNull();

    const actionButtons = Array.from(resultCard.querySelectorAll('button')).map((button) => button.textContent);
    expect(actionButtons).toEqual(['在浏览器中打开', '复制链接']);
  });
});
