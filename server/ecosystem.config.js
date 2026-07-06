// PM2 配置：ECS 上用 `pm2 start ecosystem.config.js` 启动 wechat-proxy。
// 环境变量（PORT / HOST / PROXY_TOKEN）从同目录 .env 读取（app.js 里 dotenv 加载），
// 这里不写敏感值，避免 token 进 git。
module.exports = {
  apps: [
    {
      name: 'wechat-proxy',
      script: 'app.js',
      cwd: '/var/www/wechat-proxy',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '150M',
    },
  ],
};
