/**
 * WebView 专用入口文件
 * 支持单独页面构建
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import router from './router'
import { initPolyfills } from './utils/common/polyfills'
import { initializeAppConfig } from './utils/config/config-utils'

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
  } else {
    // 默认加载首页
    const { default: HomeView } = await import('./views/HomeView.vue')
    return HomeView
  }
}

// 创建应用
async function createWebViewApp() {
  // 初始化 WebView 兼容性 polyfills
  initPolyfills()
  
  // 初始化应用配置（包括认证 token）
  await initializeAppConfig()
  
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
}

// 启动应用
createWebViewApp().catch(console.error)
