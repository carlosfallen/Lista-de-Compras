import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Lista de Compras',
        short_name: 'Compras',
        description: 'Aplicativo de lista de compras inteligente',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/check.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/check.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})