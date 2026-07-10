# Content Studio

> Version 3.9.12 · Updated 2026-07-10 · [简体中文](./README.zh-CN.md)

An Obsidian plugin for composing, previewing, and publishing rich content. Turn your Markdown notes into polished **WeChat Official Account** articles and **Xiaohongshu (rednote)** image-text cards, sync to **Feishu** docs, and one-click publish to 20+ platforms via the companion **多栖 Crosspost** browser extension.

## Features

- **WeChat preview & export** — convert Markdown into WeChat-ready HTML (code blocks, quotes, lists, local images, GIFs, math & diagrams); copy straight into the WeChat editor or save as a draft.
- **Xiaohongshu (rednote) cards** — switch the preview to "小红书" mode to render image cards and publish image-text notes to your rednote drafts.
- **Feishu docs** — sync the same note to Feishu cloud documents.
- **Multi-platform publishing** — from the publish panel, pick platforms (Zhihu, Juejin, CSDN, Toutiao, Weibo, …) and let the **多栖 Crosspost** browser extension save drafts using your existing browser logins.
- **AI layout & title polish** — optional AI-assisted typesetting and title suggestions.

## Install (local build)

```bash
npm install
bash dev-install.sh   # build + deploy to your Obsidian plugins folder
```

Or manually run `npm run build`, then copy `main.js` / `manifest.json` / `styles.css` into `.obsidian/plugins/wechat-converter/`.

## Multi-platform publishing (多栖 Crosspost)

Publishing to Xiaohongshu / Zhihu / Toutiao / … is handled by the companion browser extension **多栖 Crosspost**:

- **Download**: GitHub only for now (Chrome Web Store pending).
- **Install**: Chrome → Extensions → enable Developer mode → Load unpacked → select the extension's `dist` folder.
- **Pair**: open the extension popup → Settings → copy the connection token → paste it into this plugin's settings ("其他平台" tab).

## Docs

See [`docs/guides/`](./docs/guides/) for API proxy setup, AI provider setup, and Xiaohongshu publishing.

## License

MIT — self-maintained build for personal use.
