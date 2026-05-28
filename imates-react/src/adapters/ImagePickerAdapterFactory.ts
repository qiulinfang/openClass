/**
 * 图片选择适配器工厂
 * 根据环境自动选择合适的适配器实现
 */
import type { IImagePickerAdapter } from './IImagePickerAdapter'
import { AndroidImagePickerAdapter } from './AndroidImagePickerAdapter'
import { WebImagePickerAdapter } from './WebImagePickerAdapter'
import { androidBridge } from '../services/business/android-bridge'

/**
 * 适配器工厂类
 */
export class ImagePickerAdapterFactory {
  private static androidAdapter: AndroidImagePickerAdapter | null = null
  private static webAdapter: WebImagePickerAdapter | null = null

  /**
   * 获取适配器实例
   * 根据环境自动选择 Android 或 Web 适配器
   */
  static getAdapter(): IImagePickerAdapter {
    // 优先检查 Android Bridge 是否可用
    if (androidBridge.isAndroidBridgeAvailable()) {
      if (!this.androidAdapter) {
        this.androidAdapter = new AndroidImagePickerAdapter()
      }
      return this.androidAdapter
    }

    // 降级到 Web 适配器
    if (!this.webAdapter) {
      this.webAdapter = new WebImagePickerAdapter()
    }
    return this.webAdapter
  }

  /**
   * 检查当前环境
   * @returns 'android' | 'web'
   */
  static getEnvironment(): 'android' | 'web' {
    return androidBridge.isAndroidBridgeAvailable() ? 'android' : 'web'
  }

  /**
   * 清理适配器实例（用于测试或重置）
   */
  static clearAdapters(): void {
    if (this.androidAdapter) {
      this.androidAdapter.destroy()
      this.androidAdapter = null
    }
    this.webAdapter = null
  }
}

