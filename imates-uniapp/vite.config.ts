import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'path'

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'katex': resolve(__dirname, '../imates-web/node_modules/katex'),
      'markdown-it': resolve(__dirname, '../imates-web/node_modules/markdown-it'),
      'markdown-it-katex': resolve(__dirname, '../imates-web/node_modules/markdown-it-katex')
    }
  },
  esbuild: {
    target: 'esnext'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api']
      }
    }
  },
  build: {
    target: 'esnext'
  },
  server: {
    proxy: {
      '/xb-test': {
        target: 'https://www.imates.com.cn',
        changeOrigin: true,
        secure: false
      },
      '/xb-release': {
        target: 'https://www.imates.com.cn',
        changeOrigin: true,
        secure: false
      },
      '/yb-test': {
        target: 'https://www.imates.com.cn',
        changeOrigin: true,
        secure: false
      },
      '/yb-release': {
        target: 'https://www.imates.com.cn',
        changeOrigin: true,
        secure: false
      },
      '/resource': {
        target: 'https://www.imates.com.cn',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
