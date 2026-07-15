// views/publish-modal/rednote-publish.js
//
// 小红书图卡发布准备(AppleStyleView mixin):薄封装,复用通用图卡准备流程
// (card-publish-mixin.js)。投递由「发布与分发 → 其他平台」统一发送流程执行:
// 勾选小红书时走图卡链路,失败则跳过、不阻断其他平台。

import { prepareCardArticle } from './card-publish-mixin.js';

export const rednotePublishMixin = {
  /**
   * 准备小红书图卡 article(渲染 + 落盘 sync-to-rednote/ + 截取,不投递)。
   * @returns {Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>}
   */
  async prepareRednoteCardArticle() {
    return prepareCardArticle(this, { prefix: 'rednote', label: '小红书', sourceKind: 'rednote-card' });
  },
};
