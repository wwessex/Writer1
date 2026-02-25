import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { handleBrokerRequest } from './src/server/integrationBroker';

function integrationBrokerPlugin() {
  return {
    name: 'integration-broker',
    configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string; on: (event: string, cb: (chunk?: unknown) => void) => void }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const method = req.method || 'GET';
        const url = req.url || '/';
        const pathOnly = url.split('?')[0];

        if (!pathOnly.startsWith('/api/')) {
          next();
          return;
        }

        let raw = '';
        req.on('data', (chunk) => {
          const textChunk = typeof chunk === 'string' ? chunk : String(chunk ?? '');
          raw += textChunk;
        });
        req.on('end', async () => {
          let body: unknown = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = {};
          }

          const result = await handleBrokerRequest({ method, path: pathOnly, body });
          if (!result) {
            next();
            return;
          }

          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    react(),
    integrationBrokerPlugin(),
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

  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    target: ['es2020', 'safari14'],
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/src/lib/export/')
            || id.includes('/src/components/Modals/ExportModal')
            || id.includes('/src/components/Modals/ExportHistoryModal')
          ) {
            return 'export';
          }

          if (
            id.includes('/src/lib/ai/')
            || id.includes('/src/components/Modals/AIWritingModal')
            || id.includes('/src/components/Modals/TranslationModal')
          ) {
            return 'ai';
          }

          if (
            id.includes('/src/lib/integrations/')
            || id.includes('/src/components/Modals/IntegrationsModal')
          ) {
            return 'integrations';
          }

          return undefined;
        }
      }
    }
  }
});
