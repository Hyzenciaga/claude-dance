import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: 'electron/main.ts' },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: 'electron/preload.ts' },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'index.html') },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
})
