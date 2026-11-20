import { defineConfig } from 'vite';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  base: './',
  server: { headers: isolation, port: 5173 },
  preview: { headers: isolation },
  build: {
    outDir: '../app',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { assetFileNames: (a) => (a.names?.[0]?.endsWith('.wasm') ? 'assets/[name][extname]' : 'assets/[name]-[hash][extname]') },
    },
  },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
