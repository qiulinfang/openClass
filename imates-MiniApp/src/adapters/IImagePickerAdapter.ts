/**
 * 图片选择适配器接口
 * 定义统一的图片选择接口，支持不同环境的实现
 */
import type { ImageData } from '../../types'

/**
 * 图片选择适配器接口
 */
export interface IImagePickerAdapter {
  /**
   * 从相机拍照
   * @returns Promise<ImageData | null> 返回图片数据，如果用户取消则返回 null
   */
  captureFromCamera(): Promise<ImageData | null>

  /**
   * 从相册选择图片
   * @returns Promise<ImageData | null> 返回图片数据，如果用户取消则返回 null
   */
  selectFromGallery(): Promise<ImageData | null>

  /**
   * 检查适配器是否可用
   * @returns boolean 是否可用
   */
  isAvailable(): boolean
}

