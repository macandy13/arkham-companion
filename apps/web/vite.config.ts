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
        background_color: '#1b1b1f',
        theme_color: '#1b1b1f',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
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
