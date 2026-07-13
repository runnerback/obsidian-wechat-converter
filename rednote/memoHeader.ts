// iOS 备忘录主题(memo)的专属头部。
// 备忘录是「主题」而非模板,但其头部(‹ 备忘录 返回条 + 圆点/分享图标 +
// 居中日期)无法用主题的 inline 样式在用户信息 DOM 上表达,由本模块在
// themeId === 'memo' 时替换头部 DOM。样式类 red-memo-* 定义在根 styles.css。

interface MemoHeaderSettings {
    notesTitle?: string;
    showTime?: boolean;
}

/** 把 header 区域重建为 iOS 备忘录顶栏 */
export function renderMemoHeader(header: HTMLElement, settings: MemoHeaderSettings) {
    header.empty();
    header.classList.add('red-memo-header');

    const bar = header.createEl('div', { cls: 'red-memo-bar' });
    bar.createEl('span', {
        cls: 'red-memo-back',
        text: settings.notesTitle || '备忘录',
    });
    const actions = bar.createEl('div', { cls: 'red-memo-actions' });
    actions.createEl('span', { cls: 'red-memo-icon red-memo-icon-more' });
    actions.createEl('span', { cls: 'red-memo-icon red-memo-icon-share' });

    if (settings.showTime !== false) {
        header.createEl('div', { cls: 'red-memo-date', text: formatMemoDate(new Date()) });
    }
}

/** iOS 备忘录风格日期行:2026年7月13日 周一 15:30 */
export function formatMemoDate(date: Date): string {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 `
        + `${weekdays[date.getDay()]} ${date.getHours()}:${pad(date.getMinutes())}`;
}
