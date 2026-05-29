import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const IMATES_HTTP = 'https://www.imates.com.cn'

const attachBasicProxyLog = (proxy: any, label: string) => {
  proxy.on('proxyReq', (proxyReq: any, req: any) => {
    const protocol = proxyReq?.protocol || ''
    const host = proxyReq?.host || ''
    const path = proxyReq?.path || ''
    console.log(`➡ [Proxy:${label}]`, req.method, req.url, '->', `${protocol}//${host}${path}`)
  })
  proxy.on('proxyRes', (proxyRes: any, req: any) => {
    console.log(`⬅ [Proxy:${label}]`, proxyRes.statusCode, req.url)
  })
  proxy.on('error', (err: any, req: any) => {
    console.error(`⛔ [Proxy:${label}]`, req.url, err.message)
  })
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    exclude: ['mupdf'],
  },
  server: {
    middlewareMode: false,
    port: 8080,
    proxy: {
      '/xb-test': {
        target: IMATES_HTTP,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachBasicProxyLog(proxy, '/xb-test'),
      },
      '/xb-release': {
        target: IMATES_HTTP,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachBasicProxyLog(proxy, '/xb-release'),
      },
      '/yb-test': {
        target: IMATES_HTTP,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachBasicProxyLog(proxy, '/yb-test'),
      },
      '/yb-release': {
        target: IMATES_HTTP,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachBasicProxyLog(proxy, '/yb-release'),
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
})
