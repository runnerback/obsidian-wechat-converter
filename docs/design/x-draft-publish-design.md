# X（Twitter）草稿发布 · 实现设计

> 版本 1.1.0 · 创建 2026-07-15 · 编码 UTF-8 · 状态：已确认，P1 实施中

## 0. 已确认决策（2026-07-15）

1. 推文正文 = 复用小红书 `> 发布时复制下面这段作为笔记正文：` 标记块（`extractRednoteBody`）。**不在代码里做 280 字截断**（用户在生成端按 X 规则处理），adapter 原样传。
2. X adapter 独立实现（cookie + GraphQL）。
3. 桥接只透传 title/content/markdown/cover（summary 会丢），故 X 推文正文由 adapter 从 markdown 剥图片引用得到（buildXArticle 的 markdown = 正文 + 图卡引用，与 rednote 同构）。
4. 落盘目录清空+写入逻辑抽成通用 `syncCardsToFolder(app, noteFile, buffers, { subdir, filenameOf })`，rednote 与 X 共用，避免复制。

## 1. 目标与范围

在 Content Studio + 多栖 Crosspost 两个插件上，新增把笔记发布到 **X 草稿箱**的能力，与小红书图卡链路同构：

- **P1（本次实现）**：文字 + 图片草稿。图片复用小红书图卡渲染，作为附件写入 X 草稿；推文正文取笔记头部。
- **P2（后续）**：视频草稿（分块上传 + 转码轮询，链路重且易碎，暂不做）。
- 落地形态：写入 X 「未发送的帖子」草稿箱，用户到 x.com 网页人工点发布。本机操作、借浏览器登录态，与 rednote 同一套路。

## 2. 两仓分工

| 仓库 | 职责 |
|---|---|
| **Content Studio**（Obsidian） | 顶栏平台下拉增 X；X 模式复用 rednote 图卡渲染；图卡落盘 `sync-to-x/synced-x-card_NN.png`；组装桥接 article；发布后写 frontmatter `platform += x`。 |
| **多栖 Crosspost**（扩展） | 新增 X adapter：借 x.com 登录态，chunked 上传图片拿 media_id → `CreateDraftTweet` 写草稿。 |

## 3. Content Studio 侧改动

### 3.1 平台下拉加 X
`views/settings-panel/settings-panel.js`：下拉增 `{ value: 'x', text: 'X' }`（公众号/小红书/X）。

### 3.2 预览模式
`input.js` 的 `setPreviewMode` 扩展支持 `'x'`：**X 复用小红书预览与图卡渲染**（`rednoteController`），即选 X 时预览区展示的仍是图卡（附件即这些图卡）。顶栏按钮组：X 模式复用小红书那组（样式设置 + 下载 + 发布与分发）。

### 3.3 X 发布链路（复用 rednote，独立命名）
新增 `services/x-publish.js` + `views/publish-modal/x-publish.js`，**结构照搬 rednote 两个文件**，仅三处不同：

1. **图卡文件名**：`synced-x-card_${NN}.png`（对比 `synced-rednote-card_NN.png`）。
2. **落盘目录**：`sync-to-x/`（对比 `sync-to-rednote/`）。
3. **推文正文来源**：取笔记头部 —— 即 H1 标题（`extractRednoteTitle` 复用）。⚠️ 见第 7 节待确认点。

`views/publish-modal/multi-platform.js` 的发送流程加一个与 `wantsXiaohongshu` 平行的 `wantsX` 分支：命中 X 平台 id 时走 `prepareXCardArticle()` → `enqueueSyncArticle({ platforms:[xPlatformId], ... })`。

### 3.4 frontmatter platform += x
发布成功后复用现有 `recordPublishStatus`：`successfulTargets:[{ platform:'x', kind:'draft' }]`。现有 `updatePublishFrontmatter` 会自动把 `x` 并入 `platforms` 列表并写 `platform_x: 1`——**无需新代码**，只要传 `platform:'x'`。（`normalizePlatformName` 对 `x` 无别名映射，原样保留为 `x`。）

