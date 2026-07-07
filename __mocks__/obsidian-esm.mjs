// ESM shim:给 Node 原生 ESM 链(rednote 动态 import 的 TS 链)提供
// 'obsidian' 的命名导出。CJS mock 无法被 Node 静态解析出 named exports,
// 这里显式 re-export;CJS mock 缺少的类补最小空壳(App/TFile/WorkspaceLeaf)。
// 由 tests/helpers/obsidian-resolver.cjs 的 registerHooks 按 ESM 上下文指到本文件。
import mock from './obsidian.js';

export default mock;

export const Plugin = mock.Plugin;
export const ItemView = mock.ItemView;
export const Notice = mock.Notice;
export const MarkdownView = mock.MarkdownView;
export const MarkdownRenderer = mock.MarkdownRenderer;
export const PluginSettingTab = mock.PluginSettingTab;
export const Setting = mock.Setting;
export const Modal = mock.Modal;
export const requestUrl = mock.requestUrl;
export const request = mock.request;
export const setIcon = mock.setIcon;

// CJS mock 未提供的最小空壳(仅类型占位,rednote 运行路径按需扩展)
export const App = mock.App || class App {};
export const TFile = mock.TFile || class TFile {};
export const WorkspaceLeaf = mock.WorkspaceLeaf || class WorkspaceLeaf {};
