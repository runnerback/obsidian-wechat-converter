// iOS 备忘录主题(自研,非上游移植)
// 设计语言:纸白底色 + 苹果系统黄点缀 + SF 排版层次
// 专属头部(‹ 备忘录 返回条 + 圆点/分享图标 + 居中日期)由 rednote/memoHeader.ts
// 在 themeId === 'memo' 时渲染,样式类 red-memo-* 定义在根 styles.css
export default {
    "id": "memo",
    "name": "备忘录",
    "description": "iOS 备忘录风格：纸白底色、系统黄点缀、居中日期",
    "styles": {
        "imagePreview": "background-color: #FFFDF7; padding: 24px 24px 28px;",
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
                "content": "font-weight: 600; color: #3A3A3C;",
                "after": ""
            }
        },
        "paragraph": "line-height: 1.85; margin-bottom: 1.05em; font-size: 15px; color: #2C2C2E;",
        "emphasis": {
            "strong": "font-weight: 700; color: #1C1C1E; background: linear-gradient(transparent 62%, rgba(255, 204, 0, 0.38) 62%);",
            "em": "font-style: normal; color: #8A6D00; background: rgba(255, 204, 0, 0.12); padding: 0 4px; border-radius: 3px;",
            "del": "text-decoration: line-through; color: #A0A0A5;"
        },
        "list": {
            "container": "padding-left: 24px; margin-bottom: 1.05em; color: #2C2C2E;",
            "item": "margin-bottom: 0.6em; font-size: 15px; color: #2C2C2E; line-height: 1.8;",
            "taskList": "list-style: none; margin-left: -20px; font-size: 15px; color: #2C2C2E; line-height: 1.8;"
        },
        "code": {
            "block": "background: #F5F2E9; border: 1px solid #EAE5D4; padding: 1em 1.1em; border-radius: 10px; font-size: 14px; font-family: SF Mono, Menlo, monospace; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; color: #3A3A3C; margin: 1.2em 0;",
            "inline": "background: #F5F2E9; padding: 2px 6px; border-radius: 5px; color: #8A6D00; font-size: 14px; font-family: SF Mono, Menlo, monospace;"
        },
        "quote": "border-left: 3px solid #E5C100; background: rgba(255, 204, 0, 0.07); padding: 8px 14px; border-radius: 4px; margin: 1.1em 0; color: #4A4A4F; font-style: normal; font-size: 15px; line-height: 1.75;",
        "image": "max-width: 100%; height: auto; margin: 1.2em auto; border-radius: 10px;",
        "link": "color: #C7930A; text-decoration: underline; text-underline-offset: 2px;",
        "table": {
            "container": "width: 100%; margin: 1.2em 0; border-collapse: separate; border-spacing: 0; border-radius: 10px; overflow: hidden; border: 1px solid #EAE5D4;",
            "header": "background: #F7F4EB; font-weight: 600; color: #1C1C1E; padding: 11px;",
            "cell": "padding: 11px; color: #2C2C2E; border-top: 1px solid #EAE5D4;"
        },
        "hr": "border: none; border-top: 1px solid #E8E4D8; margin: 22px 0;",
        "footnote": {
            "ref": "color: #8A8A8E; text-decoration: none; font-size: 0.9em;",
            "backref": "color: #8A8A8E; text-decoration: none; font-size: 0.9em;"
        }
    }
} as const;
