// rednote 宿主接口:替代原 note-to-red 的 RedPlugin(main.ts 未随迁移复制)。
// wechat-converter 侧只需在自己的 plugin 实例上挂 settingsManager / themeManager
// 两个 rednote 管理器,即可满足 converter / SettingTab / CreateThemeModal 的依赖。
// 注意:本文件只含类型(interface 无运行时值),使用方必须 import type。
import type { SettingsManager } from './settings/settings.ts';
import type { ThemeManager } from './themeManager.ts';

export interface RednoteHost {
    settingsManager: SettingsManager;
    themeManager: ThemeManager;
}
