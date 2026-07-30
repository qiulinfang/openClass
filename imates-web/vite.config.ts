import { fileURLToPath, URL } from 'node:url'
import * as https from 'node:https'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import type { Connect } from 'vite'
import { ADDRESS_CATALOG } from './src/config/env-config'

// https://vite.dev/config/
export default defineConfig(() => {

  // 为所有代理统一附加一组精简日志，方便查看请求流向
  const attachBasicProxyLog = (proxy: any, label: string) => {
    proxy.on('proxyReq', (proxyReq: any, req: any) => {
      const protocol = proxyReq?.protocol || ''
      const host = proxyReq?.host || ''
      const path = proxyReq?.path || ''
      console.log(`➡ [Proxy:${label}]`, req.method, req.url, '->', `${protocol}//${host}${path}`)
    })
    proxy.on('proxyReqWs', (proxyReq: any, req: any) => {
      const protocol = proxyReq?.protocol || ''
      const host = proxyReq?.host || ''
      const path = proxyReq?.path || ''
      console.log(`➡ [ProxyWS:${label}]`, req.url, '->', `${protocol}//${host}${path}`)
    })
    proxy.on('proxyRes', (proxyRes: any, req: any) => {
      console.log(`⬅ [Proxy:${label}]`, proxyRes.statusCode, req.url)
    })
    proxy.on('error', (err: any, req: any) => {
      console.error(`⛔ [Proxy:${label}]`, req.url, err.message)
    })
  }

  return {
    plugins: [
      vue({
        template: { transformAssetUrls },
      }),
      vueJsx(),
      vueDevTools(),
      quasar({
        sassVariables: fileURLToPath(new URL('./src/quasar-variables.sass', import.meta.url)),
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      // 排除 mupdf 的预构建，因为它包含 WASM 文件
      exclude: ['mupdf'],
    },
    server: {
      watch: {
        usePolling: true,
      },
      // 配置中间件以正确处理 WASM 文件的 MIME 类型
      middlewareMode: false,
      fs: {
        // 允许访问 node_modules 中的文件
        allow: ['..']
      },
      // 添加中间件来设置 WASM 文件的正确 MIME 类型
      configureServer(server: any) {
        server.middlewares.use((req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
          const start = Date.now()
          const url = req.url || ''
          console.log(`➡ [Vite]`, req.method, url)
          res.on('finish', () => {
            const cost = Date.now() - start
            console.log(`⬅ [Vite]`, res.statusCode, url, `${cost}ms`)
          })
          next()
        })

        server.middlewares.use((req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
          // 如果是 WASM 文件请求，设置正确的 MIME 类型
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm')
          }
          next()
        })
      },
      proxy: {
        '/blw-edu-service-alc': {
          target: 'http://www.imates.com.cn:8222',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/blw-edu-service-alc')
          },
        },
        '/requests2': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/requests2')
          },
        },
        // HTML 代理服务：指向本地 5001 端口
        '/requests': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/requests')
          },
        },
        '/yb-test': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/yb-test')
          },
        },
        '/yb-release': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/yb-release')
          },
        },
        '/xb-test': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/xb-test')
          },
        },
        '/xb-release': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/xb-release')
          },
        },
        '/yb-teacher-test': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/yb-teacher-test')
          },
        },
        '/yb-teacher-release': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/yb-teacher-release')
          },
        },
        '/bj101': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/bj101')
          },
        },
        '/v2': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/v2')
          },
        },
        // 教师 WebSocket 代理
        '/teacher-ws-test': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/teacher-ws-test')
          },
        },
        '/teacher-ws-release': {
          target: ADDRESS_CATALOG.IMATES_HTTP,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/teacher-ws-release')
          },
        },
        '/history_manage': {
          target: ADDRESS_CATALOG.HISTORY_MANAGE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/history_manage')
          },
        },
        '/get_shor_term_memory': {
          target: ADDRESS_CATALOG.HISTORY_MANAGE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/get_shor_term_memory')
          },
        },
        '/get_shor_term_memory_admin': {
          target: ADDRESS_CATALOG.HISTORY_MANAGE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/get_shor_term_memory_admin')
          },
        },
        // 图片资源
        '/img': {
          target: ADDRESS_CATALOG.YANBAN_RELEASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/img')
          }
        },
        // 知识点查询服务
        '/knowledge': {
          target: ADDRESS_CATALOG.KNOWLEDGE_API,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/knowledge')
          }
        },
        // gaokao-agent-llm 服务
        '/v1': {
          target: ADDRESS_CATALOG.GAOKAO_AGENT_LLM,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/v1')
          }
        },
        // 图片上传接口：走 Nginx 8200 端口
        '/api/images/upload': {
          target: ADDRESS_CATALOG.CLIENT_HTTP,
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ rejectUnauthorized: false }),
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api/images/upload')
          }
        },
        // 手写公式识别接口
        '/api/recognize-handwritten-formula-image': {
          target: ADDRESS_CATALOG.HW_FORMULA_RECOGNIZE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api/recognize-handwritten-formula-image')
          }
        },
      },
    },
    // 为Android WebView优化构建配置
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // 确保资源内联或使用相对路径
      assetsInlineLimit: 0,
      // 使用 es2022 以支持 top-level await（mupdf 需要）
      // Chrome 99+ 支持 top-level await，符合项目最低版本要求
      target: 'es2022',
      // 生成独立 source map 文件，便于在 Android 里查看 .map
      sourcemap: true,
      // 优化chunk分割
      rollupOptions: {
        output: {
          // 确保文件名不包含特殊字符
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            // 为动画序列图片使用特殊的命名规则
            if (assetInfo.name && assetInfo.name.includes('animations/') && /\.(jpg|jpeg|png)$/i.test(assetInfo.name)) {
              return 'assets/animations/[name].[hash][extname]'
            }
            return 'assets/[name].[hash][extname]'
          },
          // 手动分割代码块以减少单个文件大小
          manualChunks: {
            'vendor': ['vue', 'vue-router', 'pinia'],
            'quasar': ['quasar'],
            'mathlive': ['mathlive'],
            'tiptap': ['@tiptap/core', '@tiptap/vue-3', '@tiptap/starter-kit']
          }
        }
      },
    },
  }
})
