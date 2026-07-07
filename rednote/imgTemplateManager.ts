import { DefaultTemplate } from './imgTelplate/defaultTemplate.ts';
import { NotesTemplate } from './imgTelplate/notesTemplate.ts';
import type { SettingsManager } from './settings/settings.ts';
import type { ThemeManager } from './themeManager.ts';
export interface ImgTemplate {
    id: string;
    name: string;
    sections: {
        header?: boolean;
        content: true;
        footer?: boolean;
    };
    render: (element: HTMLElement, settings: any) => void;
}

export class ImgTemplateManager {
    private templates: ImgTemplate[] = [];
    private currentTemplate: ImgTemplate | null = null;

    // 参数属性已展开为显式字段:Node strip-only TS 加载器不支持
    // constructor(private x) 语法(测试链路会用到)。行为等价。
    private settingsManager: SettingsManager;
    private onSettingsUpdate: () => Promise<void>;
    private themeManager: ThemeManager;

    constructor(
        settingsManager: SettingsManager,
        onSettingsUpdate: () => Promise<void>,
        themeManager: ThemeManager
    ) {
        this.settingsManager = settingsManager;
        this.onSettingsUpdate = onSettingsUpdate;
        this.themeManager = themeManager;
        this.initializeTemplates();
    }

    private initializeTemplates() {
        // 注册默认模板
        this.registerTemplate(new DefaultTemplate(this.settingsManager, this.onSettingsUpdate));

        // 注册现代模板
        this.registerTemplate(new NotesTemplate(this.settingsManager, this.onSettingsUpdate));
    }

    registerTemplate(template: ImgTemplate) {
        this.templates.push(template);
    }

    getImgTemplateOptions() {
        return this.templates.map(t => ({
            value: t.id,
            label: t.name
        }));
    }

    setCurrentTemplate(id: string) {
        const template = this.templates.find(t => t.id === id);
        if (template) {
            this.currentTemplate = template;
        }
    }

    applyTemplate(previewEl: HTMLElement, settings: any) {
        if (!this.currentTemplate) {
            this.currentTemplate = this.templates[0];
        }

        if (this.currentTemplate) {
            this.currentTemplate.render(previewEl, settings);
            this.themeManager.applyTheme(previewEl);
        }
    }
}