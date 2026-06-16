/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports -- Render pipeline composes dynamic renderer implementations selected at runtime. */
class NativeRenderPipeline {
  constructor({ nativeRenderer, candidateRenderer }) {
    this.nativeRenderer = candidateRenderer || nativeRenderer;
  }

  async renderForPreview(markdown, context = {}) {
    if (typeof this.nativeRenderer !== 'function') {
      throw new Error('Triplet render pipeline is not implemented yet');
    }
    return this.nativeRenderer(markdown, context);
  }

  async renderForExport(markdown, context = {}) {
    return {
      html: await this.renderForPreview(markdown, context),
      diagnostics: [],
    };
  }
}

function createRenderPipelines({ nativeRenderer, candidateRenderer }) {
  const nativePipeline = new NativeRenderPipeline({
    nativeRenderer,
    candidateRenderer,
  });
  return { nativePipeline };
}

module.exports = {
  NativeRenderPipeline,
  createRenderPipelines,
};
