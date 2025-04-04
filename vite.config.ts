import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Tipo de registro do Service Worker
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
            },
          },
          {
            urlPattern: /.*\.css$/,
            handler: 'StaleWhileRevalidate',
          },
          {
            urlPattern: /.*\.js$/,
            handler: 'StaleWhileRevalidate',
          },
        ],
      },
      manifest: {
        name: 'Lista de Compras',
        short_name: 'Compras',
        description: 'Lista de compras',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone', // Permite o app funcionar como PWA
        icons: [
          {
            src: '/lsit.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
