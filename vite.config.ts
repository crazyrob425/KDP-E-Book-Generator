import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'electron-build-script',
      writeBundle() {
         // Simple inline build for main process if not using a separate config
         require('esbuild').buildSync({
            entryPoints: ['electron/main.ts', 'electron/preload.ts'],
            bundle: true,
            platform: 'node',
            outdir: 'dist-electron',
            external: ['electron', 'playwright', 'express', 'ws', 'buffer'], // Externalize backend deps
            format: 'cjs',
         });
      }
    }
  ],
  base: './', // Important for Electron file:// protocol
  build: {
      outDir: 'dist',
      emptyOutDir: true,
  },
  server: {
      port: 5173,
      strictPort: true,
  }
})
