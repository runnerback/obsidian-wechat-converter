export function stripMarkdownFrontmatter(markdown = '') {
  return String(markdown || '').replace(
    /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/,
    ''
  );
}
