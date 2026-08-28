import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-recipe-browser',
      apply: 'build',
      enforce: 'post',
      generateBundle() {
        const src = join(process.cwd(), 'recipe-browser.html')
        const dest = join(process.cwd(), 'dist', 'recipe-browser.html')
        copyFileSync(src, dest)
      },
    },
  ],
  optimizeDeps: {
    include: ['@anthropic-ai/sdk'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
