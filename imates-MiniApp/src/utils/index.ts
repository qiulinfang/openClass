/**
 * 工具函数统一导出文件
 * 提供项目中所有工具函数的统一入口
 */

/**
 * 统一的消息提示函数
 * 适配小程序环境使用 uni.showToast
 */
export const showMessage = (
  message: string,
  type: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error' = 'positive',
  timeout: number = 2000
) => {
  const iconMap: Record<string, 'success' | 'error' | 'none'> = {
    success: 'success',
    positive: 'success',
    error: 'error',
    negative: 'error',
    warning: 'none',
    info: 'none'
  };

  uni.showToast({
    title: message,
    icon: iconMap[type] || 'none',
    duration: timeout
  });
};

// 节流和防抖工具
export { throttle, debounce, ThrottleUtils, DebounceUtils } from './common/throttle';
