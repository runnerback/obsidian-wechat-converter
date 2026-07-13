// iOS 备忘录主题(自研,非上游移植)
// 设计语言:模拟 iPhone 备忘录截图——淡黄纸底(参考 Apple Notes 品牌黄
// #FFD52E 调淡) + 系统黄导航 + 状态栏/居中日期。
// 专属头部由 rednote/memoHeader.ts 在 themeId === 'memo' 时渲染,
// 样式类 red-memo-* 定义在根 styles.css。
export default {
    "id": "memo",
    "name": "备忘录",
    "description": "iOS 备忘录截图风格：淡黄纸底、系统黄导航、状态栏与居中日期",
    "styles": {
        "imagePreview": "background-color: #FDF6DE; padding: 14px 22px 26px;",
        "header": {
            "avatar": {
                "container": "display: none;",
                "placeholder": "display: none;",
                "image": "display: none;"
            },
            "nameContainer": "display: none;",
            "userName": "display: none;",
            "userId": "display: none;",
            "postTime": "display: none;",
            "verifiedIcon": "display: none;"
        },
        "footer": {
            "container": "display: none;",
            "text": "display: none;",
            "separator": "display: none;"
        },
        "title": {
            "h2": {
                "base": "margin: 0 0 4px; font-size: 1.45em; letter-spacing: -0.01em; line-height: 1.4;",
                "content": "font-weight: 700; color: #1C1C1E;",
                "after": ""
            },
            "h3": {
                "base": "margin: 24px 0 0; font-size: 1.18em; line-height: 1.5;",
                "content": "font-weight: 600; color: #1C1C1E;",
                "after": ""
            },
            "base": {
                "base": "margin: 20px 0 0; font-size: 1.05em; line-height: 1.5;",
                "content": "font-weight: 600; color: #48432F;",
                "after": ""
            }
        },
        "paragraph": "line-height: 1.85; margin-bottom: 1.05em; font-size: 15px; color: #2C2A22;",
        "emphasis": {
            "strong": "font-weight: 700; color: #1C1C1E; background: linear-gradient(transparent 62%, rgba(255, 213, 46, 0.55) 62%);",
            "em": "font-style: normal; color: #8A6D00; background: rgba(255, 213, 46, 0.22); padding: 0 4px; border-radius: 3px;",
            "del": "text-decoration: line-through; color: #A39B7E;"
        },
        "list": {
            "container": "padding-left: 24px; margin-bottom: 1.05em; color: #2C2A22;",
            "item": "margin-bottom: 0.6em; font-size: 15px; color: #2C2A22; line-height: 1.8;",
            "taskList": "list-style: none; margin-left: -20px; font-size: 15px; color: #2C2A22; line-height: 1.8;"
        },
        "code": {
            "block": "background: #F7EDC5; border: 1px solid #EBDCA4; padding: 1em 1.1em; border-radius: 10px; font-size: 14px; font-family: SF Mono, Menlo, monospace; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; color: #3E3A2A; margin: 1.2em 0;",
            "inline": "background: #F7EDC5; padding: 2px 6px; border-radius: 5px; color: #8A6D00; font-size: 14px; font-family: SF Mono, Menlo, monospace;"
        },
        "quote": "border-left: 3px solid #E3B811; background: rgba(255, 213, 46, 0.14); padding: 8px 14px; border-radius: 4px; margin: 1.1em 0; color: #55503A; font-style: normal; font-size: 15px; line-height: 1.75;",
        "image": "max-width: 100%; height: auto; margin: 1.2em auto; border-radius: 10px;",
        "link": "color: #B58A00; text-decoration: underline; text-underline-offset: 2px;",
        "table": {
            "container": "width: 100%; margin: 1.2em 0; border-collapse: separate; border-spacing: 0; border-radius: 10px; overflow: hidden; border: 1px solid #EBDCA4;",
            "header": "background: #F7EDC5; font-weight: 600; color: #1C1C1E; padding: 11px;",
            "cell": "padding: 11px; color: #2C2A22; border-top: 1px solid #EEE2B4;"
        },
        "hr": "border: none; border-top: 1px solid #EBDFB0; margin: 22px 0;",
        "footnote": {
            "ref": "color: #98917A; text-decoration: none; font-size: 0.9em;",
            "backref": "color: #98917A; text-decoration: none; font-size: 0.9em;"
        }
    }
} as const;
