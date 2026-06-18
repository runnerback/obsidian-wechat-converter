/**
 * @typedef {{ sourcePath?: string, settings?: Record<string, unknown> }} RenderContext
 * @typedef {(markdown: string, context: RenderContext) => Promise<string> | string} RenderFunction
 */

export class NativeRenderPipeline {
  /**
   * @param {{ nativeRenderer?: RenderFunction, candidateRenderer?: RenderFunction }} options
   */
  constructor({ nativeRenderer, candidateRenderer }) {
    this.nativeRenderer = candidateRenderer || nativeRenderer;
  }

  /**
   * @param {string} markdown
   * @param {RenderContext} [context={}]
   * @returns {Promise<string>}
   */
  async renderForPreview(markdown, context = {}) {
    if (typeof this.nativeRenderer !== 'function') {
      throw new Error('Triplet render pipeline is not implemented yet');
    }
    return String(await this.nativeRenderer(markdown, context));
  }

  /**
   * @param {string} markdown
   * @param {RenderContext} [context={}]
   * @returns {Promise<{ html: string, diagnostics: unknown[] }>}
   */
  async renderForExport(markdown, context = {}) {
    return {
      html: await this.renderForPreview(markdown, context),
      diagnostics: [],
    };
  }
}

/**
 * @param {{ nativeRenderer?: RenderFunction, candidateRenderer?: RenderFunction }} options
 * @returns {{ nativePipeline: NativeRenderPipeline }}
 */
export function createRenderPipelines({ nativeRenderer, candidateRenderer }) {
  const nativePipeline = new NativeRenderPipeline({
    nativeRenderer,
    candidateRenderer,
  });
  return { nativePipeline };
}
