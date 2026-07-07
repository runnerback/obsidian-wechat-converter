// 模板注册表:原上游用 require('./x.json')(仅 esbuild 可用),
// 已把 json 机械转为 .ts 模块,esbuild / vitest / Node strip-only 三方通吃。
import defaultTemplate from './default.ts';
import minimalTemplate from './minimal.ts';
import elegantTemplate from './elegant.ts';
import cyberTemplate from './cyber.ts';
import warmTemplate from './warm.ts';
import forestTemplate from './forest.ts';
import oceanTemplate from './ocean.ts';
import sakuraTemplate from './sakura.ts';
import starryTemplate from './starry.ts';
import metalTemplate from './metal.ts';
import yuelingTemplate from './yueling.ts';

export const templates = {
    default: defaultTemplate,
    minimal: minimalTemplate,
    elegant: elegantTemplate,
    cyber: cyberTemplate,
    warm: warmTemplate,
    forest: forestTemplate,
    ocean: oceanTemplate,
    sakura: sakuraTemplate,
    starry: starryTemplate,
    metal: metalTemplate,
    yueling: yuelingTemplate
};
