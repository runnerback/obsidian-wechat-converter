// iOS 备忘录主题(memo)的专属头部。
// 备忘录是「主题」而非模板,但其头部无法用主题的 inline 样式在用户信息
// DOM 上表达,由本模块在 themeId === 'memo' 时替换头部 DOM。
// 结构(自上而下,模拟 iPhone 备忘录截图):
//   状态栏: 当前时间(左) + 信号/WiFi/电池图标(右)
//   导航条: ‹ 备忘录 返回(左,系统黄) + 圆点菜单/分享图标(右,系统黄)
//   日期行: 居中小灰字(受 showTime 设置控制)
// 样式类 red-memo-* 定义在根 styles.css。

interface MemoHeaderSettings {
    notesTitle?: string;
    showTime?: boolean;
}

/** 把 header 区域重建为 iOS 备忘录顶栏 */
export function renderMemoHeader(header: HTMLElement, settings: MemoHeaderSettings) {
    header.empty();
    header.classList.add('red-memo-header');

    const now = new Date();

    // 1. 模拟 iPhone 状态栏
    const statusBar = header.createEl('div', { cls: 'red-memo-status' });
    statusBar.createEl('span', { cls: 'red-memo-status-time', text: formatClock(now) });
    const statusIcons = statusBar.createEl('div', { cls: 'red-memo-status-icons' });
    statusIcons.createEl('span', { cls: 'red-memo-sicon red-memo-sicon-signal' });
    statusIcons.createEl('span', { cls: 'red-memo-sicon red-memo-sicon-wifi' });
    statusIcons.createEl('span', { cls: 'red-memo-sicon red-memo-sicon-battery' });

    // 2. 备忘录导航条
    const bar = header.createEl('div', { cls: 'red-memo-bar' });
    bar.createEl('span', {
        cls: 'red-memo-back',
        text: settings.notesTitle || '备忘录',
    });
    const actions = bar.createEl('div', { cls: 'red-memo-actions' });
    actions.createEl('span', { cls: 'red-memo-icon red-memo-icon-more' });
    actions.createEl('span', { cls: 'red-memo-icon red-memo-icon-share' });

    // 3. 居中日期行
    if (settings.showTime !== false) {
        header.createEl('div', { cls: 'red-memo-date', text: formatMemoDate(now) });
    }
}

/** 状态栏时钟:16:08 */
export function formatClock(date: Date): string {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** iOS 备忘录风格日期行:2026年7月13日 周一 16:08 */
export function formatMemoDate(date: Date): string {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 `
        + `${weekdays[date.getDay()]} ${formatClock(date)}`;
}
