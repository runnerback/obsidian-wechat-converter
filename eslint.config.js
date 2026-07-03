import js from "@eslint/js";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";
import sdl from "@microsoft/eslint-plugin-sdl";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} pluginModule
 * @returns {Record<string, unknown>}
 */
function normalizePluginModule(pluginModule) {
  if (isRecord(pluginModule) && isRecord(pluginModule.default)) {
    return pluginModule.default;
  }
  return isRecord(pluginModule) ? pluginModule : {};
}

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  js.configs.recommended,
  // Default CommonJS settings for plugin source files
  {
    files: ["**/*.js"],
    plugins: {
      obsidianmd: normalizePluginModule(/** @type {unknown} */ (obsidianmd)),
      "@microsoft/sdl": normalizePluginModule(/** @type {unknown} */ (sdl)),
      "@typescript-eslint": normalizePluginModule(/** @type {unknown} */ (tsPlugin)),
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.commonjs,
        // Obsidian APIs & globals
        obsidian: "readonly",
        moment: "readonly",
        createFragment: "readonly",
        // Third-party globals loaded by the app
        hljs: "readonly",
        markdownit: "readonly",
        // Project specific globals to ignore
        AppleTheme: "readonly",
        AppleStyleConverter: "readonly",
        ActiveTripletRenderer: "readonly",
        ActiveTripletSerializer: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-prototype-builtins": "off",
      "no-useless-escape": "off",
      "no-constant-condition": "off",
      "no-cond-assign": "off",
      "no-extra-semi": "off",
      "no-inner-declarations": "off",
      "no-control-regex": "off", // Allow regex to check control characters like \x00
      "obsidianmd/no-static-styles-assignment": "error",
      "@microsoft/sdl/no-inner-html": "error",
    },
  },
  // Targeted ESM leaf modules. Keep this list explicit so the plugin entry
  // and dynamic Obsidian integration files can stay CommonJS until migrated.
  {
    files: [
      "eslint.config.js",
      "input.js",
      "services/markdown-utils.js",
      "services/ai-layout.js",
      "services/ai-layout-runtime/generated-skills.js",
      "services/ai-layout-runtime/registry.js",
      "services/ai-layout-skill-bundle.js",
      "services/article-image-assets.js",
      "services/chinese-punctuation.js",
      "services/dependency-loader.js",
      "services/dom-utils.js",
	      "services/feishu-api.js",
	      "services/feishu-markdown-processor.js",
	      "services/feishu-media-sync.js",
	      "services/feishu-mermaid-renderer.js",
	      "services/feishu-mermaid-remote-renderer.js",
	      "services/feishu-multipart.js",
	      "services/feishu-settings.js",
	      "services/feishu-sync.js",
      "services/path-utils.js",
      "services/markdown-source.js",
      "services/input-utils.js",
      "services/obsidian-adapters.js",
      "services/wechat-api.js",
      "services/settings-defaults.js",
      "services/publish-status.js",
      "services/render-pipeline.js",
      "services/obsidian-fetch-adapter.js",
      "services/native-renderer.js",
      "services/obsidian-triplet-renderer.js",
      "services/obsidian-triplet-serializer.js",
      "services/rendered-mermaid.js",
      "services/svg-rasterizer.js",
      "services/sync-context.js",
      "services/wechat-draft-cache.js",
      "services/wechat-html-cleaner.js",
      "services/wechat-media.js",
      "services/wechat-sync.js",
      "services/wechatsync-bridge.js",
      "services/wechatsync-constants.js",
      "services/wechatsync-results.js",
      "services/wechatsync-settings.js",
      "views/connection-status-bar.js",
      "views/publish-modal/feishu.js",
      "views/publish-modal/image-grid.js",
      "views/publish-modal/cover-picker.js",
      "views/publish-modal/multi-platform-result-modals.js",
      "views/publish-modal/wechat-sync-actions.js",
      "views/publish-modal/wechat-sync-modal.js",
      "views/ai-layout/ai-layout-panel.js",
      "views/publish-modal/media-assets.js",
      "views/preview/render-pipeline.js",
      "views/publish-modal/multi-platform.js",
      "views/settings/feishu-tab.js",
      "views/settings/apple-style-setting-tab.js",
      "views/settings/multi-platform-tab.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-prototype-builtins": "off",
      "no-useless-escape": "off",
      "no-constant-condition": "off",
      "no-cond-assign": "off",
      "no-extra-semi": "off",
      "no-inner-declarations": "off",
      "no-control-regex": "off",
      "obsidianmd/no-static-styles-assignment": "error",
      "@microsoft/sdl/no-inner-html": "error",
    },
  },
  // ES Modules settings for tests, scripts, and .mjs files
  {
    files: ["tests/**/*.js", "**/scripts/**/*.mjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        console: "readonly",
        process: "readonly",
        // vitest globals
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-prototype-builtins": "off",
      "no-useless-escape": "off",
      "no-constant-condition": "off",
      "no-cond-assign": "off",
      "no-extra-semi": "off",
      "no-inner-declarations": "off",
      "no-control-regex": "off",
      "@microsoft/sdl/no-inner-html": "off",
    }
  },
  {
    files: ["__mocks__/**/*.js"],
    rules: {
      "@microsoft/sdl/no-inner-html": "off",
    },
  },
  // CommonJS override for .cjs files
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-control-regex": "off",
    }
  },
  {
    ignores: [
      "main.js",
      "node_modules/",
      "coverage/",
      "lib/",
      "services/generated-embedded-deps.js",
      "dist/",
    ],
  }
];
