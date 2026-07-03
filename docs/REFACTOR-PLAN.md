# input.js 拆分重构进度

> 目标:把 `input.js`(约 9100 行)从"上帝入口"拆成清晰、易维护的模块结构。行为保持不变;每阶段 `npm run build` + `npm test -- --run` + `npm run scan:guard` 全绿后才算完成。

## 铁律
1. 纯搬移,不改逻辑;方法移出类时 `this.x` → 传入的 `view.x`,签名不变。
2. 沿用现成模式:模块导出函数,首参 `view`(参考 `views/publish-modal/feishu.js`)。
3. 每个新 ESM 模块登记进 `eslint.config.js` 的 module 列表。
4. 不动 `generate:embedded`(内嵌的是 converter.js/themes)。
5. git 由用户本人操作。

## 基线
- 起始:input.js ≈ 9266 行(含此前新增功能)。
- 测试基线:见各阶段记录。

## 进度

| 阶段 | 内容 | 状态 | 备注 |
|---|---|---|---|
| 0 | 跟踪文档 + 修 flaky 测试 + 干净基线 | ✅ 完成 | 898/898 绿 |
| 1 | 抽纯函数工具 | ✅ 完成 | services/input-utils.js(22 个纯函数);898/898 绿 |
| 2 | 抽 Obsidian API 适配 shim | ✅ 完成 | services/obsidian-adapters.js(7 个 shim,非 obsidianApi 绑定);898/898 绿。obsidianApi 绑定的 getObsidian*/getAppleThemeApi 暂留 input.js |
| 3 | 抽 WechatAPI 类 | ✅ 完成 | services/wechat-api.js;顺带把 sleep 挪入 input-utils、6 个 obsidianApi 绑定 getter 挪入 obsidian-adapters(自解析 obsidian 单例);wechat_api 13/13 + 全量 898/898 绿 |
| 4 | 抽设置页 | ✅ 完成 | services/settings-defaults.js(常量)+ views/settings/apple-style-setting-tab.js(类本体,含 prototype 补丁);顺带 generateId→input-utils、GITHUB_REPOSITORY_URL/MULTI_PLATFORM_TAB_LABEL→settings-defaults、obsidianApi 从 adapters 导出。input.js 8431→7307 行。898/898 绿 |
| 5 | 抽发布弹窗与同步动作 | ✅ 基本完成 | ① 结果弹窗(multi-platform-result-modals.js)② 封面/素材选择 5 方法(cover-picker.js)③ 同步动作 6 方法(wechat-sync-actions.js:openWechatsyncTask/getWechatsyncTaskSnapshot/showMultiPlatformSyncModal/showFeishuSyncModal/recordPublishStatus/onSyncToWechat)④ 同步弹窗 UI 5 方法(wechat-sync-modal.js:showSyncFailureActions/promptConfigureWechatAccount/preparePublishModalShell/createPublishModeTabs/showSyncModal)。顺带 getEventTargetValue+getValueElementFromEvent→dom-utils.js。input.js 7307→5721。898/898 绿 |
| 6 | 抽 AI 排版 UI | ✅ 完成(View 侧) | AppleStyleView 上的 AI 排版方法全部抽到 `views/ai-layout/ai-layout-panel.js`(mixin，58 方法)：① 主面板簇 52 方法(getCurrentArticleAnyLayoutState…refreshAiLayoutPanel，含 AI 专用 copyPlainTextSnapshot)② 零散 6 方法(markAiLayoutSourceSwitch/completeAiLayoutSourceSwitch/isAiLayoutStaleSuppressedForPath、resetAiLayoutPanelViewState、generateAiLayoutForCurrentArticle/applyAiLayoutToPreview)+ 常量 AI_LAYOUT_SOURCE_SWITCH_STALE_SUPPRESS_MS 一并迁入。input.js 5721→3742。898/898 绿、scan 61 文件绿。⚠️ `getArticleLayoutState`/`saveArticleLayoutState` 是 **AppleStylePlugin** 的方法(经 `this.plugin.xxx` 调用)，不属 View，**保留在 input.js**；若日后要抽，需另建 Plugin 级 mixin(Object.assign 到 AppleStylePlugin.prototype)。 |
| 7 | 抽封面/会话/媒体辅助 | ✅ 核心完成 | 媒体/封面/资产处理 13 方法抽到 `views/publish-modal/media-assets.js`(mixin，3 簇)：① srcToBlob/processAllImages/processMathFormulas/svgToPngBlob/cleanHtmlForDraft ② prepareHtmlForWechatDraft/prepareHtmlForWechatsyncArticle/…ViaBridge/generateCoverThumbnailFromAsset ③ processImagesToDataURL/convertImageToLocally/blobToDataUrl/blobToJpegDataUrl。顺带把并发工具 `pMap` 下沉到 services/input-utils.js。input.js 3742→3347。898/898 绿、scan 62 文件绿。⏳ 零星剩余(不同关注点，未抽)：getFirstImageFromArticle、insertImageSwipeCallout*(编辑器命令) |
| 8 | 抽渲染管线 + 滚动同步核心(最高风险) | 进行中(渲染管线完成) | ✅ 渲染管线簇 7 方法抽到 `views/preview/render-pipeline.js`(mixin)：getActiveRenderPipeline/renderMarkdownForPreview/updateCurrentDoc/setPlaceholder/renderPlaceholderIcon/showRenderFailurePlaceholder/getMissingRenderNotice；占位图标常量 PLACEHOLDER_ICON_DATA_URL 一并迁入(brand_icon.test.js 路径同步更新)。input.js 3347→3244。898/898 绿、scan 63 文件绿。⏳ 剩**滚动同步核心**(registerScrollSync/canScrollElementInDirection/attachOverlayScrollGuard/scheduleActiveLeafRender/setPreviewLoading/restoreBasePreview/syncPreviewPresentationMode)+ 剪贴板/代码块(renderHTML/copyRichHTMLByClipboard/transformCodeBlocks*)——**交互重、单测覆盖不到，抽前务必人工实测**。 |

