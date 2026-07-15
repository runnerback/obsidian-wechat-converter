// views/publish-modal/x-publish.js
//
// X(Twitter)图卡草稿发布准备(AppleStyleView mixin):薄封装,复用通用图卡
// 准备流程(card-publish-mixin.js)。图卡渲染与小红书完全复用(X 的图片 =
// 小红书同款图卡)。投递由「发布与分发 → 其他平台」统一发送流程执行。

import { prepareCardArticle } from './card-publish-mixin.js';

export const xPublishMixin = {
  /**
   * 准备 X 图卡 article(渲染 + 落盘 sync-to-x/ + 截取,不投递)。
   * @returns {Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>}
   */
  async prepareXCardArticle() {
    return prepareCardArticle(this, { prefix: 'x', label: 'X', sourceKind: 'x-card' });
  },
};
