// scripts/build-styles.mjs
//
// styles.css 构建器:把 styles/src/*.css(按文件名排序,数字前缀定顺序)
// 拼接成插件根目录的 styles.css(Obsidian 只加载这一个文件)。
//
//   node scripts/build-styles.mjs          # 生成 styles.css
//   node scripts/build-styles.mjs --check  # 校验 styles.css 与源一致(pretest 用)
//
// ⚠️ 不要直接编辑根目录 styles.css —— 它是生成产物,改 styles/src/ 下的模块。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'styles', 'src');
const outFile = path.join(root, 'styles.css');

const BANNER = `/*
THIS IS A GENERATED FILE — 由 scripts/build-styles.mjs 拼接 styles/src/*.css 产出。
不要直接编辑本文件;修改样式请编辑 styles/src/ 下对应模块后重新构建。
*/
`;

function buildStyles() {
    const files = fs.readdirSync(srcDir)
        .filter((f) => f.endsWith('.css'))
        .sort();
    if (files.length === 0) {
        throw new Error(`[build-styles] ${srcDir} 下没有任何 .css 模块`);
    }
    const parts = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8').replace(/\s+$/, ''));
    return `${BANNER}\n${parts.join('\n\n')}\n`;
}

const generated = buildStyles();

if (process.argv.includes('--check')) {
    const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
    if (current !== generated) {
        console.error('[build-styles] styles.css 与 styles/src/ 源不一致。');
        console.error('  可能原因:直接编辑了 styles.css,或改了源没重新构建。');
        console.error('  执行 `npm run generate:styles` 重新生成。');
        process.exit(1);
    }
    console.log('[build-styles] check ok');
} else {
    fs.writeFileSync(outFile, generated);
    console.log(`[build-styles] styles.css generated from ${fs.readdirSync(srcDir).filter(f => f.endsWith('.css')).length} modules`);
}
