import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    vueJsx(),
    vueDevTools(),
    quasar({
      sassVariables: fileURLToPath(new URL('./src/quasar-variables.sass', import.meta.url))
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 匹配以 "/blw-edu-yb/api" 开头的请求，转发到后端
      '/blw-edu-yb/api': {
        target: 'https://43.138.16.5:50013', // 后端基础地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
        // 可选：若后端接口路径无需额外前缀，可省略 rewrite
        // rewrite: (path) => path.replace(/^\/blw-edu-yb\/api/, '/blw-edu-yb/api')
      },
      // 匹配以 "/blw-edu-yb/auth" 开头的请求，转发到后端（用于登录等认证接口）
      '/blw-edu-yb/auth': {
        target: 'https://43.138.16.5:50013', // 后端基础地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
      },
      // 匹配以 "/api/v1/tickets" 开头的请求，转发到Zammad工单系统
      '/api/v1/tickets': {
        target: 'http://app.imates.com.cn:8080', // Zammad工单系统地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到Zammad:', req.url)
          })
        }
      },
      // 匹配以 "/admin" 开头的请求，转发到学班服务（用于登录等管理接口）
      '/admin': {
        target: 'http://www.imates.com.cn:8222/blw-edu-service-alc', // 学班服务地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到学班服务(admin):', req.url)
          })
        }
      },
      // 匹配以 "/permission" 开头的请求，转发到学班服务（用于权限相关接口）
      '/permission': {
        target: 'http://www.imates.com.cn:8222/blw-edu-service-alc', // 学班服务地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 增加请求体大小限制（支持大图片Base64）
        configure: (proxy, options) => {
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
            if (proxyRes.statusCode >= 400) {
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
      // 匹配以 "/biologyTopicKnowledge" 开头的请求，转发到学班服务（用于生物知识点相关接口）
      '/biologyTopicKnowledge': {
        target: 'http://www.imates.com.cn:8222/blw-edu-service-alc', // 学班服务地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 使用HTTP协议
        // 可选：添加请求头
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 可以在这里添加额外的请求头
            console.log('代理请求到学班服务(biologyTopicKnowledge):', req.url)
          })
        }
      },
      // 🔥 新增：匹配以 "/resource" 开头的请求，转发到资源服务器（解决CORS问题）
      '/resource': {
        target: 'https://43.138.16.5:50013', // 资源服务器地址
        changeOrigin: true, // 关键：将请求的 origin 改为 target 域名
        secure: false, // 若后端 HTTPS 证书不合法（如自签证书），需设为 false
        // 添加CORS头信息
        configure: (proxy) => {
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
      }
    }
  },
  // 为Android WebView优化构建配置
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 确保资源内联或使用相对路径
    assetsInlineLimit: 4096,
    // 为了兼容性，不使用ES模块
    target: 'es2015',
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
    }
  }
})
