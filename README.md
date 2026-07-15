# Content Studio

> Version 3.9.43 · Updated 2026-07-14 · [简体中文](./README.zh-CN.md)

Turn your Obsidian notes into ready-to-publish content: **WeChat Official Account** articles, **Xiaohongshu (rednote)** image cards, and **Feishu** cloud docs — all previewed live inside Obsidian.

## Features

- **WeChat articles** — live preview your Markdown as a WeChat-ready article (code blocks, quotes, local images, GIFs, math & diagrams all handled). Copy into the WeChat editor with one click, or save straight to your account's drafts.
- **Xiaohongshu image cards** — switch the preview to 小红书 mode: each heading becomes one image card. Style them with themes (including an iOS-Notes look), then export as PNGs or push to your rednote drafts.
- **Feishu docs** — sync the same note to Feishu cloud documents.
- **AI layout & title polish** — optional AI-assisted typesetting and title suggestions.

## Quick start

1. Click the **Content Studio** ribbon icon (or run the command `打开Content Studio`) to open the preview panel.
2. Edit your note — the panel renders it live, with two-way scroll sync.
3. Use the panel toolbar to switch platform (公众号 / 小红书), tweak styles, and publish via **发布与分发**.

## Setup

- **WeChat**: add your Official Account AppID/Secret in settings. WeChat's API requires an IP whitelist, so requests go through a proxy you control — see [`PROXY_GUIDE.md`](./PROXY_GUIDE.md).
- **Feishu**: add your Feishu app credentials in settings.
- **AI features** (optional): configure an API key in settings.
- **Xiaohongshu draft publishing** (optional): pair the companion browser extension **多栖 Crosspost** (Settings → 其他平台). Exporting cards as PNGs works without it.

## Manual install

Download `main.js` / `manifest.json` / `styles.css` from the latest release into `.obsidian/plugins/content-studio/`, then enable the plugin.

## Docs

See [`docs/guides/`](./docs/guides/) for proxy setup, AI provider setup, and Xiaohongshu publishing.

## License

[MIT](./LICENSE)
