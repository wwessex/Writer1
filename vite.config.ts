import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/favicon.ico', 'assets/apple-touch-icon.png', 'assets/*.png', 'assets/*.svg', 'brand/*.svg'],
      manifest: {
        name: 'DraftHarbour Studio',
        short_name: 'DraftHarbour',
        description: 'Offline-first Progressive Web Application for writing novels',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: './',
        icons: [
          {
            src: 'assets/icon-blue-32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'assets/icon-blue-48.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: 'assets/icon-blue-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/icon-blue-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'assets/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'assets/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    target: 'esnext',
    sourcemap: true
  }
});
