import js from '@eslint/js';
import globals from 'globals';
import html from 'eslint-plugin-html';

export default [
  js.configs.recommended,
  {
    // The live app: a single inline <script> per file. eslint-plugin-html extracts and lints
    // it as regular browser JS -- these two must stay byte-identical (see CLAUDE.md), so linting
    // both, not just one, catches drift as well as real bugs.
    files: ['index.html', 'recipe-browser.html'],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Nearly every top-level function here is only ever called from an inline onclick="..."
      // HTML attribute string, which static analysis can't see as a use -- same reasoning as the
      // scripts/**/*.js block below. What actually matters for this file (catching a typo'd
      // identifier, an undefined global) still runs via js.configs.recommended's no-undef.
      'no-unused-vars': 'off',
    },
  },
  {
    // The service worker runs in its own global scope (self/caches/fetch/Response/URL as
    // ServiceWorkerGlobalScope, not window) -- a separate env block, not folded into the
    // index.html/recipe-browser.html one above, since browser globals don't apply here.
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['scripts/**/*.js', 'test-browser.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
];
