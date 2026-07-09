import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const ROOT = process.cwd();

const SOURCE_FILES = {
  markdownIt: path.join(ROOT, 'lib', 'markdown-it.min.js'),
  highlight: path.join(ROOT, 'lib', 'highlight.min.js'),
  mathjax: path.join(ROOT, 'lib', 'mathjax-plugin.js'),
};

async function ensureOrGenerateDeps() {
  // Ensure lib directory exists
  fs.mkdirSync(path.join(ROOT, 'lib'), { recursive: true });

  // 1. Copy markdown-it.min.js from node_modules
  const mdItSrc = path.join(ROOT, 'node_modules', 'markdown-it', 'dist', 'markdown-it.min.js');
  const mdItDest = SOURCE_FILES.markdownIt;
  if (!fs.existsSync(mdItSrc)) {
    throw new Error('markdown-it is not installed in node_modules. Run npm install first.');
  }
  const mdItContent = fs.readFileSync(mdItSrc, 'utf8');
  fs.writeFileSync(mdItDest, mdItContent, 'utf8');
  console.log('[generate-embedded-deps] Generated lib/markdown-it.min.js from node_modules');

  // 2. Bundle highlight.js/lib/common.js
  const hljsEntry = path.join(ROOT, 'node_modules', 'highlight.js', 'lib', 'common.js');
  const hljsDest = SOURCE_FILES.highlight;
  if (!fs.existsSync(hljsEntry)) {
    throw new Error('highlight.js is not installed in node_modules. Run npm install first.');
  }
  console.log('[generate-embedded-deps] Bundling highlight.js...');
  const hljsResult = await esbuild.build({
    entryPoints: [hljsEntry],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    globalName: 'hljs',
  });
  let hljsCode = hljsResult.outputFiles[0].text;
  // Append CommonJS compatibility export for tests
  hljsCode += '\nif (typeof module !== "undefined" && module.exports) { module.exports = hljs; }\n';
  fs.writeFileSync(hljsDest, hljsCode, 'utf8');
  console.log('[generate-embedded-deps] Generated lib/highlight.min.js via esbuild');

  // 3. Bundle mathjax-plugin.js
  const mathEntry = path.join(ROOT, 'lib', 'math-entry.js');
  const mathDest = SOURCE_FILES.mathjax;
  if (!fs.existsSync(mathEntry)) {
    throw new Error('Missing lib/math-entry.js for MathJax bundling.');
  }
  console.log('[generate-embedded-deps] Bundling MathJax plugin...');
  const banner = `/* Obsidian WeChat MathJax Plugin (Bundled) */`;
  const mathResult = await esbuild.build({
    entryPoints: [mathEntry],
    bundle: true,
    write: false,
    format: 'iife',
    minify: true,
    banner: { js: banner },
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      'PACKAGE_VERSION': '"3.2.2"'
    },
    external: ['katex'],
    plugins: [
      {
        name: 'package-json-stub',
        setup(build) {
          build.onResolve({ filter: /package\.json$/ }, args => {
            return { path: args.path, namespace: 'package-json-stub' }
          })
          build.onLoad({ filter: /.*/, namespace: 'package-json-stub' }, () => {
            return {
              contents: JSON.stringify({ version: "0.0.0" }),
              loader: 'json',
            }
          })
        },
      }
    ]
  });
  const mathCode = mathResult.outputFiles[0].text;
  fs.writeFileSync(mathDest, mathCode, 'utf8');
  console.log('[generate-embedded-deps] Generated lib/mathjax-plugin.js via esbuild');
}

async function main() {
  // Generate the embedded lib bundles (lib/*.js) consumed by services/dependency-loader.js
  await ensureOrGenerateDeps();
}

main().catch(err => {
  console.error('[generate-embedded-deps] failed:', err);
  process.exit(1);
});

