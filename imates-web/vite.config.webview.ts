import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

// WebView 专用配置 - 支持单独页面构建
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
  // 为 Android WebView 优化构建配置
  base: './',
  build: {
    outDir: 'dist-webview',
    assetsDir: 'assets',
    // 增加内联资源限制以减少文件数量
    assetsInlineLimit: 8192,
    // 为了兼容性，不使用ES模块
    target: 'es2015',
    // 始终生成 source map 便于调试
    sourcemap: 'inline',
    // 启用代码压缩
    minify: 'esbuild',
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
  },
  server: {
    watch: {
      usePolling: true,
    },
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // 开发环境调试配置
    open: false,
    cors: true,
    // 启用 HMR (Hot Module Replacement)
    hmr: {
      port: 5173
    }
  },
  // 开发环境配置
  define: {
    __VUE_OPTIONS_API__: true,
    // 始终启用 Vue DevTools 便于调试
    __VUE_PROD_DEVTOOLS__: true
  }
})
