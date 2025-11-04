/**
 * 工具函数统一导出文件
 * 提供项目中所有工具函数的统一入口
 */

import { Notify } from 'quasar'
import { androidBridge } from '../services/android-bridge'

/**
 * 统一的消息提示函数（智能选择实现方式）
 * 第1步：判断运行环境（Android WebView 或 Web）
 * 第2步：Android WebView 使用 androidBridge.showToast
 * 第3步：Web 环境使用 Quasar Notify
 */
export const showMessage = (
  message: string,
  type: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error' = 'positive',
  timeout: number = 2000
) => {
  // 第1步：判断是否在 Android WebView 环境
  if (androidBridge.isAndroidBridgeAvailable()) {
    // 第2步：使用原生 Toast
    androidBridge.showToast(message)
  } else {
    // 第3步：使用 Quasar Notify（Web 环境）
    const typeMap: Record<string, { color: string; icon: string }> = {
      success: { color: 'positive', icon: 'check_circle' },
      positive: { color: 'positive', icon: 'check_circle' },
      error: { color: 'negative', icon: 'error' },
      negative: { color: 'negative', icon: 'error' },
      warning: { color: 'warning', icon: 'warning' },
      info: { color: 'info', icon: 'info' }
    }

    const config = typeMap[type] || typeMap.info

    Notify.create({
      message,
      color: config.color,
      icon: config.icon,
      position: 'top',
      timeout,
      classes: 'gemini-notify',
      actions: [{ icon: 'close', color: 'white', round: true, size: 'sm' }]
    })
  }
}

// MathJax 工具
export { MathJaxUtils } from './math/mathjax'

// 拍照搜题日志工具
export { photoSearchLogger } from './photoSearchLogger'

// 节流和防抖工具
export { throttle, debounce, ThrottleUtils, DebounceUtils } from './common/throttle'

// 章节相关工具函数
export {
  convertChineseNumberToArabic,
  convertToChineseNumber,
  extractChapterNumberFromName,
  parseChapterOrderFromFileName,
  sortChaptersByNumber
} from './chapter-utils'

// 类型定义
export type { ExerciseItem, SimilarExercise } from '../types'