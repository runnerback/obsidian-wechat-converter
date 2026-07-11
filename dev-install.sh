#!/bin/bash
#
# dev-install.sh —— 本地实测部署脚本
# 构建后把插件三件套（main.js / manifest.json / styles.css）拷到 Obsidian 插件目录，
# 供在 Obsidian 里直接实测。不打 zip（zip 归 package-release.sh 管，那是发布用）。
# 只拷三件套，绝不动 data.json（你的 AppID / 设置）。
#
# 用法：bash dev-install.sh
#
# vault 路径解析顺序（多台机器无需改本脚本）：
#   1. 环境变量 VAULT_PLUGIN_DIR（临时指定：VAULT_PLUGIN_DIR=/path bash dev-install.sh）
#   2. 本地配置文件 .vault-path.local（已 gitignore，每台机器可各写各的，内容为插件目录绝对路径）
#   3. 自动探测：读 Obsidian 的 obsidian.json，取当前打开（或最近使用）的 vault

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 插件目录名跟随 manifest.json 的 id，改名时无需同步改本脚本
PLUGIN_ID="$(node -p "require('$SCRIPT_DIR/manifest.json').id")"

resolve_plugin_dir() {
    # 1. 环境变量优先
    if [ -n "$VAULT_PLUGIN_DIR" ]; then
        echo "$VAULT_PLUGIN_DIR"
        return
    fi

    # 2. 本地配置文件（不进 git，每台机器独立）
    if [ -f "$SCRIPT_DIR/.vault-path.local" ]; then
        head -1 "$SCRIPT_DIR/.vault-path.local" | sed 's/[[:space:]]*$//'
        return
    fi

    # 3. 从 Obsidian 注册信息自动探测（优先取 open 的 vault，否则取最近使用的）
    local OBSIDIAN_JSON="$HOME/Library/Application Support/obsidian/obsidian.json"
    if [ -f "$OBSIDIAN_JSON" ]; then
        local VAULT_PATH
        VAULT_PATH="$(OBSIDIAN_JSON="$OBSIDIAN_JSON" node -p "
            const vaults = Object.values(require(process.env.OBSIDIAN_JSON).vaults || {});
            const pick = vaults.find(v => v.open) || vaults.sort((a, b) => (b.ts||0) - (a.ts||0))[0];
            pick ? pick.path : '';
        " 2>/dev/null)"
        if [ -n "$VAULT_PATH" ]; then
            echo "$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"
            return
        fi
    fi

    echo ""
}

VAULT_PLUGIN_DIR="$(resolve_plugin_dir)"

if [ -z "$VAULT_PLUGIN_DIR" ]; then
    echo "❌ 无法确定 Obsidian 插件目录。"
    echo "   请任选其一："
    echo "   a) 在仓库根目录创建 .vault-path.local，写入插件目录绝对路径"
    echo "   b) 运行时指定：VAULT_PLUGIN_DIR=/path/to/plugins/$PLUGIN_ID bash dev-install.sh"
    exit 1
fi

echo "🎯 目标插件目录：$VAULT_PLUGIN_DIR"
echo "🔨 构建 main.js ..."
npm run build

# 目录不存在时自动创建（首次在新机器部署）
if [ ! -d "$VAULT_PLUGIN_DIR" ]; then
    echo "📁 插件目录不存在，自动创建：$VAULT_PLUGIN_DIR"
    mkdir -p "$VAULT_PLUGIN_DIR"
fi

echo "📄 拷贝三件套到 Obsidian（不动 data.json）..."
cp main.js       "$VAULT_PLUGIN_DIR/main.js"
cp manifest.json "$VAULT_PLUGIN_DIR/manifest.json"
cp styles.css    "$VAULT_PLUGIN_DIR/styles.css"

echo "✅ 已部署到：$VAULT_PLUGIN_DIR"
echo "👉 目录若有 .hotreload 会自动热重载；否则在 Obsidian 里重载该插件（关开开关）。"
