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
        // Maestro case-instance state (persistent live stage) lives on pims_.
        '^/[^/]+/[^/]+/pims_': {
          target: uipathBaseUrl,
          changeOrigin: true,
        },
        // IXP / Document Understanding (corporate AOF extraction) lives on du_.
        // du_ rejects the bundled `rt_` PAT (it requires a JWT carrying Du.* scopes),
        // so in dev we swap in VITE_UIPATH_DU_TOKEN here — the browser never sees it.
        // In production the app's own token must carry the Du.* scopes instead.
        '^/[^/]+/[^/]+/du_': {
          target: uipathBaseUrl,
          changeOrigin: true,
          configure: (proxy) => {
            const duToken = env.VITE_UIPATH_DU_TOKEN;
            if (!duToken) return;
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${duToken}`);
            });
          },
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
