// 自 note-to-red 的 RedView(ItemView)改造为「嵌入式预览控制器」:
// 不再注册独立视图,而是挂载在 wechat-converter 预览区给定的容器里。
// 生命周期(事件注册/MarkdownRenderer component)委托给宿主视图。
//
// 交互统一改造:自带的 red-toolbar / red-bottom-bar 已移除,模板/主题/字体/
// 字号/背景图/下载等控件全部收编进宿主顶栏与「样式设置」悬浮层
// (views/settings-panel/rednote-settings-panel.js),通过本类的公开方法调用。
// 「锁定实时预览」概念一并移除,与公众号侧一致:始终实时渲染(防抖 500ms)。
import { App, Component, MarkdownRenderer, TFile, Notice } from 'obsidian';
import { RedConverter } from './converter.ts';
import { DownloadManager } from './downloadManager.ts';
import type { ThemeManager } from './themeManager.ts';
import type { SettingsManager } from './settings/settings.ts';
import { ClipboardManager } from './clipboardManager.ts';
import { ImgTemplateManager } from './imgTemplateManager.ts';
import { BackgroundSettingModal } from './modals/BackgroundSettingModal.ts';
import { BackgroundManager } from './backgroundManager.ts';
import { renderMemoHeader } from './memoHeader.ts';

export class RedPreviewController {
    // #region 属性定义
    private app: App;
    /** 宿主视图(ItemView):承接 registerEvent/register 与 Markdown 渲染 component */
    private hostComponent: Component & {
        registerEvent: (eventRef: unknown) => void;
        register: (cb: () => void) => void;
    };
    /** 挂载根容器(宿主预览区给定) */
    private rootEl: HTMLElement;

    private previewEl: HTMLElement;
    private currentFile: TFile | null = null;
    private updateTimer: number | null = null;
    private currentImageIndex: number = 0;
    /** 当前文档是否含有效图卡内容(标题分节);下载导出前校验 */
    private hasValidContent: boolean = false;
    private backgroundManager: BackgroundManager;

    private navigationButtons: {
        prev: HTMLButtonElement;
        next: HTMLButtonElement;
        indicator: HTMLElement;
    } | undefined;

    // 管理器实例
    private themeManager: ThemeManager;
    private settingsManager: SettingsManager;
    private imgTemplateManager: ImgTemplateManager;
    // #endregion

    // #region 基础视图方法
    constructor(
        app: App,
        hostComponent: RedPreviewController['hostComponent'],
        themeManager: ThemeManager,
        settingsManager: SettingsManager
    ) {
        this.app = app;
        this.hostComponent = hostComponent;
        this.themeManager = themeManager;
        this.settingsManager = settingsManager;
        this.backgroundManager = new BackgroundManager();
        this.imgTemplateManager = new ImgTemplateManager(
            this.settingsManager,
            this.updatePreview.bind(this),
            this.themeManager
        );

    }
    // #endregion

    // #region 视图初始化
    /** 挂载到宿主提供的容器(原 onOpen) */
    async mount(container: HTMLElement) {
        this.rootEl = container;
        container.empty();
        container.classList.add('red-view-content');

        this.initializePreviewArea(container);
        this.initializeEventListeners();
        this.applyPersistedSettings();

        const currentFile = this.app.workspace.getActiveFile();
        await this.onFileOpen(currentFile);
    }

