# Wechatsync 浏览器插件桥接增强评估文档

本文档给 Wechatsync 浏览器插件项目评估使用，重点说明 Obsidian 插件侧为了把“其他平台分发”体验做完整，希望浏览器插件 bridge/MCP 层进一步提供的能力。

## 背景

Obsidian 插件目前的定位是：

- 微信公众号仍走 Obsidian 插件自己已有的公众号 API 草稿箱链路。
- 知乎、掘金、CSDN、B 站专栏等其他平台走 Wechatsync 浏览器插件链路。
- Obsidian 侧只负责把文章推送给浏览器插件，并提示用户去浏览器插件历史或各平台草稿箱查看后续结果。

现在 Obsidian 侧已经接入了 Wechatsync fork 新增的 `enqueueSyncArticle`，可以在推送后拿到 `syncId`。但如果想让用户体验更稳，还需要浏览器插件侧把已有的任务状态、历史记录、登录状态缓存通过 bridge/MCP 暴露出来。

## 暂不处理范围

以下两类能力先不放入本轮优先级，因为它们很大程度取决于各个平台自身限制，不一定能由浏览器插件稳定保证：

- 平台能力矩阵：例如每个平台是否支持封面、摘要、草稿链接、图片限制、代码块限制等。
- 发布前内容校验：例如某个平台标题长度、正文长度、图片数量、格式兼容性等。

本轮优先评估三个能力：

1. 按 `syncId` 查询任务状态。
2. 打开或定位到浏览器插件里的任务详情/历史记录。
3. 获取缓存的登录状态快照。

## 目标体验

用户在 Obsidian 里点击“同步到选中平台”后：

1. Obsidian 把文章推送给 Wechatsync 浏览器插件。
2. 浏览器插件立即返回真实 `syncId`，表示任务已入队。
3. Obsidian 不默认长时间等待所有平台完成。
4. Obsidian 显示“已发送到 Wechatsync 扩展”，并提供“查看任务”入口。
5. 用户点击入口后，可以跳到浏览器插件的历史或对应任务。
6. Obsidian 设置页和发布弹窗可以展示“上次检测到的平台登录状态”，但不把这个状态当成最终发布依据。

## 能力一：按 syncId 查询任务状态

### 建议新增方法

`getSyncTask`

也可以命名为 `getSyncHistoryItem`，关键是语义明确：根据 `syncId` 读取浏览器插件当前任务或历史任务。

### 请求

```json
{
  "syncId": "sync_abc123"
}
```

### 响应建议

