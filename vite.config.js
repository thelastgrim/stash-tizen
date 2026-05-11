import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [react()],
  base: './',                     // ← critical: relative paths for Tizen
  build: {
    outDir: 'dist',
    target: 'es2015',             // older WebKit on Tizen, be conservative
    assetsInlineLimit: 0,         // don't inline assets
    cssCodeSplit: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})