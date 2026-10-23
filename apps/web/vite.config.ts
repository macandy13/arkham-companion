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
        runtimeCaching: [cardImageCaching],
      },
      manifest: {
        name: 'Arkham Companion',
        short_name: 'Arkham',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#1b1b1f',
        theme_color: '#1b1b1f',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  base,
});
