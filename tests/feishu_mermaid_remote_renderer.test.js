import { describe, it, expect, vi } from 'vitest';

const {
  DEFAULT_KROKI_MAX_IMAGE_BYTES,
  DEFAULT_KROKI_MERMAID_PNG_ENDPOINT,
  normalizeKrokiEndpoint,
  renderMermaidWithKroki,
} = await import('../services/feishu-mermaid-remote-renderer.js');

describe('Feishu Mermaid remote renderer', () => {
  it('should render Mermaid through Kroki POST and return a PNG data URL', async () => {
    const requestUrl = vi.fn(async () => ({
      status: 200,
      headers: { 'content-type': 'image/png' },
      arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
    }));

    const dataUrl = await renderMermaidWithKroki('graph TD\nA-->B', { requestUrl });

    expect(dataUrl).toBe('data:image/png;base64,AQID');
    expect(requestUrl).toHaveBeenCalledWith({
      url: DEFAULT_KROKI_MERMAID_PNG_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'image/png',
      },
      body: JSON.stringify({ diagram_source: 'graph TD\nA-->B' }),
      throw: false,
    });
  });

  it('should read Obsidian requestUrl arrayBuffer functions safely', async () => {
    const requestUrl = vi.fn(async () => ({
      status: 200,
      headers: { 'content-type': 'image/png' },
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
    }));

    const dataUrl = await renderMermaidWithKroki('graph TD\nA-->B', { requestUrl });

    expect(dataUrl).toBe('data:image/png;base64,BAUG');
  });

  it('should require HTTPS Kroki endpoints', () => {
    expect(normalizeKrokiEndpoint('https://kroki.example.com/mermaid/png')).toBe('https://kroki.example.com/mermaid/png');
    expect(() => normalizeKrokiEndpoint('http://kroki.example.com/mermaid/png')).toThrow('Kroki 渲染服务必须使用 HTTPS');
    expect(() => normalizeKrokiEndpoint('not-a-url')).toThrow('Kroki 渲染服务地址无效');
  });

  it('should fail when Kroki returns non-image content', async () => {
    const requestUrl = vi.fn(async () => ({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
    }));

    await expect(renderMermaidWithKroki('graph TD\nA-->B', { requestUrl }))
      .rejects.toThrow('Kroki Mermaid 渲染返回了非图片内容');
  });

  it('should fail when Kroki returns an HTTP error', async () => {
    const requestUrl = vi.fn(async () => ({
      status: 500,
      headers: { 'content-type': 'text/plain' },
      text: 'boom',
    }));

    await expect(renderMermaidWithKroki('graph TD\nA-->B', { requestUrl }))
      .rejects.toThrow('Kroki Mermaid 渲染失败 (500)');
  });

  it('should fail before base64 conversion when Kroki image is too large', async () => {
    const requestUrl = vi.fn(async () => ({
      status: 200,
      headers: { 'content-type': 'image/png' },
      arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
    }));

    await expect(renderMermaidWithKroki('graph TD\nA-->B', {
      requestUrl,
      maxImageBytes: 2,
    })).rejects.toThrow('Kroki Mermaid 渲染图片过大 (3 bytes)');
    expect(DEFAULT_KROKI_MAX_IMAGE_BYTES).toBeGreaterThan(1024 * 1024);
  });
});
