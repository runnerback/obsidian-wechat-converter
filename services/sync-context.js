function resolveSyncAccount({ accounts, selectedAccountId, defaultAccountId }) {
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length === 0) return null;

  if (selectedAccountId) {
    const selected = list.find((account) => account.id === selectedAccountId);
    if (selected) return selected;
  }

  if (defaultAccountId) {
    const byDefault = list.find((account) => account.id === defaultAccountId);
    if (byDefault) return byDefault;
  }

  return list[0];
}

function toSyncFriendlyMessage(errorMessage = '') {
  if (errorMessage.includes('45002')) {
    return '文章太长，微信接口拒收。建议分篇发送，或使用插件顶部的「复制」按钮手动粘贴到公众号后台。';
  }
  if (/invalid content|invalld content|45166/i.test(errorMessage)) {
    return '微信接口拒收正文内容（invalid content）。常见原因是正文里仍有未上传图片、无效链接或微信不支持的 HTML。请根据上方同步提示检查正文图片和复杂粘贴内容后重试。';
  }
  if (errorMessage.includes('status 403')) {
    return '访问中转代理服务器被拒绝 (HTTP 403)。请检查您的代理地址和 Token 是否正确。';
  }
  if (errorMessage.includes('status 401')) {
    return '访问中转代理服务器未授权 (HTTP 401)。请检查您的代理地址和 Token 是否正确。';
  }
  return errorMessage;
}

module.exports = {
  resolveSyncAccount,
  toSyncFriendlyMessage,
};