## 变更日志
- Phase 0: 修复 `tests/feishu_settings_tab.test.js` 硬编码月份(`2026-06`)导致的跨月 flaky —— 改为动态计算当前月份(与 `getFeishuApiUsageMonthKey` 一致)。
- Phase 5(续，接手 kiro 中断点): ① 清理 sync-actions 抽取后 input.js 残留的 7 个死导入。② 把 `getEventTargetValue`(及内部依赖 `getValueElementFromEvent`)从 input.js 纯函数下沉到 `services/dom-utils.js`(13+ 调用点改为 import)。③ 抽出同步弹窗 UI 5 方法到 `views/publish-modal/wechat-sync-modal.js`(mixin，Object.assign 到 prototype，`this` 不变)：showSyncFailureActions / promptConfigureWechatAccount / preparePublishModalShell / createPublishModeTabs / showSyncModal。input.js 6313→5721。全程 `node --check` + `eslint`(no-undef 兜底缺失导入)+ `npm run build` + `npm test -- --run`(898/898)+ `npm run scan:guard`(60 文件)全绿。
- Phase 6(主簇): 抽出 AI 排版主面板簇 52 方法到 `views/ai-layout/ai-layout-panel.js`(mixin)。纯搬移，`this` 不变；靠 eslint no-undef 兜出漏掉的 import（getEventTargetValue/extractImageRefsFromHtml/generateArticleLayout/deriveArticleLayoutStateForSelection/createObsidianFetchAdapter），并清理 input.js 侧 7 个新死导入。删除前三重边界校验(首行/尾行/方法数=52)防 off-by-one。input.js 5721→3999。898/898 绿、scan 61 文件绿。
- Phase 6(收尾): 抽出剩余 6 个零散 AI 方法(3 簇，自底向上删除防行号漂移)并入同一 mixin，常量 AI_LAYOUT_SOURCE_SWITCH_STALE_SUPPRESS_MS 迁入模块。**关键教训**：`getArticleLayoutState`/`saveArticleLayoutState` 虽名字像 AI 方法，但经类归属核查发现它们在 `AppleStylePlugin`(Object.assign 目标是 AppleStyleView.prototype，二者不同类)、经 `this.plugin.xxx` 调用 —— 若误并入 View mixin 会运行时崩，故保留原位。补 dom-utils(setElementHtml)/input-utils(toReadableError)/ai-layout(extractRenderedSectionFragments/renderArticleLayoutHtml) import，清理 input.js 侧 7 个死导入 + 常量定义。input.js 3999→3742。898/898 绿、scan 61 文件绿。
- Phase 8(渲染管线): 抽出渲染管线簇 7 方法到 `views/preview/render-pipeline.js`(mixin)。占位图标常量 PLACEHOLDER_ICON_DATA_URL 随 renderPlaceholderIcon 迁入模块，`tests/brand_icon.test.js` 的读取路径从 input.js 改为该模块(校验意图不变)。补 import：obsidianApi(MarkdownView)。input.js 3347→3244。898/898 绿、scan 63 文件绿。⚠️ 滚动同步核心(registerScrollSync 等)交互重、单测覆盖不到，留待人工实测后再抽。
- Phase 7: 抽出媒体/封面/资产处理 13 方法(3 簇)到 `views/publish-modal/media-assets.js`(mixin)，并把并发工具 `pMap` 从 input.js 下沉到 services/input-utils.js(export)。自底向上删除防漂移；eslint no-undef 兜出 pMap 缺失。补 import：obsidian-adapters(getActiveDocumentCompat/createFallbackSvgElement/getObsidianRequestUrl)、dom-utils(createHtmlContainer)、input-utils(toImageElements/dataUrlToBlob/pMap)、svg-rasterizer、wechat-media、wechat-html-cleaner、article-image-assets。清理 input.js 侧 9 个死导入。input.js 3742→3347。898/898 绿、scan 62 文件绿。
