import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ai-portfolio-assistant/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'web-llm': ['@mlc-ai/web-llm'],
          'transformers': ['@huggingface/transformers'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
});