## 4. 扩展侧 X adapter

新增 `packages/core/src/adapters/platforms/x.ts`，注册进 `packages/extension/src/adapters/index.ts` 的 `ADAPTER_CLASSES`。

```
meta = { id:'x', name:'X', icon:<x.ico>, homepage:'https://x.com',
         capabilities:['article','draft','image_upload'] }
```

**鉴权**：确保存在 x.com 标签页，读取 `ct0` cookie（CSRF）与登录态 `auth_token`。请求头：`authorization: Bearer <web 公开 bearer>`、`x-csrf-token: <ct0>`、`credentials:'include'`。checkAuth 调一个轻量已登录接口判断。

**publish(article)**（硬编码 queryId，坏了再改，同 rednote）：
1. 从 article.assets 取图卡（P1 只图片）。
2. 逐张 chunked 上传到 `upload.twitter.com/i/media/upload.json`：`INIT`(media_category=`tweet_image`) → `APPEND`(4MB/块) → `FINALIZE` → 拿 `media_id`。图片上限 5MB。
3. `POST https://x.com/i/api/graphql/cH9HZWz_EW9gnswvA4ZRiQ/CreateDraftTweet`
   ```json
   { "post_tweet_request": {
       "auto_populate_reply_metadata": false,
       "status": "<推文正文=笔记头部>",
       "exclude_reply_user_ids": [],
       "media_ids": ["<id0>","<id1>", "..."] } }
   ```
4. 返回 draftOnly=true，提示"已写入 X 草稿箱，请到 x.com 人工确认发布"。

**CORS**：图片上传/GraphQL 均由扩展 background 发（host_permissions 加 `*://x.com/*`、`*://upload.twitter.com/*`），沿用 rednote background 请求绕 CORS 的方式。

## 5. 数据流

```
Obsidian 笔记 → [X模式]图卡渲染(复用rednote) → 落盘 sync-to-x/
   → 组装 article(assets=图卡, status=头部文字) → 本地 WS 桥接
   → 扩展 X adapter: 上传图片得 media_id → CreateDraftTweet
   → X 草稿箱「未发送的帖子」 → 用户 x.com 人工发布
   → 回写 frontmatter: platforms+=x, platform_x:1
```

## 6. 文件清单

**Content Studio**
- 改 `views/settings-panel/settings-panel.js`（下拉加 X）
- 改 `input.js`（setPreviewMode 支持 'x'，复用 rednote 预览）
- 新增 `services/x-publish.js`（照搬 rednote-publish.js，改名/目录/正文源）
- 新增 `views/publish-modal/x-publish.js`（照搬 rednote mixin）
- 改 `views/publish-modal/multi-platform.js`（加 wantsX 分支）
- 改 `input.js`（Object.assign xPublishMixin）
- 测试 `tests/x_publish.test.js`

**多栖 Crosspost**（版本号 +1）
- 新增 `packages/core/src/adapters/platforms/x.ts`
- 改 `packages/core/src/adapters/platforms/index.ts`（导出）
- 改 `packages/extension/src/adapters/index.ts`（注册）
- `packages/extension/manifest.json`（host_permissions 加 x.com/upload.twitter.com）

## 7. 待确认点（动手前需你拍板）

1. **推文正文="笔记头部"的确切定义**：本设计取 **H1 标题**。若你希望是"H1 标题 + 正文首段"或复用小红书那个 `> 发布正文：` 标记块，请指定。X 单条上限 280 字符，超出如何处理（截断/报错）？
2. **X adapter 在扩展里是新建还是复用小红书的页面注入方式**：X 走 cookie+GraphQL（无需页面签名），比小红书简单，建议独立实现而非硬套小红书的 executeScript 注入。确认。

## 8. 风险

- queryId `cH9HZWz_EW9gnswvA4ZRiQ` 随 X 前端更新会变，硬编码，坏了跟修（已接受）。
- 逆向接口无契约，X 改版可能整体失效（已接受）。
- 学习研究、自用低频（合规边界已确认）。
