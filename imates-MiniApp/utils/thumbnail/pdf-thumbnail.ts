/**
 * PDF缩略图生成工具
 * 使用 MuPDF.js 提取PDF第一页并转换为缩略图
 */

import * as mupdf from 'mupdf'

/**
 * 从PDF文件数据生成第一页缩略图
 * @param fileData PDF文件的二进制数据
 * @param maxWidth 缩略图最大宽度（默认200px）
 * @param maxHeight 缩略图最大高度（默认280px）
 * @returns Promise<string> 返回base64格式的缩略图数据URL
 */
export async function generatePdfThumbnail(
  fileData: Uint8Array, 
  maxWidth: number = 200, 
  maxHeight: number = 280
): Promise<string> {
  try {
    // 将Uint8Array转换为ArrayBuffer
    const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
    
    // 使用 MuPDF 加载PDF文档
    const uint8Array = new Uint8Array(arrayBuffer as ArrayBuffer)
    const doc = mupdf.Document.openDocument(uint8Array, 'application/pdf')
    
    // 获取第一页（MuPDF 使用 0-based index）
    const page = doc.loadPage(0)
    const bounds = page.getBounds()
    const pageWidth = bounds[2] - bounds[0]
    const pageHeight = bounds[3] - bounds[1]
    
    // 计算缩略图尺寸
    const scale = Math.min(maxWidth / pageWidth, maxHeight / pageHeight)
    const scaledWidth = pageWidth * scale
    const scaledHeight = pageHeight * scale
    
    // 创建canvas元素
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      throw new Error('无法创建canvas上下文')
    }
    
    // 设置canvas尺寸
    canvas.width = scaledWidth
    canvas.height = scaledHeight
    
    // 创建变换矩阵并渲染PDF页面到canvas
    const matrix: mupdf.Matrix = [
      scale, // sx
      0, // shx
      0, // shy
      scale, // sy
      0, // tx
      0, // ty
    ]
    
    // 使用 RGB 颜色空间渲染页面
    const pixmap = page.toPixmap(
      matrix,
      mupdf.ColorSpace.DeviceRGB,
      false, // 不需要 alpha 通道
    )
    
    // 将 Pixmap 绘制到 Canvas
    const pixels = pixmap.getPixels()
    const width = pixmap.getWidth()
    const height = pixmap.getHeight()
    
    // 将 RGB 数据转换为 RGBA 数据（ImageData 需要 RGBA 格式）
    const rgbData = new Uint8Array(pixels)
    const rgbaData = new Uint8ClampedArray(width * height * 4)
    
    for (let i = 0; i < width * height; i++) {
      const rgbIndex = i * 3
      const rgbaIndex = i * 4
      rgbaData[rgbaIndex] = rgbData[rgbIndex] // R
      rgbaData[rgbaIndex + 1] = rgbData[rgbIndex + 1] // G
      rgbaData[rgbaIndex + 2] = rgbData[rgbIndex + 2] // B
      rgbaData[rgbaIndex + 3] = 255 // A (完全不透明)
    }
    
    // 创建 ImageData 并绘制到 Canvas
    const imageData = new ImageData(rgbaData, width, height)
    context.putImageData(imageData, 0, 0)
    
    // 转换为base64数据URL
    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    
    // 清理资源
    pixmap.destroy()
    page.destroy()
    doc.destroy()
    
    return thumbnailDataUrl
    
  } catch (error) {
    console.error('生成PDF缩略图失败:', error)
    throw new Error(`生成PDF缩略图失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 检查文件是否为PDF格式
 * @param fileName 文件名
 * @returns boolean 是否为PDF文件
 */
export function isPdfFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop()
  return extension === 'pdf'
}

/**
 * 从base64数据URL中提取纯base64字符串
 * @param dataUrl base64数据URL（如：data:image/jpeg;base64,/9j/4AAQ...）
 * @returns string 纯base64字符串
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  const base64Index = dataUrl.indexOf(',')
  if (base64Index === -1) {
    return dataUrl
  }
  return dataUrl.substring(base64Index + 1)
}

/**
 * 将base64字符串转换为数据URL
 * @param base64String 纯base64字符串
 * @param mimeType MIME类型（默认image/jpeg）
 * @returns string 数据URL
 */
export function base64ToDataUrl(base64String: string, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${base64String}`
}
