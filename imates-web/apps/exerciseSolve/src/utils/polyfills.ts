/**
 * WebView 兼容性 Polyfills
 * 为较旧的 WebView 版本提供现代 API 支持
 */

/**
 * AbortSignal.timeout polyfill
 * 为不支持 AbortSignal.timeout 的环境提供兼容性
 */
export function polyfillAbortSignalTimeout() {
  if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
    AbortSignal.timeout = function(milliseconds: number): AbortSignal {
      const controller = new AbortController()
      setTimeout(() => {
        controller.abort()
      }, milliseconds)
      return controller.signal
    }
  }
}

/**
 * 创建带超时的 AbortController
 */
export function createTimeoutController(timeout: number): {
  controller: AbortController | null
  timeoutId: number
  cleanup: () => void
} {
  let controller: AbortController | null = null
  let timeoutId: number = 0

  try {
    // 尝试创建 AbortController
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController()
      timeoutId = setTimeout(() => {
        controller?.abort()
      }, timeout)
    }
  } catch (error) {
  }

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }

  return { controller, timeoutId, cleanup }
}

/**
 * 初始化所有 polyfills
 */
export function initPolyfills() {
  polyfillAbortSignalTimeout()
}