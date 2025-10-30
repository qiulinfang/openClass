/**
 * 工具函数统一导出文件
 * 提供项目中所有工具函数的统一入口
 */

import { Notify } from 'quasar'

/**
 * 统一的消息提示函数（使用 Quasar Notify + Gemini 风格样式）
 * 第1步：映射消息类型到 Quasar 类型
 * 第2步：显示通知
 */
export const showMessage = (
  message: string,
  type: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error' = 'positive',
  timeout: number = 2000
) => {
  // 映射类型到 Quasar Notify 类型
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

// MathJax 工具
export { MathJaxUtils } from './math/mathjax'

// 节流和防抖工具
export { throttle, debounce, ThrottleUtils, DebounceUtils } from './common/throttle'

// 类型定义
export type { ExerciseItem, SimilarExercise } from '../types'