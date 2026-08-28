import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'copy-static-files',
      apply: 'build',
      enforce: 'post',
      generateBundle() {
        const distDir = join(process.cwd(), 'dist')
        mkdirSync(distDir, { recursive: true })

        // Copy index.html
        copyFileSync(join(process.cwd(), 'index.html'), join(distDir, 'index.html'))

        // Copy public assets
        try {
          copyFileSync(
            join(process.cwd(), 'public/foodenvy-complete-recipes.json'),
            join(distDir, 'foodenvy-complete-recipes.json')
          )
        } catch (e) {
          console.warn('recipes file not found')
        }

        try {
          copyFileSync(
            join(process.cwd(), 'public/favicon.svg'),
            join(distDir, 'favicon.svg')
          )
        } catch (e) {
          console.warn('favicon not found')
        }
      },
    },
  ],
})
