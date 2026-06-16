const js = require("@eslint/js");
const globals = require("globals");
const obsidianmd = require("eslint-plugin-obsidianmd");
const sdl = require("@microsoft/eslint-plugin-sdl");

module.exports = [
  js.configs.recommended,
  // Default CommonJS settings for plugin source files
  {
    files: ["**/*.js"],
    plugins: {
      obsidianmd: obsidianmd.default || obsidianmd,
      "@microsoft/sdl": sdl.default || sdl,
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
