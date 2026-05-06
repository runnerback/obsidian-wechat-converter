# Wechatsync 浏览器扩展桥接接入指南

本文档给 Obsidian 插件侧接入使用。Wechatsync 扩展侧会承担真实浏览器登录态、平台草稿保存、任务历史、草稿链接和失败重试；Obsidian 插件侧只负责写作体验、平台选择、任务投递、轻量状态展示，以及提供“查看任务”入口。

## 体验边界

推荐用户路径：

1. 用户在 Obsidian 点击“同步到选中平台”。
2. Obsidian 调用 `enqueue_sync_article`，扩展立即返回 `syncId`。
3. Obsidian 显示“已发送到 Wechatsync 扩展”，并保存最近任务。
4. Obsidian 可以用 `get_sync_task(syncId)` 读取轻量进度，但不要默认长时间阻塞等待全部平台完成。
5. 用户点击“查看任务”时，Obsidian 调用 `open_sync_task(syncId)`。
6. 浏览器扩展会自动打开任务历史窗口，并定位、高亮对应任务。
7. 草稿链接、平台失败原因、单平台重试都在扩展任务窗口里处理。

不要尝试在 Obsidian 内完整接管各平台登录。各平台 Cookie、localStorage、CSRF token 和风控上下文都在用户浏览器里，扩展比 Obsidian 更适合完成真实平台操作。

## 扩展侧将提供的能力

### `health`

用于测试连接和能力发现。不会触发平台登录检测。

响应会包含：

```json
{
  "ok": true,
  "extensionConnected": true,
  "tokenValid": true,
  "version": "2.0.9",
  "mode": "extension-bridge",
  "capabilities": {
    "enqueueSyncArticle": true,
    "listSupportedPlatforms": true,
    "checkAuth": true,
    "getSyncTask": true,
    "getSyncTaskLink": true,
    "openSyncTask": true,
    "getAuthSnapshot": true
  }
}
```

Obsidian 侧应按 `capabilities` 渐进增强。老版本没有某项能力时，隐藏对应 UI 或降级到文字提示。

### `enqueue_sync_article`

异步入队，不等待平台完成。

请求：

```json
{
  "platforms": ["zhihu", "juejin"],
  "title": "文章标题",
  "markdown": "正文 Markdown",
  "content": "<p>可选 HTML</p>",
  "cover": "可选封面 URL 或 data URI",
  "source": "obsidian"
}
```

响应：

```json
{
  "accepted": true,
  "syncId": "sync_1770000000000_xxxxx",
  "platforms": ["zhihu", "juejin"],
  "message": "任务已推送到浏览器扩展"
}
```

Obsidian 侧建议保存 `{ syncId, title, platforms, createdAt }` 到最近任务列表。

### `get_sync_task`

按 `syncId` 查询扩展当前任务或历史任务，只读本地状态，不触发重新同步。

请求：

```json
{
  "syncId": "sync_1770000000000_xxxxx"
}
```

响应示例：

```json
{
  "found": true,
  "syncId": "sync_1770000000000_xxxxx",
  "status": "partial_success",
  "rawStatus": "completed",
  "source": "obsidian",
  "title": "文章标题",
  "createdAt": 1770000000000,
  "updatedAt": 1770000005000,
  "platforms": [
    {
      "id": "zhihu",
      "name": "知乎",
      "status": "success",
      "stage": "success",
      "username": "",
      "error": "",
      "draftUrl": "https://...",
      "postUrl": "",
      "updatedAt": 1770000005000
    },
    {
      "id": "juejin",
      "name": "掘金",
      "status": "failed",
      "stage": "failed",
      "username": "",
      "error": "登录状态已失效",
      "draftUrl": "",
      "postUrl": "",
      "updatedAt": 1770000004500
    }
  ],
  "summary": {
    "total": 2,
    "success": 1,
    "failed": 1,
    "pending": 0
  }
}
```

未找到：

```json
{
  "found": false,
  "syncId": "sync_1770000000000_xxxxx",
  "code": "TASK_NOT_FOUND",
  "message": "未找到该同步任务"
}
```

