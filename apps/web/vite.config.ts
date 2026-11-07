import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { appShellNavigation } from './src/pwa/appShellNavigation';
import { cardImageCaching } from './src/pwa/cardImageCaching';

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackAllowlist: [appShellNavigation(base)],
        // Fonts and the playmat drawings are part of the app shell, so the PWA looks the same offline.
        globPatterns: ['**/*.{js,css,html,woff2,svg}'],
        // The design prototypes change while they are discussed; precached, a phone keeps showing an old copy.
        globIgnores: ['prototype/**'],
        runtimeCaching: [cardImageCaching],
      },
      manifest: {
        name: 'Arkham Companion',
        short_name: 'Arkham',
        display: 'standalone',
        orientation: 'any',
        // The night table of the playmat (tokens.css `--color-background`), so the splash matches the app.
        background_color: '#0b1614',
        theme_color: '#0b1614',
        // Written by scripts/app_icon.ts from the app mark (src/brand/appMark.ts).
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  base,
  build: {
    // The game's symbols stay files of their own: inlined as base64 into the stylesheet they
    // barely compress, and the service worker precaches them for offline play anyway.
    assetsInlineLimit: (file) => (file.includes('/src/symbols/') ? false : undefined),
  },
});
