/**
 * 节流和防抖工具函数
 * 提供防止快速重复调用的功能
 */

/**
 * 节流函数 - 在指定时间内只执行一次函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: any = null;
  let lastExecTime = 0;
  
  return function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

/**
 * 防抖函数 - 在指定时间内只执行最后一次调用
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: any = null;
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

export class ThrottleUtils {
  static fast = <T extends (...args: any[]) => any>(func: T) => throttle(func, 100);
  static standard = <T extends (...args: any[]) => any>(func: T) => throttle(func, 300);
  static slow = <T extends (...args: any[]) => any>(func: T) => throttle(func, 500);
  static verySlow = <T extends (...args: any[]) => any>(func: T) => throttle(func, 1000);
}

export class DebounceUtils {
  static fast = <T extends (...args: any[]) => any>(func: T) => debounce(func, 100);
  static standard = <T extends (...args: any[]) => any>(func: T) => debounce(func, 300);
  static slow = <T extends (...args: any[]) => any>(func: T) => debounce(func, 500);
  static verySlow = <T extends (...args: any[]) => any>(func: T) => debounce(func, 1000);
}
