// rednote 模块出口(自 note-to-red 全量移植,原插件保留独立使用)。
// 宿主(wechat-converter 的 Plugin)通过 createRednoteManagers 初始化
// 设置/主题两个核心管理器;视图层(预览/导出)与设置 UI 由宿主接线。
import type { App } from 'obsidian';
import { SettingsManager } from './settings/settings.ts';
import { ThemeManager } from './themeManager.ts';
import { RedConverter } from './converter.ts';

export { SettingsManager } from './settings/settings.ts';
export { ThemeManager } from './themeManager.ts';
export type { Theme } from './themeManager.ts';
export { RedConverter } from './converter.ts';
export { DownloadManager } from './downloadManager.ts';
export { ClipboardManager } from './clipboardManager.ts';
export { ImgTemplateManager } from './imgTemplateManager.ts';
export { BackgroundManager } from './backgroundManager.ts';
export { RedSettingTab } from './settings/SettingTab.ts';
export type { RednoteHost } from './host.ts';

/**
 * 宿主 plugin 需满足:settings(含 rednote 命名空间)+ saveSettings()。
 * 返回的 managers 请挂在宿主 plugin 上(settingsManager / themeManager),
 * 供 SettingTab / CreateThemeModal / 预览层复用。
 */
export async function createRednoteManagers(app: App, hostPlugin: {
    settings: Record<string, unknown>;
    saveSettings: () => Promise<void>;
}) {
    const settingsManager = new SettingsManager(hostPlugin as never);
    await settingsManager.loadSettings();
    const themeManager = new ThemeManager(app, settingsManager);
    // RedConverter 是静态类:初始化一次,渲染 HTML 时按 host(themeManager)取样式
    RedConverter.initialize(app, { settingsManager, themeManager } as never);
    return { settingsManager, themeManager };
}
