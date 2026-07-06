// 自用微信公众号 API 中转代理
// ------------------------------------------------------------
// 用途：给 Obsidian「微信发布助手」插件用。插件把发往 api.weixin.qq.com 的
// 请求 POST 到本服务，由 ECS 的固定公网 IP 转发出去，从而绕开
// “本机 IP 经常变 → 微信 IP 白名单漂移 → 同步失败” 的问题。
// 微信公众号后台只需把这台 ECS 的公网 IP 加进 IP 白名单即可。
//
// 协议（插件 → 本服务，POST /proxy，JSON body）：
//   普通请求：{ url, method: 'GET' | 'POST', data? }
//   图片上传：{ url, method: 'UPLOAD', fileData(base64), fileName, mimeType, fieldName }
//   请求头可能带 X-Client-Id（插件本地设备 ID，仅透传/不校验）。
// 返回：原样透传微信的 HTTP 状态码 + JSON。
//
// 安全约束：
//   - 只允许转发到 https://api.weixin.qq.com/（其他域名一律拒绝，避免变成开放代理）；
//   - 可选 PROXY_TOKEN：设置后要求 ?token= 与之匹配，防止陌生人乱用你的 ECS；
//   - 仅在内存中转发，不落库、不打印含 AppSecret 的 URL。
//
// 运行环境：Node.js >= 18（用到全局 fetch / FormData / Blob，无需 node-fetch / form-data）。

require('dotenv').config();
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';
const WECHAT_API_PREFIX = 'https://api.weixin.qq.com/';
const MAX_UPLOAD_MB = 15; // 兼容大图 base64（微信封面/正文图）

app.use(express.json({ limit: `${MAX_UPLOAD_MB}mb` }));

// 健康检查（nginx / 部署验证用）
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'wechat-proxy', tokenRequired: !!PROXY_TOKEN, ts: Date.now() });
});

// 核心转发
app.post('/proxy', async (req, res) => {
  // 可选 token 校验：URL 里带 ?token=xxx
  if (PROXY_TOKEN && req.query.token !== PROXY_TOKEN) {
    return res.status(401).json({ error: 'proxy token 无效或缺失' });
  }

  const { url, method = 'GET', data, fileData, fileName, mimeType, fieldName = 'media' } = req.body || {};

  // 域名白名单：只准转发微信官方 API
  if (typeof url !== 'string' || !url.startsWith(WECHAT_API_PREFIX)) {
    return res.status(400).json({ error: '非法 URL，仅允许转发 api.weixin.qq.com' });
  }

  try {
    const m = String(method).toUpperCase();
    let wechatResp;

    if (m === 'UPLOAD') {
      // 图片上传：base64 → Blob → multipart/form-data
      if (!fileData) {
        return res.status(400).json({ error: '缺少图片二进制数据 fileData' });
      }
      const bytes = Buffer.from(fileData, 'base64');
      const form = new FormData();
      form.append(fieldName, new Blob([bytes], { type: mimeType || 'image/jpeg' }), fileName || 'image.jpg');
      wechatResp = await fetch(url, { method: 'POST', body: form });
    } else if (m === 'POST') {
      wechatResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data !== undefined ? JSON.stringify(data) : undefined,
      });
    } else {
      wechatResp = await fetch(url, { method: 'GET' });
    }

    const text = await wechatResp.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return res.status(502).json({ error: '微信服务器返回了非 JSON 响应' });
    }
    // 原样透传微信状态码 + JSON
    return res.status(wechatResp.status).json(json);
  } catch (err) {
    // 只打印错误消息，绝不打印 url（含 AppSecret / access_token）
    console.error('[wechat-proxy] 转发失败:', err.message);
    return res.status(502).json({ error: '代理中转失败，请稍后重试' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[wechat-proxy] listening on http://${HOST}:${PORT}  (token 校验: ${PROXY_TOKEN ? '开' : '关'})`);
});
