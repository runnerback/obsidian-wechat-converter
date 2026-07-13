import type { Theme } from '../themeManager.ts';
import { EventEmitter } from 'events';

/**
 * 宿主插件接口(wechat-converter):rednote 设置存在宿主 settings.rednote
 * 命名空间下,随宿主 data.json 一起持久化,不再独占 loadData/saveData。
 */
interface HostPluginLike {
    settings: { rednote?: Partial<RedSettings> } & Record<string, unknown>;
    saveSettings: () => Promise<void>;
}

interface RedSettings {
    themeId: string;
    fontFamily: string;
    fontSize: number;
    backgroundId: string;
    themes: Theme[];      // 添加主题列表
    customThemes: Theme[]; // 添加自定义主题列表
    // 添加用户信息设置
    userAvatar: string;
    userName: string;
    notesTitle: string;
    userId: string;
    showTime: boolean;
    timeFormat: string;
    showFooter?: boolean;
    footerLeftText: string;
    footerRightText: string;
    headingLevel: 'h1' | 'h2'; // 标题级别选项
    customFonts: { value: string; label: string; isPreset?: boolean }[];  // 添加自定义字体配置
    backgroundSettings: {
        imageUrl: string;
        scale: number;
        position: { x: number; y: number };
    };
}

export const DEFAULT_SETTINGS: RedSettings = {
    themeId: 'default',
    fontFamily: 'Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, "PingFang SC"',
    fontSize: 16,
    backgroundId: '',
    themes: [],
    customThemes: [],
    // 修改默认用户信息
    userAvatar: '',  // 默认为空，提示用户上传
    userName: '夜半',
    notesTitle: '备忘录',
    userId: '@Yeban',
    showTime: true,
    timeFormat: 'zh-CN',
    headingLevel: 'h2', // 默认使用二级标题
    footerLeftText: '夜半过后，光明便启程',
    footerRightText: '欢迎关注公众号：夜半',
    customFonts: [
        {
            value: 'Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, "PingFang SC", Cambria, Cochin, Georgia, Times, "Times New Roman", serif',
            label: '默认字体',
            isPreset: true
        },
        {
            value: 'SimSun, "宋体", serif',
            label: '宋体',
            isPreset: true
        },
        {
            value: 'SimHei, "黑体", sans-serif',
            label: '黑体',
            isPreset: true
        },
        {
            value: 'KaiTi, "楷体", serif',
            label: '楷体',
            isPreset: true
        },
        {
            value: '"Microsoft YaHei", "微软雅黑", sans-serif',
            label: '雅黑',
            isPreset: true
        }
    ],
    backgroundSettings: {
        imageUrl: '',
        scale: 1,
        position: { x: 0, y: 0 }
    },
}

export class SettingsManager extends EventEmitter {
    private plugin: HostPluginLike;
    private settings: RedSettings;

    constructor(plugin: HostPluginLike) {
        super();
        this.plugin = plugin;
        this.settings = DEFAULT_SETTINGS;
    }

    async loadSettings() {
        // 从宿主 settings.rednote 命名空间读取(宿主已完成 data.json 加载)
        let savedData: Partial<RedSettings> = this.plugin.settings.rednote || {};

        // 预设主题以代码为准:已保存的预设按 id 刷新样式(保留用户的可见性
        // 开关),代码里新增的预设(如 memo)自动补进列表——否则老用户
        // data.json 里的主题快照永远不会出现新主题、也吃不到样式修订。
        const { templates } = await import('../templates/index.ts');
        const presets: Theme[] = Object.values(templates).map(theme => ({
            ...(theme as Theme),
            isPreset: true
        }));
        const savedThemes = savedData.themes || [];
        const presetById = new Map(presets.map(p => [p.id, p]));
        savedData.themes = [
            ...savedThemes.map(t => {
                const fresh = presetById.get(t.id);
                return t.isPreset !== false && fresh
                    ? { ...fresh, isVisible: t.isVisible }
                    : t;
            }),
            ...presets.filter(p => !savedThemes.some(t => t.id === p.id)),
        ];

        // 确保 customThemes 存在
        if (!savedData.customThemes) {
            savedData.customThemes = [];
        }

        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
    }

    // 主题相关方法
    getAllThemes(): Theme[] {
        return [...this.settings.themes, ...this.settings.customThemes];
    }

    // 新增：获取可见主题
    getVisibleThemes(): Theme[] {
        return this.getAllThemes().filter(theme => theme.isVisible !== false);
    }

    getTheme(themeId: string): Theme | undefined {
        return this.settings.themes.find(theme => theme.id === themeId) 
            || this.settings.customThemes.find(theme => theme.id === themeId);
    }

    async addCustomTheme(theme: Theme) {
        theme.isPreset = false;
        theme.isVisible = true;
        this.settings.customThemes.push(theme);
        await this.saveSettings();
        this.emit('theme-visibility-changed');
    }

    async updateTheme(themeId: string, updatedTheme: Partial<Theme>) {
        const presetThemeIndex = this.settings.themes.findIndex(t => t.id === themeId);
        if (presetThemeIndex !== -1) {
            if ('isVisible' in updatedTheme) {
                this.settings.themes[presetThemeIndex] = {
                    ...this.settings.themes[presetThemeIndex],
                    isVisible: updatedTheme.isVisible
                };
                await this.saveSettings();
                this.emit('theme-visibility-changed');
                return true;
            }
            return false;
        }

        const customThemeIndex = this.settings.customThemes.findIndex(t => t.id === themeId);
        if (customThemeIndex !== -1) {
            this.settings.customThemes[customThemeIndex] = {
                ...this.settings.customThemes[customThemeIndex],
                ...updatedTheme
            };
            await this.saveSettings();
            this.emit('theme-visibility-changed');
            return true;
        }
        
        return false;
    }

    async removeTheme(themeId: string): Promise<boolean> {
        const theme = this.getTheme(themeId);
        if (theme && !theme.isPreset) {
            this.settings.customThemes = this.settings.customThemes.filter(t => t.id !== themeId);
            if (this.settings.themeId === themeId) {
                this.settings.themeId = 'default';
            }
            await this.saveSettings();
            this.emit('theme-visibility-changed');
            return true;
        }
        return false;
    }

    async saveSettings() {
        // 写回宿主 settings.rednote 命名空间,随宿主 data.json 持久化
        this.plugin.settings.rednote = this.settings;
        await this.plugin.saveSettings();
    }

    getSettings(): RedSettings {
        return this.settings;
    }

    async updateSettings(settings: Partial<RedSettings>) {
        this.settings = { ...this.settings, ...settings };
        await this.saveSettings();
    }

    getFontOptions() {
        return this.settings.customFonts;
    }

    async addCustomFont(font: { value: string; label: string }) {
        this.settings.customFonts.push({ ...font, isPreset: false });
        await this.saveSettings();
    }

    async removeFont(value: string) {
        const font = this.settings.customFonts.find(f => f.value === value);
        if (font && !font.isPreset) {
            this.settings.customFonts = this.settings.customFonts.filter(f => f.value !== value);
            await this.saveSettings();
        }
    }

    async updateFont(oldValue: string, newFont: { value: string; label: string }) {
        const index = this.settings.customFonts.findIndex(f => f.value === oldValue);
        if (index !== -1 && !this.settings.customFonts[index].isPreset) {
            this.settings.customFonts[index] = { ...newFont, isPreset: false };
            await this.saveSettings();
        }
    }
}
