# wechat-proxy · 自用微信公众号 API 中转代理

> **版本**：v1.0.0 ｜ **最后更新**：2026-07-06
> 部署在个人 ECS 上，用固定公网 IP 转发微信请求，解决“本机 IP 经常变 → 微信 IP 白名单漂移 → 同步失败”。

---

## 1. 它解决什么问题

微信公众号「素材/草稿」API 要求把调用方 IP 加进后台白名单。你在家里/公司/热点之间切换，本机公网 IP 一直变，白名单跟不上，插件就报错。

把这台**固定公网 IP 的 ECS** 作为中转：插件把请求发给 ECS，ECS 再转发给微信。微信后台只需把 **ECS 的 IP** 加进白名单一次即可。

```
Obsidian 插件 ──HTTPS──►  ECS(nginx) ──►  app.js(:3000) ──►  api.weixin.qq.com
   (本机 IP 随便变)         wechat-proxy.runfast.xyz          (只认 ECS 固定 IP)
```

## 2. 协议（插件已内置，无需改插件）

插件在设置里填了「API 代理地址」后，会把微信请求 `POST` 到本服务 `/proxy`：

| 场景 | body |
|---|---|
| 普通请求 | `{ url, method: 'GET'\|'POST', data? }` |
| 图片上传 | `{ url, method: 'UPLOAD', fileData(base64), fileName, mimeType, fieldName }` |

本服务原样透传微信的状态码 + JSON。**只允许转发 `https://api.weixin.qq.com/`**，其他域名一律 400。

## 3. 安全设计

- **域名白名单**：只转发微信官方 API，杜绝被当成开放代理。
- **可选 token**：设 `PROXY_TOKEN` 后，代理地址必须带 `?token=xxx`，防陌生人蹭你的 ECS。
- **零存储**：只在内存中转发，不落库；错误日志只打消息、绝不打含 AppSecret 的 URL。
- **强制 HTTPS**：插件端拒绝 `http://` 代理地址（保护 AppSecret），所以 nginx 必须上证书。

## 4. 部署到 ECS（沿用 feishu-tool 那台：`115.190.207.149`）

> Node.js 需 ≥ 18（用到全局 `fetch`/`FormData`/`Blob`）。ECS 上已有 Node 22 + PM2 + nginx + certbot。

### 4.1 上传代码

在本机项目根目录执行（也可用 `npm run deploy:server`，见插件根 `package.json`）：

```bash
cd obsidian-plugin/obsidian-wechat-converter
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  server/ root@115.190.207.149:/var/www/wechat-proxy/
```

> `.env` 不 rsync（不覆盖 ECS 上的生产配置），首次需手动创建，见 4.2。

### 4.2 首次：配 .env + 装依赖 + 起服务

```bash
ssh root@115.190.207.149
cd /var/www/wechat-proxy

# 1) 配置 .env（生成一个随机口令）
cp .env.example .env
echo "PROXY_TOKEN=$(openssl rand -hex 16)" >> .env   # 或手动编辑 .env 填 PROXY_TOKEN
cat .env   # 记下 PROXY_TOKEN，后面填到插件里

# 2) 装依赖
npm install --production

# 3) PM2 启动 + 开机自启
pm2 start ecosystem.config.js
pm2 save
```

### 4.3 nginx + HTTPS（首次）

```bash
# 1) DNS：把 wechat-proxy.runfast.xyz 的 A 记录指向 115.190.207.149

# 2) 放置 nginx 配置
cp /var/www/wechat-proxy/deploy/nginx.wechat-proxy.conf.example \
   /etc/nginx/sites-available/wechat-proxy
ln -s /etc/nginx/sites-available/wechat-proxy /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 3) 签发证书（certbot 会自动补全 443 块并把 80 跳转 443）
certbot --nginx -d wechat-proxy.runfast.xyz
```

### 4.4 后续更新（改了代码）

```bash
# 本机
npm run deploy:server        # rsync + ssh 里 npm install + pm2 restart（见插件根 package.json）
# 或手动：
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  server/ root@115.190.207.149:/var/www/wechat-proxy/
ssh root@115.190.207.149 "cd /var/www/wechat-proxy && npm install --production && pm2 restart wechat-proxy"
```

## 5. 验证

```bash
# 健康检查
curl -s https://wechat-proxy.runfast.xyz/health
# 期望：{"ok":true,"service":"wechat-proxy","tokenRequired":true,...}

# PM2 状态 / 日志
ssh root@115.190.207.149 "pm2 status wechat-proxy && pm2 logs wechat-proxy --lines 20"
```

## 6. 配置插件 + 微信后台

1. **微信公众平台** → 设置与开发 → 基本配置 → IP 白名单 → 加入 **`115.190.207.149`**。
2. **Obsidian 插件设置** → 高级设置 → **API 代理地址** 填：
   ```
   https://wechat-proxy.runfast.xyz/proxy?token=<你的 PROXY_TOKEN>
   ```
   （没设 PROXY_TOKEN 就不带 `?token=`，但强烈建议设。）
3. 回插件里正常同步草稿即可，请求会走 ECS 转发。

## 7. 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 插件报 401 | 代理地址没带 / 带错 `?token=` | 核对 `.env` 里的 `PROXY_TOKEN`，补到代理地址 |
| 插件报 400「非法 URL」 | 代理地址填成别的路径/域名 | 必须是 `.../proxy`，且插件请求的是微信 API |
| 微信报 40164 / IP 不在白名单 | ECS IP 没加白名单 | 微信后台白名单加 `115.190.207.149` |
| 插件报「必须使用 HTTPS」 | 代理地址填了 `http://` | 用 `https://`，先把 4.3 的证书签好 |
| 502 | app.js 没起 / 端口不对 | `pm2 restart wechat-proxy`，确认 `.env` 的 PORT 与 nginx 一致 |

---

许可证：MIT。此为自用实现，未包含任何鉴权计费/设备绑定逻辑。
