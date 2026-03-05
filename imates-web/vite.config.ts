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
  const EDU_SERVICE_BASE = ADDRESS_CATALOG.XUEBAN_RELEASE
  const RESOURCE_FILE_BASE = ADDRESS_CATALOG.YANBAN_RELEASE
  const APP_UPDATE_BASE = ADDRESS_CATALOG.IMATES_HTTP
  const HISTORY_MANAGE_BASE = ADDRESS_CATALOG.HISTORY_MANAGE
  const TEACHER_API_BASE = ADDRESS_CATALOG.TEACHER_API_RELEASE


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
        // 统一走 www.imates.com.cn 的 Nginx 前缀代理（仅本地开发需要）
        '/yb-test': {
          target: 'https://www.imates.com.cn',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/yb-test')
          },
        },
        '/blw-edu-yb/api': {
          target: RESOURCE_FILE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/blw-edu-yb/api')
          },
        },
        '/blw-edu-yb/api/question': {
          target: 'http://www.imates.com.cn:8201',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/blw-edu-yb/api/question')
          },
        },
        '/blw-edu-yb/api/system': {
          target: 'http://www.imates.com.cn:8201',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/blw-edu-yb/api/system')
          },
        },
        '/blw-edu-yb/auth': {
          target: RESOURCE_FILE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/blw-edu-yb/auth')
          },
        },
        '/homework': {
          target: RESOURCE_FILE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/homework')
          },
        },
        '/api/v1/tickets': {
          target: 'http://app.imates.com.cn:8080',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api/v1/tickets')
          }
        },
        '/temporaryImg': {
          target: 'http://imates.com.cn',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/temporaryImg')
          },
        },
        '/admin': {
          target: EDU_SERVICE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/admin')
          }
        },
        '/bj101': {
          target: APP_UPDATE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/bj101')
          },
        },
        '/jinkai': {
          target: APP_UPDATE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/jinkai')
          },
        },
        '/appupdate_test.json': {
          target: APP_UPDATE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/appupdate_test.json')
          },
        },
        '/ai': {
          target: EDU_SERVICE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/ai')
          },
        },
        '/permission': {
          target: EDU_SERVICE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            attachBasicProxyLog(proxy, '/permission')
          }
        },
        '/history_manage': {
          target: HISTORY_MANAGE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/history_manage')
          },
        },
        '/biologyTopicKnowledge': {
          target: EDU_SERVICE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/biologyTopicKnowledge')
          }
        },
        // 资源服务器
        '/resource': {
          target: RESOURCE_FILE_BASE,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/resource')
          }
        },
        // 图片资源
        '/img': {
          target: RESOURCE_FILE_BASE,
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
        // 教师聊天API
        '/api/question': {
          target: 'http://www.imates.com.cn:8201/blw-edu-yb',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api/question')
          }
        },
        // 系统API（文件上传等）
        '/api/system': {
          target: 'http://www.imates.com.cn:8201/blw-edu-yb',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api/system')
          }
        },
        // 图片上传接口：走 Nginx 8200 端口
        '/api/images/upload': {
          target: 'https://www.imates.com.cn:8200',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ rejectUnauthorized: false }),
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api/images/upload')
          }
        },
        // 通用API：兜底配置
        '/api': {
          target: 'http://www.imates.com.cn:8201/blw-edu-yb',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/api')
          }
        },
        // 教师WebSocket
        '/blw-edu-yb/ws': {
          target: 'ws://www.imates.com.cn:8201',
          changeOrigin: true,
          ws: true,
          secure: false,
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/blw-edu-yb/ws')
          }
        },
        // IM即时通讯服务
        '/im/': {
          target: 'https://www.imates.com.cn',
          changeOrigin: true,
          secure: true,
          agent: new https.Agent({ rejectUnauthorized: false }),
          configure: (proxy) => {
            attachBasicProxyLog(proxy, '/im/')
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
