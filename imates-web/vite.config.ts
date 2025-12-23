import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import type { Connect } from 'vite'

// https://vite.dev/config/
// 使用工厂函数形式，根据 mode 区分正式/测试环境
export default defineConfig(({ mode }) => {
  // 简单的环境开关：当使用 `vite --mode test` 启动时视为测试环境
  const isTest = mode === 'test'

  // 学伴服务（业务后端）
  // mode=test 时，对齐 Android 测试环境：使用 9222 端口的 imates 测试服
  const EDU_SERVICE_BASE = isTest
    ? 'http://www.imates.com.cn:58443/blw-edu-service-alc'
    : 'http://www.imates.com.cn:9222/blw-edu-service-alc'

  // 资源服务器（文件/图片等）
  // 测试环境同样使用 imates 资源服务器
  const RESOURCE_FILE_BASE = isTest
    ? 'https://www.imates.com.cn:9099'
    : 'https://www.imates.com.cn:9099'

  // APP 更新接口所用域名
  // 测试环境与正式环境同域名，通过不同路径区分 appupdate.json / appupdate_test.json
  const APP_UPDATE_BASE = isTest
    ? 'https://www.imates.com.cn'
    : 'https://www.imates.com.cn'

  const HISTORY_MANAGE_BASE = 'https://u389082-a353-35fba22b.westb.seetacloud.com:8443'

  // 启动时输出当前环境及各后端基础地址，便于确认 Vite 实际走的是哪套接口
  // 这些日志只在 Node 侧输出，不会影响前端运行时
  console.log('🔧 [Vite Env] mode =', mode, 'isTest =', isTest)
  console.log('🔧 [Vite Env] EDU_SERVICE_BASE     =', EDU_SERVICE_BASE)
  console.log('🔧 [Vite Env] RESOURCE_FILE_BASE  =', RESOURCE_FILE_BASE)
  console.log('🔧 [Vite Env] APP_UPDATE_BASE     =', APP_UPDATE_BASE)

   // 为所有代理统一附加一组精简日志，方便查看请求流向
   const attachBasicProxyLog = (proxy: any, label: string) => {
     proxy.on('proxyReq', (proxyReq: any, req: any) => {
       console.log(`➡ [Proxy:${label}]`, req.method, req.url)
         console.log('🔧 [Vite Env] mode =', mode, 'isTest =', isTest)
        console.log('🔧 [Vite Env] EDU_SERVICE_BASE     =', EDU_SERVICE_BASE)
        console.log('🔧 [Vite Env] RESOURCE_FILE_BASE  =', RESOURCE_FILE_BASE)
        console.log('🔧 [Vite Env] APP_UPDATE_BASE     =', APP_UPDATE_BASE)
     })
     proxy.on('proxyRes', (proxyRes: any, req: any) => {
       console.log(`⬅ [Proxy:${label}]`, proxyRes.statusCode, req.url)
       console.log('🔧 [Vite Env] mode =', mode, 'isTest =', isTest)
        console.log('🔧 [Vite Env] EDU_SERVICE_BASE     =', EDU_SERVICE_BASE)
        console.log('🔧 [Vite Env] RESOURCE_FILE_BASE  =', RESOURCE_FILE_BASE)
        console.log('🔧 [Vite Env] APP_UPDATE_BASE     =', APP_UPDATE_BASE)
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
        // 如果是 WASM 文件请求，设置正确的 MIME 类型
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm')
        }
        next()
      })
    },
    proxy: {
      // 匹配以 "/blw-edu-yb/api" 开头的请求，转发到后端
      '/blw-edu-yb/api': {
        target: RESOURCE_FILE_BASE, // 后端基础地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
        // 可选：若后端接口路径无需额外前缀，可省略 rewrite
        // rewrite: (path) => path.replace(/^\/blw-edu-yb\/api/, '/blw-edu-yb/api')
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/blw-edu-yb/api')
        },
      },
      // 匹配以 "/blw-edu-yb/auth" 开头的请求，转发到后端（用于登录等认证接口）
      '/blw-edu-yb/auth': {
        target: RESOURCE_FILE_BASE, // 后端基础地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/blw-edu-yb/auth')
        },
      },
      // 匹配以 "/api/v1/tickets" 开头的请求，转发到Zammad工单系统
      '/api/v1/tickets': {
        target: 'http://app.imates.com.cn:8080', // Zammad工单系统地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/api/v1/tickets')
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到Zammad:', req.url)
          })
        }
      },
      // 题目内图片的本地代理：/temporaryImg -> RESOURCE_FILE_BASE/temporaryImg
      '/temporaryImg': {
        // 题目截图中的图片原本来自 http://imates.com.cn/temporaryImg/...
        // 这里直接代理到 imates 根域名，保持与原环境一致
        target: 'http://imates.com.cn',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/temporaryImg')
        },
      },
      // 匹配以 "/admin" 开头的请求，转发到学班服务（用于登录等管理接口）
      '/admin': {
        target: EDU_SERVICE_BASE, // 学班服务地址（按环境切换）
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/admin')
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到学班服务(admin):', req.url)
          })
        }
      },
      // 匹配以 "/bj101" 开头的请求，转发到正式环境更新接口（景山远洋）
      '/bj101': {
        target: APP_UPDATE_BASE,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/bj101')
        },
      },
      // 匹配以 "/jinkai" 开头的请求，转发到经开二中的更新接口
      '/jinkai': {
        target: APP_UPDATE_BASE,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/jinkai')
        },
      },
      // 测试环境更新接口
      '/appupdate_test.json': {
        target: APP_UPDATE_BASE,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/appupdate_test.json')
        },
      },
        // 匹配以 "/ai" 开头的请求，转发到学班服务（与 /permission 相同）
    '/ai': {
        target: EDU_SERVICE_BASE,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/ai')
          // 如有需要，也可以仿照 /permission 加 proxyReq / proxyRes 日志
        },
      },
      // 匹配以 "/permission" 开头的请求，转发到学班服务（用于权限相关接口）
      '/permission': {
        target: EDU_SERVICE_BASE, // 学班服务地址（按环境切换）
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 增加请求体大小限制（支持大图片Base64）
        configure: (proxy, options) => {
          attachBasicProxyLog(proxy, '/permission')
          // 监听代理请求
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔵 [代理请求] permission:', req.url)
            console.log('  - 请求方法:', req.method)
            console.log('  - Content-Type:', req.headers['content-type'])
            console.log('  - Content-Length:', req.headers['content-length'])
            
            // 记录请求头中的token
            if (req.headers['token']) {
              console.log('  - Token存在:', req.headers['token'] ? '是' : '否')
            }
          })
          
          // 监听代理响应
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('🟢 [代理响应] permission:', req.url)
            console.log('  - 状态码:', proxyRes.statusCode)
            console.log('  - 状态信息:', proxyRes.statusMessage)
            
            // 如果是错误响应，记录更多信息
            if ((proxyRes.statusCode ?? 0) >= 400) {
              console.error('❌ [代理错误] permission:', {
                url: req.url,
                status: proxyRes.statusCode,
                headers: proxyRes.headers
              })
              
              // 尝试读取错误响应体
              let errorBody = ''
              proxyRes.on('data', (chunk) => {
                errorBody += chunk.toString()
              })
              proxyRes.on('end', () => {
                if (errorBody) {
                  console.error('  - 错误详情:', errorBody.substring(0, 500))
                }
              })
            }
          })
          
          // 监听代理错误
          proxy.on('error', (err, req, res) => {
            console.error('❌ [代理失败] permission:', {
              url: req.url,
              error: err.message
            })
          })
        }
      },
      // 对话记忆管理接口：/history_manage -> 学班服务
      '/history_manage': {
        target: HISTORY_MANAGE_BASE,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/history_manage')
        },
      },
      // 匹配以 "/biologyTopicKnowledge" 开头的请求，转发到学班服务（用于生物知识点相关接口）
      '/biologyTopicKnowledge': {
        target: EDU_SERVICE_BASE, // 学班服务地址（按环境切换）
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/biologyTopicKnowledge')
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到学班服务(biologyTopicKnowledge):', req.url)
          })
        }
      },
      // 🔥 新增：匹配以 "/resource" 开头的请求，转发到资源服务器（解决CORS问题）
      '/resource': {
        target: RESOURCE_FILE_BASE, // 资源服务器地址（按环境切换）
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
        // 添加CORS头信息
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/resource')
          proxy.on('proxyRes', (proxyRes, req) => {
            // 添加CORS头信息
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, sa-token, token'
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true'
            console.log('代理资源请求:', req.url)
          })
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('代理资源请求到服务器:', req.url)
          })
        }
      },
      // 🔥 新增：匹配以 "/resource" 开头的请求，转发到资源服务器（解决CORS问题）
      '/img': {
        target: RESOURCE_FILE_BASE, // 资源服务器地址（按环境切换）
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
        // 添加CORS头信息
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/img')
          proxy.on('proxyRes', (proxyRes, req) => {
            // 添加CORS头信息
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, sa-token, token'
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true'
            console.log('代理资源请求:', req.url)
          })
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('代理资源请求到服务器:', req.url)
          })
        }
      },
      // 🔥 新增：匹配以 "/knowledge" 开头的请求，转发到知识点查询服务（解决CORS问题）
      '/knowledge': {
        target: isTest ? 'http://www.imates.com.cn:8090' : 'http://www.imates.com.cn:8090', // 如后续有测试服，可按需拆分
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          attachBasicProxyLog(proxy, '/knowledge')
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到知识点查询服务(knowledge):', req.url)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('知识点查询服务响应:', req.url, proxyRes.statusCode)
          })
          proxy.on('error', (err, req, res) => {
            console.error('❌ [知识点查询服务代理失败]:', {
              url: req.url,
              error: err.message
            })
          })
        }
      }
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
        assetFileNames: 'assets/[name].[hash].[ext]',
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
