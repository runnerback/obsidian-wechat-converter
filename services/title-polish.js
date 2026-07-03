// services/title-polish.js
//
// 标题 AI 润色：根据文章正文，让 LLM（DeepSeek，OpenAI 兼容接口）生成 5 个候选标题。
// 客户端直接调（走 Obsidian requestUrl 绕 CORS）。key/base/model 来自插件设置。
// 注意：公司代理可能对出网做 TLS 重置，若 requestUrl 报网络错，需改走服务端中转。

const MAX_CONTENT_CHARS = 8000; // 正文过长时截断，够 LLM 抓住主旨即可
const TITLE_COUNT = 5;

/**
 * 剥掉标题开头的时间码括号，如 "(06-24-1435)特斯拉..." / "（06-24-1435）特斯拉..." → "特斯拉..."
 * 只剥开头第一个括号（半角/全角都支持），不动正文里的其他括号。
 * @param {string} title
 * @returns {string}
 */
export function stripTitleTimecodePrefix(title) {
  return String(title || '').replace(/^\s*[（(][^）)]*[）)]\s*/, '').trim();
}

/**
 * @param {string} raw LLM 返回的 content
 * @returns {string[]} 解析出的标题数组（尽力而为）
 */
function parseTitles(raw) {
  let text = String(raw || '').trim();
  // 去掉可能的 markdown 代码块包裹
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // 优先按 JSON 数组解析
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) {
      return arr.map((t) => String(t || '').trim()).filter(Boolean);
    }
  } catch {
    // 落到按行解析
  }
  // 兜底：按行拆，去掉行首的序号/符号（1. / - / 、 等）
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[.、)]|[-*·])\s*/, '').replace(/^["'“”]|["'“”]$/g, '').trim())
    .filter(Boolean)
    .slice(0, TITLE_COUNT);
}

/**
 * 调 LLM 为文章生成 5 个候选标题。
 * @param {{
 *   requestUrl: (options: Record<string, unknown>) => Promise<{ status: number, json?: any, text?: string }>,
 *   apiBase: string,
 *   apiKey: string,
 *   model: string,
 *   currentTitle: string,
 *   articleMarkdown: string,
 * }} params
 * @returns {Promise<string[]>} 5 个候选标题（可能少于 5 个，取决于模型返回）
 */
export async function polishTitleWithLlm({ requestUrl, apiBase, apiKey, model, currentTitle, articleMarkdown }) {
  if (!apiKey) throw new Error('未配置 DeepSeek API Key，请在插件设置里填写');
  if (typeof requestUrl !== 'function') throw new Error('requestUrl 不可用');

  const cleanTitle = stripTitleTimecodePrefix(currentTitle);
  const content = String(articleMarkdown || '').trim().slice(0, MAX_CONTENT_CHARS);
  if (!content) throw new Error('当前没有可用的文章正文，请先打开并渲染一篇文章');

  const prompt = [
    '你是资深的微信公众号编辑。请根据下面的文章正文，为这篇文章优化标题。',
    '要求：',
    '1. 紧扣正文核心，不夸大、不标题党到失真；',
    '2. 适合微信公众号传播，有吸引力；',
    '3. 每个标题不超过 30 个汉字；',
    `4. 给出 ${TITLE_COUNT} 个不同角度/风格的候选，彼此有区分度；`,
    '5. 只返回一个 JSON 字符串数组（例如 ["标题一","标题二",...]），不要任何解释、不要 markdown 代码块。',
    '',
    `当前标题（供参考，可完全重写）：${cleanTitle || '（无）'}`,
    '',
    '文章正文：',
    content,
  ].join('\n');

  const resp = await requestUrl({
    url: `${String(apiBase || '').replace(/\/+$/, '')}/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    }),
    throw: false,
  });

  if (!resp || resp.status < 200 || resp.status >= 300) {
    const detail = resp?.text ? String(resp.text).slice(0, 300) : `HTTP ${resp?.status}`;
    throw new Error(`LLM 调用失败：${detail}`);
  }

  const data = resp.json || (resp.text ? JSON.parse(resp.text) : null);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('LLM 返回为空');

  const titles = parseTitles(raw).slice(0, TITLE_COUNT);
  if (titles.length === 0) throw new Error('未能从 LLM 返回中解析出标题');
  return titles;
}