```json
{
  "found": true,
  "syncId": "sync_abc123",
  "status": "queued",
  "source": "obsidian",
  "title": "文章标题",
  "createdAt": 1770000000000,
  "updatedAt": 1770000005000,
  "platforms": [
    {
      "id": "zhihu",
      "name": "知乎",
      "status": "success",
      "stage": "completed",
      "username": "林小卫很行",
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
      "username": "林小卫很行",
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

如果没有找到任务，可以返回：

```json
{
  "found": false,
  "syncId": "sync_abc123",
  "code": "TASK_NOT_FOUND",
  "message": "未找到该同步任务"
}
```

### 状态枚举建议

任务整体 `status`：

- `queued`
- `syncing`
- `success`
- `partial_success`
- `failed`
- `cancelled`

单个平台 `status`：

- `queued`
- `preprocessing`
- `saving`
- `success`
- `failed`
- `skipped`

`stage` 可以更细，用于 UI 展示；如果暂时无法稳定提供，先只给 `status` 也可以。

### 实现提示

Wechatsync fork 里已经有这些基础：

- `enqueueSyncArticle` 会生成并返回 `syncId`。
- background/sync service 内部有 history item 创建和更新逻辑。
- 同步过程中已有 `SYNC_PROGRESS`、`SYNC_DETAIL_PROGRESS`、`SYNC_COMPLETE`、`SYNC_ERROR` 等消息，并携带 `syncId`。
- popup store 已经维护 `history`、`currentSyncId` 和平台进度。

因此这项增强很可能主要是把现有 active sync state/history state 通过 bridge/MCP 暴露出来，而不是重新设计同步流程。

### 验收标准

- `enqueueSyncArticle` 返回 `syncId` 后，马上调用 `getSyncTask(syncId)` 能查到任务。
- 任务刚入队时能返回 `queued` 或 `syncing`。
- 单个平台完成后，任务状态里能反映该平台结果。
- 失败平台能返回可读错误信息。
- 如果平台侧能拿到草稿链接或结果链接，则返回 `draftUrl` 或 `postUrl`；拿不到时留空，不作为失败。
- 查询应该是快速读取本地状态，不触发重新同步或逐平台登录检测。

## 能力二：打开或定位到浏览器插件任务

### 建议新增方法

可以二选一，按浏览器插件能做到的程度来评估：

#### 方案 A：返回任务链接

`getSyncTaskLink`

请求：

```json
{
  "syncId": "sync_abc123"
}
```

响应：

```json
{
  "canOpen": true,
  "url": "chrome-extension://<extension-id>/popup.html#/history/sync_abc123",
  "label": "在 Wechatsync 中查看任务"
}
```

如果浏览器限制导致无法稳定生成可打开链接：

```json
{
  "canOpen": false,
  "message": "请在浏览器插件的历史记录中查看该任务",
  "syncId": "sync_abc123"
}
```

#### 方案 B：直接打开任务页

`openSyncTask`

请求：

```json
{
  "syncId": "sync_abc123"
}
```

响应：

```json
{
  "opened": true,
  "syncId": "sync_abc123"
}
```

如果只能打开历史页，不能定位具体任务，也可以返回：

```json
{
  "opened": true,
  "syncId": "sync_abc123",
  "target": "history"
}
```

### Obsidian 侧预期用法

Obsidian 不需要把浏览器插件的整个历史页复制到自己 UI 里。更合理的体验是：

- 推送成功后展示“已发送到 Wechatsync 扩展”。
- 提供“查看任务”按钮。
- 如果浏览器插件支持打开任务，则直接打开。
- 如果不支持，则提示用户去浏览器插件历史记录里查看，并展示 `syncId`。

### 验收标准

- 对于刚 enqueue 的任务，Obsidian 能通过 `syncId` 打开或定位到浏览器插件侧可查看的位置。
- 如果浏览器限制导致不能打开 extension popup，也要能返回明确的 `canOpen:false` 和用户可理解的说明。
- 这个能力不应该影响同步本身；打开失败不能让同步任务失败。

## 能力四：缓存登录状态快照

### 背景

Obsidian 侧不希望每次打开发布弹窗都逐个平台做实时登录检测，因为这会慢、容易 timeout，也会让体验不稳定。

更合适的方式是：

- 浏览器插件侧维护“上次已知登录状态”。
- Obsidian 侧读取这个快照作为 UI 提示。
- 真正发布时仍以浏览器插件实际执行结果为准。

### 建议新增方法

`getAuthSnapshot`

### 请求

```json
{
  "platforms": ["zhihu", "juejin"],
  "maxAgeMs": 86400000
}
```

字段说明：

- `platforms` 可选。为空时返回所有已有缓存的平台。
- `maxAgeMs` 可选。用于告诉调用方希望读取多新的缓存，但不要求浏览器插件必须做实时刷新。

### 响应建议

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
      "username": "林小卫很行",
      "checkedAt": 1770000000000,
      "lastSuccessAt": 1770000000000,
      "lastFailureAt": 0,
      "error": ""
    },
    {
      "id": "juejin",
      "name": "掘金",
      "authKnown": true,
      "authenticated": false,
      "username": "",
      "checkedAt": 1770000000000,
      "lastSuccessAt": 0,
      "lastFailureAt": 1770000000000,
      "error": "登录状态已失效"
    }
  ]
}
```

如果某个平台从未检测过：

```json
{
  "id": "csdn",
  "name": "CSDN",
  "authKnown": false,
  "authenticated": false,
  "username": "",
  "checkedAt": 0,
  "lastSuccessAt": 0,
  "lastFailureAt": 0,
  "error": ""
}
```

### 快照来源建议

缓存可以由这些事件更新：

- 用户在浏览器插件 UI 中检测登录状态。
- Obsidian 调用已有 `checkAuth` 后返回结果。
- 某个平台发布成功时，把该平台标记为最近可用。
- 某个平台发布失败且错误明确为登录失效时，把该平台标记为最近不可用。

### 重要约束

