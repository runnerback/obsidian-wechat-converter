# 使用说明 Guides

> 适用插件版本：v3.9.11 ｜ 最后更新：2026-07-10 ｜ 编码：UTF-8

「Content Studio」的功能使用说明，按主题拆分。

## 目录

| 文档 | 内容 |
|------|------|
| [API 代理设置](./api-proxy.md) | 配置 API 代理地址，解决本机 IP 变化导致的微信 IP 白名单漂移、同步失败 |
| [AI Provider 设置](./ai-provider.md) | 配置 AI Provider（DeepSeek），启用「AI 编排」和「标题 AI 润色」 |
| [小红书图文发布](./rednote-publishing.md) | 预览区「小红书」模式：图卡预览/导出，一键发布图文笔记到小红书草稿箱 |

## 设置面板速览

打开：Obsidian 设置 → 第三方插件 → Content Studio（或转换器面板右上角齿轮）。

「微信」标签页从上到下的主要区块：

1. **公众号账号** —— AppID / AppSecret / 封面摘要默认值等（多账号）
2. **预览 / 水印 / 排版** —— 手机框、图片说明、留白等
3. **AI Provider** —— AI 能力的共享凭证（当前 DeepSeek），详见 [AI Provider 设置](./ai-provider.md)
   - 折叠「AI 编排」—— 一键 AI 排版
   - 折叠「标题 AI 润色」—— 一键优化标题
4. **高级设置 → API 代理地址** —— 见 [API 代理设置](./api-proxy.md)

多平台发布（小红书 / 知乎 / 头条 等）走「其他平台」标签页 + 配套浏览器扩展「多栖 Crosspost」，见 [小红书图文发布](./rednote-publishing.md)。

## 相关文档

- 代理服务端部署（自建 ECS）：[`../../server/README.md`](../../server/README.md)
