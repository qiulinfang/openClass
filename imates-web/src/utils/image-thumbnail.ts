/**
 * 图片缩略图生成工具
 * 从图片文件数据生成缩略图
 */

/**
 * 从图片文件数据生成缩略图
 * @param fileData 图片文件的二进制数据
 * @param maxWidth 缩略图最大宽度（默认200px）
 * @param maxHeight 缩略图最大高度（默认280px）
 * @returns Promise<string> 返回base64格式的缩略图数据URL
 */
export async function generateImageThumbnail(
  fileData: Uint8Array,
  maxWidth: number = 200,
  maxHeight: number = 280
): Promise<string> {
  try {
    // 第1步：将Uint8Array转换为Blob
    const blob = new Blob([fileData])
    
    // 第2步：创建图片URL
    const imageUrl = URL.createObjectURL(blob)
    
    // 第3步：加载图片
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = imageUrl
    })
    
    // 第4步：计算缩略图尺寸
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    const thumbWidth = img.width * scale
    const thumbHeight = img.height * scale
    
    // 第5步：创建canvas元素
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      throw new Error('无法创建canvas上下文')
    }
    
    // 第6步：设置canvas尺寸
    canvas.width = thumbWidth
    canvas.height = thumbHeight
    
    // 第7步：绘制缩略图
    context.drawImage(img, 0, 0, thumbWidth, thumbHeight)
    
    // 第8步：转换为base64数据URL
    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    
    // 第9步：清理资源
    URL.revokeObjectURL(imageUrl)
    
    return thumbnailDataUrl
    
  } catch (error) {
    console.error('生成图片缩略图失败:', error)
    throw new Error(`生成图片缩略图失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 检查文件是否为图片格式
 * @param fileName 文件名
 * @returns boolean 是否为图片文件
 */
export function isImageFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop()
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
  return imageExtensions.includes(extension || '')
}

