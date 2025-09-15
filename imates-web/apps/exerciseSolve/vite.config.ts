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
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
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
    // 生成source map便于调试
    sourcemap: "inline",
    // 优化chunk分割
    rollupOptions: {
      output: {
        // 确保文件名不包含特殊字符
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
