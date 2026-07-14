import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const uipathBaseUrl = env.VITE_UIPATH_BASE_URL || 'https://staging.uipath.com'

  return {
    plugins: [react()],
    base: './',
    server: {
      port: 5180,
      strictPort: true,
      proxy: {
        '/ddg-search': {
          target: 'https://api.duckduckgo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ddg-search/, ''),
        },
        '/serper-search': {
          target: 'https://google.serper.dev',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/serper-search/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-API-KEY', '1516574fd40086dacb1e748b9c4d419003aebec2');
              proxyReq.setHeader('Content-Type', 'application/json');
            });
          },
        },
        // Proxy UiPath API calls to avoid CORS in local dev. Regex keys
        // (Vite interprets keys starting with ^ as RegExp) match ANY
        // {org}/{tenant} pair so admins can connect to any tenant from
        // localhost without rebuilding.
        '^/[^/]+/[^/]+/orchestrator_': {
          target: uipathBaseUrl,
          changeOrigin: true,
        },
        '^/[^/]+/[^/]+/dataservice_': {
          target: uipathBaseUrl,
          changeOrigin: true,
        },
        '^/[^/]+/[^/]+/identity_': {
          target: uipathBaseUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          admin: resolve(__dirname, 'admin/index.html'),
        },
      },
    },
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        path: 'path-browserify',
      },
    },
    optimizeDeps: {
      include: ['@uipath/uipath-typescript'],
    },
  }
})
