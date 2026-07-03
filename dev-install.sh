#!/bin/bash
#
# dev-install.sh —— 本地实测部署脚本
# 构建后把插件三件套（main.js / manifest.json / styles.css）拷到 Obsidian 插件目录，
# 供在 Obsidian 里直接实测。不打 zip（zip 归 package-release.sh 管，那是发布用）。
# 只拷三件套，绝不动 data.json（你的 AppID / 设置）。
#
# 用法：bash dev-install.sh
# 换机器 / 换 vault 时，改下面的 VAULT_PLUGIN_DIR 即可。

set -e

# Obsidian 目标插件目录
VAULT_PLUGIN_DIR="/Users/zhangjianbo/Documents/SynologyDrive/COMMON/12 notes/Obsidian-repository/.obsidian/plugins/wechat-converter"

echo "🔨 构建 main.js ..."
npm run build

if [ ! -d "$VAULT_PLUGIN_DIR" ]; then
    echo "❌ 插件目录不存在：$VAULT_PLUGIN_DIR"
    echo "   请先确认 vault 路径，或改本脚本顶部的 VAULT_PLUGIN_DIR。"
    exit 1
fi

echo "📄 拷贝三件套到 Obsidian（不动 data.json）..."
cp main.js       "$VAULT_PLUGIN_DIR/main.js"
cp manifest.json "$VAULT_PLUGIN_DIR/manifest.json"
cp styles.css    "$VAULT_PLUGIN_DIR/styles.css"

echo "✅ 已部署到：$VAULT_PLUGIN_DIR"
echo "👉 目录若有 .hotreload 会自动热重载；否则在 Obsidian 里重载该插件（关开开关）。"
