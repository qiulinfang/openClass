/**
 * WebView 兼容性 Polyfills
 * 为较旧的 WebView 版本提供现代 API 支持
 */

/**
 * Promise.withResolvers polyfill
 * 为不支持 Promise.withResolvers 的环境提供兼容性（ES2024新特性）
 */
export function polyfillPromiseWithResolvers() {
  // 检查Promise.withResolvers是否存在
  if (typeof Promise !== 'undefined' && !('withResolvers' in Promise)) {
    // 添加Promise.withResolvers方法
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Promise as any).withResolvers = function<T>(): {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: unknown) => void
    } {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      
      // 创建Promise并捕获resolve和reject函数
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      
      // 返回包含promise、resolve、reject的对象
      return { promise, resolve, reject }
    }
  }
}

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
      }, timeout) as unknown as number
    }
  } catch {
    // 创建AbortController失败，使用默认值
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
  polyfillPromiseWithResolvers()
  polyfillAbortSignalTimeout()
}