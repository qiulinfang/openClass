/**
 * 工具函数统一导出文件
 * 提供项目中所有工具函数的统一入口
 */

import { Notify } from 'quasar'
import { androidBridge } from '@/services/business/android-bridge'

/**
 * 统一的消息提示函数（智能选择实现方式）
 * 判断运行环境（Android WebView 或 Web）
 * Android WebView 使用 androidBridge.showToast
 * Web 环境使用 Quasar Notify
 */
export const showMessage = (
  message: string,
  type: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error' = 'positive',
  timeout: number = 2000
) => {
  // 判断是否在 Android WebView 环境
  if (androidBridge.isAndroidBridgeAvailable()) {
    // 使用原生 Toast
    androidBridge.showToast(message)
  } else {
    // 使用 Quasar Notify（Web 环境）
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
export { photoSearchLogger } from './logging/photoSearchLogger'

// 节流和防抖工具
export { throttle, debounce, ThrottleUtils, DebounceUtils } from './common/throttle'

// 章节相关工具函数
export {
  convertChineseNumberToArabic,
  convertToChineseNumber,
  extractChapterNumberFromName,
  parseChapterOrderFromFileName,
  sortChaptersByNumber
} from './business/chapter-utils'

// 用户相关工具
export {
  UserType,
  getUserId,
  getPassword,
  getYanbanToken,
  getXuebanToken,
  getScopedStorageValue,
  isYanbanLoggedIn,
} from '../services'

// 收藏功能工具
export {
  toggleExerciseFavorite,
  removeExerciseFavorite,
  getFavoriteExercises,
  toggleSessionFavorite,
  removeSessionFavorite,
  getFavoriteSessions,
  type FavoriteExercise
} from './storage/favorites'

// 缩略图生成工具
export { thumbnailQueue } from './thumbnail/thumbnail-queue'
export { isPdfFile, generatePdfThumbnail } from './thumbnail/pdf-thumbnail'
export { isImageFile, generateImageThumbnail } from './thumbnail/image-thumbnail'
export { isHtmlFile, generateHtmlThumbnail } from './thumbnail/html-thumbnail'
export { isVideoFile, generateVideoThumbnail } from './thumbnail/video-thumbnail'

// 类型定义
export type { ExerciseItem, SimilarExercise } from '../types'