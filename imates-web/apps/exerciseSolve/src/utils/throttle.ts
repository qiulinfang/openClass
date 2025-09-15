/**
 * 节流和防抖工具函数
 * 提供防止快速重复调用的功能
 */

/**
 * 节流函数 - 在指定时间内只执行一次函数
 * @param func 要节流的函数
 * @param delay 节流延迟时间（毫秒）
 * @returns 节流后的函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number | null = null
  let lastExecTime = 0
  
  return function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now()
    
    if (currentTime - lastExecTime > delay) {
      // 如果距离上次执行时间超过延迟时间，立即执行
      func.apply(this, args)
      lastExecTime = currentTime
    } else {
      // 否则清除之前的定时器，设置新的定时器
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        func.apply(this, args)
        lastExecTime = Date.now()
      }, delay - (currentTime - lastExecTime))
    }
  }
}

/**
 * 防抖函数 - 在指定时间内只执行最后一次调用
 * @param func 要防抖的函数
 * @param delay 防抖延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number | null = null
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = window.setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

/**
 * 节流工具类 - 提供常用的节流配置
 */
export class ThrottleUtils {
  /**
   * 快速节流 - 100ms，适用于频繁的UI交互
   */
  static fast = <T extends (...args: any[]) => any>(func: T) => 
    throttle(func, 100)
  
  /**
   * 标准节流 - 300ms，适用于一般的用户操作
   */
  static standard = <T extends (...args: any[]) => any>(func: T) => 
    throttle(func, 300)
  
  /**
   * 慢速节流 - 500ms，适用于重要操作
   */
  static slow = <T extends (...args: any[]) => any>(func: T) => 
    throttle(func, 500)
  
  /**
   * 极慢节流 - 1000ms，适用于可能产生副作用的操作
   */
  static verySlow = <T extends (...args: any[]) => any>(func: T) => 
    throttle(func, 1000)
}


/**
 * 防抖工具类 - 提供常用的防抖配置
 */
export class DebounceUtils {
  /**
   * 快速防抖 - 100ms
   */
  static fast = <T extends (...args: any[]) => any>(func: T) => 
    debounce(func, 100)
  
  /**
   * 标准防抖 - 300ms
   */
  static standard = <T extends (...args: any[]) => any>(func: T) => 
    debounce(func, 300)
  
  /**
   * 慢速防抖 - 500ms
   */
  static slow = <T extends (...args: any[]) => any>(func: T) => 
    debounce(func, 500)
  
  /**
   * 极慢防抖 - 1000ms
   */
  static verySlow = <T extends (...args: any[]) => any>(func: T) => 
    debounce(func, 1000)
}
