import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set([
  '.git',
  '.github',
  '__mocks__',
  'coverage',
  'dist',
  'lib',
  'node_modules',
  'RELEASE_NOTES',
  'scripts',
  'tests',
]);
const IGNORED_FILES = new Set([
  'main.js',
  'services/generated-embedded-deps.js',
  'services/ai-layout-runtime/generated-skills.js',
]);

const RULES = [
  {
    id: 'no-direct-html-write',
    message: 'Avoid direct rendered HTML writes. Use DOM helpers or add a narrow eslint-disable-next-line reason for intentional sanitized rendering.',
    pattern: /\b(?:innerHTML|outerHTML)\s=|\.insertAdjacentHTML\s*\(/,
  },
  {
    id: 'no-static-style-property-write',
    message: 'Avoid static element.style.foo assignment. Use setCssStyles(...) or style.setProperty("--css-var", value) for CSS variables.',
    pattern: /\.style\.(?!setProperty\b|removeProperty\b|getPropertyValue\b|cssText\b)[A-Za-z_$][\w$]*\s=/,
  },
  {
    id: 'no-native-blocking-dialog',
    message: 'Use Obsidian Modal or Notice instead of confirm(), alert(), or prompt().',
    pattern: /\b(?:confirm|alert|prompt)\s*\(/,
  },
  {
    id: 'no-fetch-data-url',
    message: 'Parse data: URLs locally instead of fetch(data:).',
    pattern: /\bfetch\s*\(\s*(['"`])data:/,
  },
  {
    id: 'require-eslint-disable-reason',
    message: 'eslint-disable comments must include a "-- reason" explanation for Obsidian scan exceptions.',
    pattern: /eslint-disable(?:-next-line|-line)?(?![^\n]*--)/,
  },
];

/**
 * @param {string} relativePath
 * @returns {boolean}
 */
function shouldScanFile(relativePath) {
  if (IGNORED_FILES.has(relativePath)) return false;
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => IGNORED_DIRS.has(part))) return false;
  return SCANNED_EXTENSIONS.has(path.extname(relativePath));
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT, absolutePath);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...await collectFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && shouldScanFile(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * @param {string} source
 * @param {number} index
 * @returns {number}
 */
function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isCommentOnlyLine(line) {
  return /^\s*(?:\/\/|\/\*|\*|\*)/.test(line);
}

/**
 * @param {string} source
 * @param {RegExp} pattern
 * @returns {{ index: number, match: string }[]}
 */
function findMatches(source, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const matches = [];
  let match;
  while ((match = regex.exec(source))) {
    matches.push({ index: match.index, match: match[0] });
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  return matches;
}

const findings = [];
const files = await collectFiles(ROOT);

for (const relativePath of files) {
  const source = await readFile(path.join(ROOT, relativePath), 'utf8');
  const lines = source.split('\n');

  for (const rule of RULES) {
    for (const match of findMatches(source, rule.pattern)) {
      const lineNumber = getLineNumber(source, match.index);
      const line = lines[lineNumber - 1] || '';
      if (rule.id !== 'require-eslint-disable-reason' && isCommentOnlyLine(line)) continue;
      findings.push({
        ...rule,
        file: relativePath,
        line: lineNumber,
        code: line.trim(),
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Obsidian scan risk guard found risky patterns:\n');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.id}`);
    console.error(`  ${finding.message}`);
    console.error(`  ${finding.code}\n`);
  }
  process.exit(1);
}

console.log(`Obsidian scan risk guard passed (${files.length} files checked).`);