    /** 卸载(宿主切走预览模式时调用) */
    unmount() {
        if (this.updateTimer) {
            window.clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (this.rootEl) {
            this.rootEl.empty();
            this.rootEl.classList.remove('red-view-content');
        }
    }

    /** 当前预览根节点(发布链路导出图卡用) */
    getPreviewEl(): HTMLElement | null {
        return this.previewEl || null;
    }

    private initializePreviewArea(container: HTMLElement) {
        const wrapper = container.createEl('div', { cls: 'red-preview-wrapper' });
        this.previewEl = wrapper.createEl('div', { cls: 'red-preview-container' });

        // 创建导航容器
        const navContainer = wrapper.createEl('div', { cls: 'red-nav-container' });

        const prevButton = navContainer.createEl('button', {
            cls: 'red-nav-button',
            text: '←'
        });

        const indicator = navContainer.createEl('span', {
            cls: 'red-page-indicator',
            text: '1/1'
        });

        const nextButton = navContainer.createEl('button', {
            cls: 'red-nav-button',
            text: '→'
        });

        this.navigationButtons = { prev: prevButton, next: nextButton, indicator };

        prevButton.addEventListener('click', () => this.navigateImages('prev'));
        nextButton.addEventListener('click', () => this.navigateImages('next'));
    }

    private updateNavigationState() {
        const sections = this.previewEl.querySelectorAll('.red-content-section');
        if (!this.navigationButtons) return;

        sections.forEach((section, i) => {
            (section as HTMLElement).classList.toggle('red-section-active', i === this.currentImageIndex);
        });

        this.navigationButtons.prev.classList.toggle('red-nav-hidden', this.currentImageIndex === 0);
        this.navigationButtons.next.classList.toggle('red-nav-hidden', this.currentImageIndex === sections.length - 1);
        this.navigationButtons.indicator.textContent = `${this.currentImageIndex + 1}/${sections.length}`;
    }

    private navigateImages(direction: 'prev' | 'next') {
        const sections = this.previewEl.querySelectorAll('.red-content-section');
        if (direction === 'prev' && this.currentImageIndex > 0) {
            this.currentImageIndex--;
        } else if (direction === 'next' && this.currentImageIndex < sections.length - 1) {
            this.currentImageIndex++;
        }
        this.updateNavigationState();
    }

    private initializeEventListeners() {
        this.hostComponent.registerEvent(
            this.app.workspace.on('file-open', this.onFileOpen.bind(this))
        );
        this.hostComponent.registerEvent(
            this.app.vault.on('modify', this.onFileModify.bind(this))
        );
        this.initializeCopyButtonListener();
    }

    private initializeCopyButtonListener() {
        const copyButtonHandler = async (e: CustomEvent) => {
            const { copyButton } = e.detail;
            if (copyButton) {
                copyButton.addEventListener('click', async () => {
                    copyButton.disabled = true;
                    try {
                        await ClipboardManager.copyImageToClipboard(this.previewEl);
                        new Notice('图片已复制到剪贴板');
                    } catch (error) {
                        new Notice('复制失败');
                        console.error('复制图片失败:', error);
                    } finally {
                        setTimeout(() => {
                            copyButton.disabled = false;
                        }, 1000);
                    }
                });
            }
        };

        this.rootEl.addEventListener('copy-button-added', copyButtonHandler as EventListener);
        this.hostComponent.register(() => {
            this.rootEl.removeEventListener('copy-button-added', copyButtonHandler as EventListener);
        });
    }
    // #endregion

    // #region 设置管理
    /** 挂载时把持久化设置回放到各管理器(原 restoreSettings 去掉控件 DOM 部分) */
    private applyPersistedSettings() {
        const settings = this.settingsManager.getSettings();

        if (settings.themeId) {
            this.themeManager.setCurrentTheme(settings.themeId);
        }
        if (settings.fontFamily) {
            this.themeManager.setFont(settings.fontFamily);
        }
        if (settings.fontSize) {
            this.themeManager.setFontSize(settings.fontSize);
        }
    }
    // #endregion

    // #region 宿主控件接口(顶栏 + 样式设置悬浮层调用)
    getThemeOptions() {
        const templates = this.settingsManager.getVisibleThemes();
        return templates.length > 0
            ? templates.map(t => ({ value: t.id, label: t.name }))
            : [{ value: 'default', label: '默认主题' }];
    }

    getFontOptions() {
        return this.settingsManager.getFontOptions();
    }

    getSettings() {
        return this.settingsManager.getSettings();
    }

    async setTheme(value: string) {
        this.themeManager.setCurrentTheme(value);
        await this.settingsManager.updateSettings({ themeId: value });
        // 全量重渲染而非仅刷样式:memo 主题带专属头部 DOM,切入/切出都要重建
        await this.updatePreview();
    }

    async setFont(value: string) {
        this.themeManager.setFont(value);
        await this.settingsManager.updateSettings({ fontFamily: value });
        this.themeManager.applyTheme(this.previewEl);
    }

    async setFontSize(size: number) {
        this.themeManager.setFontSize(size);
        await this.settingsManager.updateSettings({ fontSize: size });
        this.themeManager.applyTheme(this.previewEl);
    }

    /** 下载当前页图卡;无有效内容时抛错由宿主提示 */
    async downloadCurrentPage() {
        this.ensureExportReady();
        await DownloadManager.downloadSingleImage(this.previewEl);
    }

    /** 批量导出全部页图卡;无有效内容时抛错由宿主提示 */
    async downloadAllPages() {
        this.ensureExportReady();
        await DownloadManager.downloadAllImages(this.previewEl);
    }

    private ensureExportReady() {
        if (!this.hasValidContent) {
            throw new Error('请先添加一级标题内容');
        }
    }

    openBackgroundModal() {
        const currentSettings = this.settingsManager.getSettings().backgroundSettings;
        new BackgroundSettingModal(
            this.app,
            async (backgroundSettings) => {
                await this.settingsManager.updateSettings({ backgroundSettings });
                const imagePreview = this.previewEl.querySelector('.red-image-preview') as HTMLElement;
                this.backgroundManager.applyBackgroundStyles(
                    imagePreview,
                    backgroundSettings
                );
            },
            this.previewEl,
            this.backgroundManager,
            currentSettings
        ).open();
    }

    /** 悬浮层底部「使用指南」文案(随标题分割级别设置变化) */
    getUsageGuideText(): string {
        const headingLevel = this.settingsManager.getSettings().headingLevel || 'h1';
        const heading = headingLevel === 'h1' ? '一级标题(#)' : '二级标题(##)';
        return `1. 核心用法：用${heading}来分割内容，每个标题生成一张小红书配图
2. 内容分页：在${heading}下使用 --- 可将内容分割为多页，每页都会带上标题
3. 首图制作：单独调整首节字号至20-24px，用顶栏下载菜单的【下载当前页】导出
4. 长文优化：内容较多的章节可调小字号至14-16px后单独导出
5. 批量操作：保持统一字号时，用【导出全部页】批量生成
6. 主题切换：在本面板切换不同视觉风格(含 iOS 备忘录风)`;
    }
    // #endregion

    // #region 预览更新
    private async updatePreview() {
        if (!this.currentFile) return;
        this.previewEl.empty();

        const content = await this.app.vault.cachedRead(this.currentFile);
        await MarkdownRenderer.render(
            this.app,
            content,
            this.previewEl,
            this.currentFile.path,
            this
        );

        RedConverter.formatContent(this.previewEl);
        const hasValidContent = RedConverter.hasValidContent(this.previewEl);

        if (hasValidContent) {
            const settings = this.settingsManager.getSettings();
            // 应用当前模板(头部/页脚 DOM + 主题样式)
            this.imgTemplateManager.applyTemplate(this.previewEl, settings);
            // memo(iOS 备忘录)主题带专属头部,替换默认的用户信息头部;
            // 卡片挂 red-memo-paper 类叠加纸张颗粒纹理(data URI 含冒号,
            // 无法写进主题 inline 样式——applyTheme 的解析器按冒号切分)
            if (settings.themeId === 'memo') {
                const header = this.previewEl.querySelector('.red-preview-header');
                if (header) {
                    renderMemoHeader(header as HTMLElement, settings);
                }
                this.previewEl.querySelector('.red-image-preview')?.classList.add('red-memo-paper');
            }
            // 应用当前背景设置
            if (settings.backgroundSettings.imageUrl) {
                const previewContainer = this.previewEl.querySelector('.red-image-preview');
                if (previewContainer) {
                    this.backgroundManager.applyBackgroundStyles(previewContainer as HTMLElement, settings.backgroundSettings);
                }
            }
        }

        this.hasValidContent = hasValidContent;
        this.updateNavigationState();
    }
    // #endregion

    // #region 文件处理
    async onFileOpen(file: TFile | null) {
        this.currentFile = file;
        this.currentImageIndex = 0;

        if (!file || file.extension !== 'md') {
            this.previewEl.empty();
            this.previewEl.createEl('div', {
                text: '只能预览 markdown 文本文档',
                cls: 'red-empty-state'
            });
            this.hasValidContent = false;
            return;
        }

        await this.updatePreview();
    }

    async onFileModify(file: TFile) {
        if (file === this.currentFile) {
            if (this.updateTimer) {
                window.clearTimeout(this.updateTimer);
            }
            this.updateTimer = window.setTimeout(() => {
                this.updatePreview();
            }, 500);
        }
    }
    // #endregion

}
