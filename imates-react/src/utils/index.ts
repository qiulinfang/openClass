/**
 * 工具函数统一导出文件
 * 提供项目中所有工具函数的统一入口
 */

import { androidBridge } from '@/services/business/android-bridge'

let toastContainer: HTMLDivElement | null = null

function createToastContainer() {
  if (toastContainer) return toastContainer
  toastContainer = document.createElement('div')
  toastContainer.id = 'toast-container'
  toastContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  `
  document.body.appendChild(toastContainer)
  return toastContainer
}

function showToast(message: string, type: string) {
  const container = createToastContainer()
  const toast = document.createElement('div')
  const colors: Record<string, string> = {
    success: '#4caf50',
    positive: '#4caf50',
    error: '#f44336',
    negative: '#f44336',
    warning: '#ff9800',
    info: '#2196f3'
  }
  toast.textContent = message
  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
    animation: fadeIn 0.3s ease;
    pointer-events: auto;
  `
  container.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s ease'
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

/**
 * 统一的消息提示函数（智能选择实现方式）
 * 判断运行环境（Android WebView 或 Web）
 * Android WebView 使用 androidBridge.showToast
 * Web 环境使用自定义 Toast
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
    // 使用自定义 Toast（Web 环境）
    showToast(message, type)
  }
}

// MathJax 工具
export { MathJaxUtils } from '@/utils/math/mathjax'

// 拍照搜题日志工具
export { photoSearchLogger } from '@/utils/logging/photoSearchLogger'

// 节流和防抖工具
export { throttle, debounce, ThrottleUtils, DebounceUtils } from '@/utils/common/throttle'

// 章节相关工具函数
export {
  convertChineseNumberToArabic,
  convertToChineseNumber,
  extractChapterNumberFromName,
  parseChapterOrderFromFileName,
  sortChaptersByNumber
} from '@/utils/business/chapter-utils'

// 用户相关工具
export {
  UserType,
  getUserId,
  getPassword,
  getYanbanToken,
  getXuebanToken,
  getScopedStorageValue,
  isYanbanLoggedIn,
} from '@/services'

// 收藏功能工具
export {
  toggleExerciseFavorite,
  removeExerciseFavorite,
  getFavoriteExercises,
  toggleSessionFavorite,
  removeSessionFavorite,
  getFavoriteSessions,
  type FavoriteExercise
} from '@/utils/storage/favorites'

// 缩略图生成工具
export { thumbnailQueue } from '@/utils/thumbnail/thumbnail-queue'
export { isPdfFile, generatePdfThumbnail } from '@/utils/thumbnail/pdf-thumbnail'
export { isImageFile, generateImageThumbnail } from '@/utils/thumbnail/image-thumbnail'
export { isHtmlFile, generateHtmlThumbnail } from '@/utils/thumbnail/html-thumbnail'
export { isVideoFile, generateVideoThumbnail } from '@/utils/thumbnail/video-thumbnail'

// 类型定义
export type { ExerciseItem, SimilarExercise } from '@/types'