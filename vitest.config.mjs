import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, './__mocks__/obsidian.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/helpers/obsidian-resolver.cjs'],
    server: {
      deps: {
        // rednote/ 为 note-to-red 移植的 TS 代码:强制走 vite 管道,
        // 使 obsidian → __mocks__ 的 alias 对其生效
        inline: ['obsidian', /rednote/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
