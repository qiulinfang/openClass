/**
 * 小程序图片选择适配器
 * 使用 uni.chooseImage 实现图片选择功能
 */
import type { IImagePickerAdapter } from './IImagePickerAdapter'
import type { ImageData } from '../../types'

export class MiniAppImagePickerAdapter implements IImagePickerAdapter {
  /**
   * 从相机拍照
   */
  async captureFromCamera(): Promise<ImageData | null> {
    return this.chooseImage(['camera'])
  }

  /**
   * 从相册选择图片
   */
  async selectFromGallery(): Promise<ImageData | null> {
    return this.chooseImage(['album'])
  }

  /**
   * 统一处理图片选择
   */
  private chooseImage(sourceType: Array<'album' | 'camera'>): Promise<ImageData | null> {
    return new Promise((resolve) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType,
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0]
          const tempFile = res.tempFiles[0] as any

          // 在小程序中获取图片信息
          uni.getImageInfo({
            src: tempFilePath,
            success: (info) => {
              // 读取文件为 base64
              const fs = uni.getFileSystemManager()
              try {
                const base64 = fs.readFileSync(tempFilePath, 'base64')
                const extension = tempFilePath.split('.').pop() || 'jpg'
                const base64DataUrl = `data:image/${extension};base64,${base64}`

                const imageData: ImageData = {
                  filePath: tempFilePath,
                  width: info.width,
                  height: info.height,
                  fileSize: tempFile.size || 0,
                  base64DataUrl: base64DataUrl
                }
                resolve(imageData)
              } catch (e) {
                console.error('[MiniAppImagePickerAdapter] ❌ 读取文件失败:', e)
                resolve(null)
              }
            },
            fail: (err) => {
              console.error('[MiniAppImagePickerAdapter] ❌ 获取图片信息失败:', err)
              resolve(null)
            }
          })
        },
        fail: (err) => {
          // 用户取消选择或选择失败
          if (err.errMsg.indexOf('cancel') === -1) {
            console.error('[MiniAppImagePickerAdapter] ❌ 选择图片失败:', err)
          }
          resolve(null)
        }
      })
    })
  }

  /**
   * 检查适配器是否可用
   */
  isAvailable(): boolean {
    return typeof uni !== 'undefined' && !!uni.chooseImage
  }
}
