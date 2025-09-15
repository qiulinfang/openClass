import { createApp } from 'vue'
import { createPinia } from 'pinia'
import quasarUserOptions from './quasar'
import { initPolyfills } from './utils/polyfills'
import { initializeAppConfig } from './utils/config-utils'
import './styles/keyboard.css'
import './styles/native-app.css'
import './styles/mathlive-custom.css'
import './styles/gemini-notify.css'

import App from './App.vue'

// 初始化 WebView 兼容性 polyfills
initPolyfills()
initializeAppConfig()

const app = createApp(App)

app.use(createPinia())
quasarUserOptions(app)

// 处理 MathLive 虚拟键盘切换事件
window.addEventListener('mathlive-virtual-keyboard-toggle', (ev) => {
  const keyboardContainer = document.querySelector('.ML__keyboard-container');
  if (!keyboardContainer) return;

  const { visible, height } = (ev as CustomEvent).detail;
  
  // 只管理键盘容器的显示状态，不修改页面布局
  if (visible) {
    keyboardContainer.classList.add('is-visible');
  } else {
    keyboardContainer.classList.remove('is-visible');
  }

  // 派发自定义事件，通知 ChatView 键盘状态变化
  // ChatView 会通过调整自身高度来适应键盘，而不是通过 padding-bottom
  const keyboardEvent = new CustomEvent('custom-keyboard-toggle', {
    detail: { visible, height }
  });
  window.dispatchEvent(keyboardEvent);
});

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
    onKeyboardClose: () => void; 
  }
}

// 处理Android原生聊天响应的全局回调函数
window.handleNativeChatResponse = (requestId: string, jsonResponse: string) => {
  console.log('收到Android聊天响应:', { requestId, jsonResponse })

  try {
    // 解析响应数据
    const response = JSON.parse(jsonResponse)
    console.log('解析后的响应:', response)

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
  console.log('收到Android流式响应:', { requestId, chunk, isComplete })

  // 触发自定义事件，让相关组件监听处理
  const event = new CustomEvent('nativeStreamResponse', {
    detail: { requestId, chunk, isComplete },
  })
  window.dispatchEvent(event)
}

// 处理Android原生图片选择结果的回调函数
window.onImagePickResult = (success: boolean, imageUri: string) => {
  console.log('收到Android图片选择结果:', { success, imageUri })

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
  console.log('收到Android拍照结果:', { success, filePath, width, height, fileSize })

  // 触发自定义事件，让相关组件监听处理
  const event = new CustomEvent('nativeImageCaptureResult', {
    detail: { success, filePath, width, height, fileSize },
  })
  window.dispatchEvent(event)
}

// 处理安卓原生派发的键盘关闭事件
window.onKeyboardClose = () => {
  console.log('收到安卓原生回调：键盘关闭按钮被点击');

  // 创建一个自定义事件
  const event = new CustomEvent('nativeKeyboardClose', {
    detail: { message: 'Keyboard closed by native button.' }
  });

  // 派发事件，让Vue组件可以监听到
  window.dispatchEvent(event);
}
app.mount('#app')
