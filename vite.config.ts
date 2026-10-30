import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE = "/nom-du-repo/" sur GitHub Pages (défini dans le workflow).
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Resale Bot',
        short_name: 'Resale Bot',
        description: "Assistant d'achat-revente",
        theme_color: '#0b1f3a',
        background_color: '#f4f6fa',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // Workbox : on ne met jamais en cache les appels Supabase.
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
          { urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: 'NetworkOnly' },
        ],
      },
    }),
  ],
});
