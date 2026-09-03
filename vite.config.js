import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
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

        // Copy index.html and its byte-identical duplicate (see CLAUDE.md) -- both are
        // first-class entry points, so neither copy is wrapped in the try/catch used below for
        // optional public/ assets: a missing file here should fail the build loudly, not ship a
        // silently-broken link.
        copyFileSync(join(process.cwd(), 'index.html'), join(distDir, 'index.html'))
        copyFileSync(join(process.cwd(), 'recipe-browser.html'), join(distDir, 'recipe-browser.html'))

        // Copy public assets
        try {
          copyFileSync(
            join(process.cwd(), 'public/foodenvy-complete-recipes.json'),
            join(distDir, 'foodenvy-complete-recipes.json')
          )
        } catch {
          console.warn('recipes file not found')
        }

        try {
          copyFileSync(
            join(process.cwd(), 'public/favicon.svg'),
            join(distDir, 'favicon.svg')
          )
        } catch {
          console.warn('favicon not found')
        }

        try {
          copyFileSync(
            join(process.cwd(), 'public/flavor-pairings.json'),
            join(distDir, 'flavor-pairings.json')
          )
        } catch {
          console.warn('flavor-pairings.json not found')
        }

        // PWA assets: manifest + service worker at dist root (sw.js needs to sit at the
        // deployed root so its scope covers everything under the GitHub Pages subpath -- a
        // nested path would only ever control its own subdirectory), plus icons.
        try {
          copyFileSync(join(process.cwd(), 'public/manifest.webmanifest'), join(distDir, 'manifest.webmanifest'))
        } catch {
          console.warn('manifest.webmanifest not found')
        }

        // sw.js gets a real build-time version stamped in, not a plain copy -- a service worker
        // only checks for updates by byte-diffing its own script, so a deploy that changes the
        // shell (index.html) but leaves this constant untouched is invisible to an already-
        // installed user's browser, and they silently keep the old cached HTML forever. A real
        // production incident (2026-08-31): a footer-collapse fix shipped without a version
        // bump, and installed users never saw it. Stamping a fresh timestamp on every build
        // removes the "did a human remember to bump it" failure mode entirely.
        try {
          const swSrc = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')
          writeFileSync(join(distDir, 'sw.js'), swSrc.replaceAll('__BUILD_VERSION__', String(Date.now())))
        } catch {
          console.warn('sw.js not found')
        }

        try {
          const iconsDir = join(distDir, 'icons')
          mkdirSync(iconsDir, { recursive: true })
          for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-apple-touch-180.png']) {
            copyFileSync(join(process.cwd(), 'public/icons', icon), join(iconsDir, icon))
          }
        } catch {
          console.warn('icons not found')
        }
      },
    },
  ],
})