- `getAuthSnapshot` 默认只读缓存，不应该触发逐平台实时检测。
- 不返回 cookie、token、localStorage 等敏感数据。
- 登录状态只是提示，不是最终保证。发布时仍可能因为平台登录过期、风控、网络问题失败。

### Obsidian 侧预期用法

- 设置页平台选择区展示“未检测 / 上次可用 / 可用 · 用户名 / 未登录”等轻量状态。
- 发布弹窗只展示选中平台和上次状态，不默认实时扫描所有平台。
- 用户需要主动点击“检测已选平台登录状态”时，才调用实时检测。

### 验收标准

- `getAuthSnapshot` 在平台较多时也能快速返回。
- 对没有缓存的平台返回 `authKnown:false`，不要卡住。
- 发布成功或登录检测成功后，快照能更新。
- 发布失败如果明确是登录问题，快照能更新为不可用。

## 能力发现与兼容

建议 `health` 返回版本和能力声明，方便 Obsidian 做 feature detection：

```json
{
  "ok": true,
  "version": "2.0.0",
  "capabilities": {
    "enqueueSyncArticle": true,
    "listSupportedPlatforms": true,
    "checkAuth": true,
    "getSyncTask": true,
    "getSyncTaskLink": true,
    "openSyncTask": false,
    "getAuthSnapshot": true
  }
}
```

Obsidian 侧会按能力渐进增强：

- 老版本浏览器插件没有这些能力时，仍保持当前“推送成功后提示去扩展查看”的体验。
- 新版本支持 `getSyncTask` 时，才展示任务状态入口。
- 新版本支持 `getSyncTaskLink` 或 `openSyncTask` 时，才展示“查看任务”按钮。
- 新版本支持 `getAuthSnapshot` 时，才展示浏览器插件侧缓存的登录状态。

## 建议优先级

### P0：`getSyncTask`

这是最关键的闭环能力。Obsidian 已经能拿到 `syncId`，只差通过 `syncId` 查到任务状态。

### P1：`getAuthSnapshot`

它可以显著改善设置页和发布弹窗体验，避免每次打开都实时扫平台。

### P1/P2：`getSyncTaskLink` 或 `openSyncTask`

如果浏览器扩展技术上能打开自己的历史页或任务页，这会让用户体验明显更顺。如果浏览器限制较多，可以先返回 `canOpen:false` 和人工查看指引。

## 给浏览器插件项目的评估问题

1. MCP/bridge 层是否能读取 active sync state 和 history state？
2. `syncId` 是否已经稳定写入 history item，并能长期查询？
3. 当前 history item 中是否已经保存每个平台的 `status`、`error`、`username`、`draftUrl` 或 `postUrl`？
4. 浏览器插件 background/MCP 是否能打开自己的 popup、history page 或 extension page？
5. 如果不能打开具体任务，是否至少能打开历史页，或者返回用户可手动定位的任务 ID？
6. 登录状态缓存应该存在 extension storage、popup store，还是 background service 里？
7. 是否已有 extension version 或 capabilities 字段？如果没有，是否可以在 `health` 中新增？

## Obsidian 侧后续改造计划

等浏览器插件侧确认可行后，Obsidian 插件可以做这些渐进增强：

- 在 enqueue 成功后保存 `{ syncId, title, platforms, createdAt }` 到最近任务状态。
- 成功 Notice 增加“查看任务”入口。
- 发布弹窗增加轻量任务结果区，但不默认长轮询。
- 设置页读取 `getAuthSnapshot`，展示浏览器插件侧缓存的登录状态。
- 如果 `health.capabilities` 不支持这些新能力，则自动降级到现有体验。

## 总结

本轮浏览器插件增强的核心不是让 Obsidian 接管整套发布结果页，而是让 Wechatsync 已经拥有的任务状态和登录状态通过 bridge/MCP 暴露出来。

最小可交付版本可以只做两件事：

1. `enqueueSyncArticle` 返回 `syncId` 后，`getSyncTask(syncId)` 能查到任务。
2. `getAuthSnapshot` 能快速返回上次已知登录状态。

在这个基础上，如果还能支持 `getSyncTaskLink` 或 `openSyncTask`，Obsidian 侧就能提供更自然的“推送成功 -> 查看浏览器插件任务”的体验。
