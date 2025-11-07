import { createApp, version as vueVersion } from 'vue'
import { createPinia } from 'pinia'
import quasarUserOptions from './quasar'
import { initPolyfills } from './utils/common/polyfills'
import { initializeAppConfig } from './utils/config/config-utils'
import { initQuestionStorage } from './services/question-storage'
import { initNetworkStatusListener } from './utils/network-status'
import './styles/native-app.css'
import './styles/mathlive-custom.css'
import './styles/gemini-notify.css'

import App from './App.vue'
import router from './router'

// 初始化 WebView 兼容性 polyfills
initPolyfills()
initializeAppConfig()

// 初始化网络状态监听
initNetworkStatusListener()

// 提前初始化 IndexedDB（并行加载，不阻塞应用启动）
initQuestionStorage().catch((error) => {
  console.error(`[APP] ❌ IndexedDB 提前初始化失败:`, error)
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
quasarUserOptions(app)


// 设置全局Android回调函数
declare global {
  interface Window {
    handleNativeChatResponse: (requestId: string, jsonResponse: string) => void
    handleNativeStreamResponse: (requestId: string, chunk: string, isComplete: boolean) => void
    onImagePickResult: (success: boolean, imageUri: string) => void
    onImageCaptureResult: (
      success: boolean,
      filePath?: string,
      width?: number,
      height?: number,
      fileSize?: number,
    ) => void
    onKeyboardClose: () => void
    onAndroidLog: (level: string, tag: string, message: string) => void
  }
}

// 处理Android原生聊天响应的全局回调函数
window.handleNativeChatResponse = (requestId: string, jsonResponse: string) => {
  try {
    // 解析响应数据
    const response = JSON.parse(jsonResponse)
    // 触发自定义事件，让相关组件监听处理
    const event = new CustomEvent('nativeChatResponse', {
      detail: { requestId, response },
    })
    window.dispatchEvent(event)
  } catch (error) {
    console.error('解析Android聊天响应失败:', error)
  }
}

// 处理Android原生流式响应的全局回调函数
window.handleNativeStreamResponse = (requestId: string, chunk: string, isComplete: boolean) => {
  // 触发自定义事件，让相关组件监听处理
  const event = new CustomEvent('nativeStreamResponse', {
    detail: { requestId, chunk, isComplete },
  })
  window.dispatchEvent(event)
}

// 处理Android原生图片选择结果的回调函数
window.onImagePickResult = (success: boolean, imageUri: string) => {
  // 触发自定义事件，让相关组件监听处理
  const event = new CustomEvent('nativeImagePickResult', {
    detail: { success, imageUri },
  })
  window.dispatchEvent(event)
}

// 处理Android原生拍照结果的回调函数
window.onImageCaptureResult = (
  success: boolean,
  filePath?: string,
  width?: number,
  height?: number,
  fileSize?: number,
) => {
  // 触发自定义事件，让相关组件监听处理
  const event = new CustomEvent('nativeImageCaptureResult', {
    detail: { success, filePath, width, height, fileSize },
  })
  window.dispatchEvent(event)
}

// 处理安卓原生派发的键盘关闭事件
window.onKeyboardClose = () => {
  // 创建一个自定义事件
  const event = new CustomEvent('nativeKeyboardClose', {
    detail: { message: 'Keyboard closed by native button.' }
  });

  // 派发事件，让Vue组件可以监听到
  window.dispatchEvent(event);
}

// 处理Android原生日志回调函数
window.onAndroidLog = (level: string, tag: string, message: string) => {
  // 根据日志级别打印到控制台
  const logMessage = `[Android-${tag}] ${message}`
  
  switch (level.toUpperCase()) {
    case 'DEBUG':
      break
    case 'INFO':
      break
    case 'WARN':
      console.warn(logMessage)
      break
    case 'ERROR':
      console.error(logMessage)
      break
    default:
      break
  }
  
  // 触发自定义事件，让其他组件可以监听
  const event = new CustomEvent('androidLog', {
    detail: { level, tag, message }
  })
  window.dispatchEvent(event)
}

app.mount('#app')

// 将Vue挂载到window对象，供Android端检测应用是否就绪
// Android端通过 window.Vue && window.Vue.version 来检测Vue应用是否就绪
if (typeof window !== 'undefined') {
  (window as any).Vue = {
    version: vueVersion
  }
  console.log('[APP] Vue已挂载到window对象，版本:', vueVersion)
}
