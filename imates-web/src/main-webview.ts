/**
 * WebView 专用入口文件
 * 支持单独页面构建
 */

import { createApp, version as vueVersion, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import router from './router'
import { initPolyfills } from './utils/common/polyfills'
import { initializeAppConfig } from './utils/config/config-utils'
import { initQuestionStorage } from './services/question-storage'
import { AndroidBridge } from './services/android-bridge'

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
  
  // 初始化应用配置（包括认证 token）
  await initializeAppConfig()
  
  // 提前初始化 IndexedDB（并行加载，不阻塞应用启动）
  initQuestionStorage().then(() => {
  }).catch((error) => {
    console.error(`[APP] ❌ IndexedDB 提前初始化失败:`, error)
  })
  
  const PageComponent = await loadPageComponent()
  
  const app = createApp(PageComponent)
  
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
    (window as any).Vue = {
      version: vueVersion
    }
    console.log('[APP] Vue已挂载到window对象，版本:', vueVersion)
  }
  
  // 通知Android端Web应用已就绪（事件驱动，替代轮询机制）
  // 使用Promise确保在下一个事件循环中执行，确保所有初始化完成
  await Promise.resolve()
  try {
    const androidBridge = AndroidBridge.getInstance()
    androidBridge.notifyWebAppReady()
    console.log('[APP] 已通知Android端Web应用就绪')
  } catch (error) {
    console.error('[APP] 通知Android端Web应用就绪失败:', error)
  }
}

// 启动应用
createWebViewApp().catch(console.error)
