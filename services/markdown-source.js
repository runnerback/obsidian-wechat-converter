/**
 * @typedef {{ path?: string }} MarkdownFileLike
 * @typedef {{ getValue: () => string }} MarkdownEditorLike
 * @typedef {{ editor?: MarkdownEditorLike, file?: MarkdownFileLike | null }} MarkdownViewLike
 * @typedef {{ getActiveViewOfType: (viewType: unknown) => MarkdownViewLike | null | undefined }} WorkspaceLike
 * @typedef {{ read: (file: MarkdownFileLike) => Promise<string> }} VaultLike
 * @typedef {{ workspace: WorkspaceLike, vault: VaultLike }} AppLike
 */

/**
 * Resolves the markdown source from the active editor first, then falls back
 * to the last active file. The structural typedefs keep this dynamic Obsidian
 * boundary narrow without changing runtime behavior.
 *
 * @param {{ app: AppLike, lastActiveFile?: MarkdownFileLike | null, MarkdownViewType: unknown }} params
 */
async function resolveMarkdownSource({ app, lastActiveFile, MarkdownViewType }) {
  const activeView = app.workspace.getActiveViewOfType(MarkdownViewType);

  if (!activeView && lastActiveFile) {
    try {
      const markdown = await app.vault.read(lastActiveFile);
      return {
        ok: true,
        markdown,
        sourcePath: lastActiveFile.path || '',
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'NO_ACTIVE_FILE',
        error,
      };
    }
  }

  if (activeView) {
    return {
      ok: true,
      markdown: activeView.editor ? activeView.editor.getValue() : '',
      sourcePath: activeView.file ? activeView.file.path : '',
    };
  }

  return {
    ok: false,
    reason: 'NO_ACTIVE_FILE',
  };
}

module.exports = {
  resolveMarkdownSource,
};