Obsidian 侧建议只展示轻量状态，例如“同步中 / 1 成功 1 失败 / 查看任务”。不要复制扩展的完整任务中心。

### `open_sync_task`

让浏览器扩展打开任务历史窗口，并定位到对应任务。用户不需要手动点浏览器工具栏扩展图标。

请求：

```json
{
  "syncId": "sync_1770000000000_xxxxx"
}
```

响应：

```json
{
  "opened": true,
  "syncId": "sync_1770000000000_xxxxx",
  "target": "history",
  "url": "chrome-extension://.../src/popup/index.html#/history?syncId=sync_1770000000000_xxxxx"
}
```

注意：扩展不会强制打开浏览器原生 toolbar popup，而是打开一个等价的扩展任务窗口。这个方式更稳定，且可以深链到指定 `syncId`。

### `get_sync_task_link`

如果 Obsidian 侧只想拿链接而不直接打开，可调用此方法。常规 UI 更推荐直接调用 `open_sync_task`。

### `get_auth_snapshot`

读取扩展缓存的上次已知登录状态。默认只读缓存，不触发逐平台实时检测。

请求：

```json
{
  "platforms": ["zhihu", "juejin"],
  "maxAgeMs": 86400000
}
```

响应：

```json
{
  "source": "cache",
  "checkedAt": 1770000000000,
  "platforms": [
    {
      "id": "zhihu",
      "name": "知乎",
      "authKnown": true,
      "authenticated": true,
      "username": "用户名",
      "checkedAt": 1770000000000,
      "lastSuccessAt": 1770000000000,
      "lastFailureAt": 0,
      "error": "",
      "stale": false
    }
  ]
}
```

Obsidian 侧可以把它用于设置页和发布弹窗提示，例如“上次可用 / 未检测 / 上次失败”。这只是提示，不是最终发布保证。

## Obsidian 侧建议实现

### 设置页

- 测试连接：调用 `health`。
- 平台列表：调用 `list_supported_platforms`，不要硬编码平台。
- 登录状态：优先调用 `get_auth_snapshot` 展示上次状态。
- 用户主动点击“检测已选平台登录状态”时，再调用 `check_auth({ platforms })`。

### 发布弹窗

- 微信公众号仍走 Obsidian 插件已有链路。
- 其他平台调用 `enqueue_sync_article`。
- 成功后立即显示：
  - “已发送到 Wechatsync 扩展”
  - `syncId`
  - “查看任务”按钮
- 如果 `health.capabilities.getSyncTask` 为 true，可以短暂查询一次 `get_sync_task(syncId)`，展示轻量状态。
- 不建议默认长轮询全部平台到结束。如果需要，可做低频、短生命周期轮询，例如 2 秒一次，最多 10 到 20 秒，窗口关闭即停止。

### 查看任务按钮

优先调用：

```json
{
  "tool": "open_sync_task",
  "arguments": {
    "syncId": "sync_1770000000000_xxxxx"
  }
}
```

如果不支持 `open_sync_task`，再降级为：

1. 调用 `get_sync_task_link`。
2. 如果 `canOpen:true`，交给系统浏览器打开 URL。
3. 如果仍不可用，显示“请在浏览器扩展历史记录中查看任务”，并展示 `syncId`。

## 推荐降级策略

- 没有 `getAuthSnapshot`：隐藏上次登录状态，只保留手动检测。
- 没有 `getSyncTask`：投递成功后只显示 `syncId` 和“去扩展历史查看”。
- 没有 `openSyncTask`：显示手动指引或使用 `getSyncTaskLink`。
- `get_sync_task` 返回 `TASK_NOT_FOUND`：提示用户打开扩展历史，并展示 `syncId`。

## 最重要的 UX 原则

Obsidian 不需要变成多平台发布控制台。最顺滑的分工是：

- Obsidian：写作、选择平台、投递、轻量可见状态。
- Wechatsync 扩展：真实发布、平台登录态、任务历史、草稿链接、失败重试。
- 默认浏览器：打开最终草稿页，因为用户的登录 Session 和 Cookie 在那里。
