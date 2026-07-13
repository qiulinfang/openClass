/**
 * WebView 专用入口文件
 * 支持单独页面构建
 */

import { createApp, version as vueVersion, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import router from './router'
import { initPolyfills } from './utils/common/polyfills'
import { initQuestionStorage } from './services/storage/question-storage'
import { AndroidBridge } from './services/business/android-bridge'
import { initMockTeacherBridge } from './services/business/mock-teacher-bridge'

import * as Sentry from '@sentry/vue'

// 导入 Quasar 样式
import 'quasar/src/css/index.sass'
import '@quasar/extras/material-icons/material-icons.css'

// 导入应用样式
import './styles/native-app.css'

// 根据当前页面路径动态导入组件
async function loadPageComponent() {
  const path = window.location.pathname
  
  // 根据路径确定要加载的组件
  if (path.includes('exercise-solve') || path.includes('exerciseSolve')) {
    const { default: ExerciseSolveView } = await import('./views/ExerciseSolveView.vue')
    return ExerciseSolveView
  } else if (path.includes('find-exercise') || path.includes('findExercise')) {
    const { default: FindExerciseView } = await import('./views/FindExerciseView.vue')
    return FindExerciseView
  } else if (path.includes('knowledge-graph') || path.includes('knowledgeGraph')) {
    const { default: KnowledgeGraphView } = await import('./views/KnowledgeGraphView.vue')
    return KnowledgeGraphView
  } else {
    // 默认加载主视图
    const { default: MainView } = await import('./views/MainView.vue')
    return MainView
  }
}

// 创建应用
async function createWebViewApp() {
  // 初始化 WebView 兼容性 polyfills
  initPolyfills()
  
  // 立即初始化模拟老师对话功能（必须在 store 初始化之前）
  // 这样确保在 store 检查 AndroidBridge 时，模拟功能已经就绪
  initMockTeacherBridge()

  // 提前初始化 IndexedDB（并行加载，不阻塞应用启动）
  initQuestionStorage().then(() => {
  }).catch((error) => {
    console.error(`[APP] ❌ IndexedDB 提前初始化失败:`, error)
  })
  
  const PageComponent = await loadPageComponent()
  
  const app = createApp(PageComponent)

  // 初始化 Sentry 错误日志收集
  Sentry.init({
    app,
    dsn: "https://0f4063e1c0771fb7cf96ca95d3b44536@o4511727297953792.ingest.us.sentry.io/4511727304048640",
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
  
  // 配置 Pinia
  const pinia = createPinia()
  app.use(pinia)
  
  // 配置 Quasar
  app.use(Quasar, {
    plugins: {}, // 导入 Quasar 插件
  })
  
  // 配置路由（如果需要）
  app.use(router)
  
  // 挂载应用
  app.mount('#app')
  
  // 等待Vue应用完全挂载后再设置window.Vue，供Android端检测应用是否就绪
  // Android端通过 window.Vue && window.Vue.version 来检测Vue应用是否就绪
  await nextTick()
  if (typeof window !== 'undefined') {
    ;(window as unknown as { Vue: { version: string } }).Vue = {
      version: vueVersion
    }
    console.log('[APP] Vue已挂载到window对象，版本:', vueVersion)
  }
  
  // 通知Android端Web应用已就绪（事件驱动，替代轮询机制）
  // 延迟通知，确保 window.AndroidBridge 已经注入
  // 使用多次尝试机制，因为 WebView 的 JavaScript 接口注入可能有延迟
  const notifyAndroidReady = async () => {
    const maxRetries = 10
    const retryDelay = 100 // 100ms
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const androidBridge = AndroidBridge.getInstance()
        // 直接检查 window.AndroidBridge 是否可用
        if (typeof window !== 'undefined' && 
            typeof window.AndroidBridge !== 'undefined' &&
            typeof window.AndroidBridge.notifyWebAppReady === 'function') {
          androidBridge.notifyWebAppReady()
          console.log('[APP] 已通知Android端Web应用就绪 (尝试 ' + (i + 1) + ')')
          return
        } else {
          // 如果不可用，等待一段时间后重试
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      } catch (error) {
        console.error('[APP] 通知Android端Web应用就绪失败 (尝试 ' + (i + 1) + '):', error)
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }
    
    console.warn('[APP] 经过 ' + maxRetries + ' 次尝试后，仍无法通知Android端Web应用就绪')
  }
  
  // 在下一个事件循环中开始尝试通知
  await Promise.resolve()
  notifyAndroidReady()
}

// 启动应用
createWebViewApp().catch(console.error)
