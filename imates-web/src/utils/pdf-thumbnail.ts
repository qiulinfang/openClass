/**
 * PDF缩略图生成工具
 * 使用PDF.js提取PDF第一页并转换为缩略图
 */

import * as pdfjsLib from 'pdfjs-dist'

// 动态导入PDF.js worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

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
    // 1. 将Uint8Array转换为ArrayBuffer
    const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
    
    // 2. 加载PDF文档
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer as ArrayBuffer }).promise
    
    // 3. 获取第一页
    const page = await pdf.getPage(1)
    
    // 4. 计算缩略图尺寸
    const viewport = page.getViewport({ scale: 1.0 })
    const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height)
    const scaledViewport = page.getViewport({ scale })
    
    // 5. 创建canvas元素
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      throw new Error('无法创建canvas上下文')
    }
    
    // 6. 设置canvas尺寸
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height
    
    // 7. 渲染PDF页面到canvas
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas
    }
    
    await page.render(renderContext).promise
    
    // 8. 转换为base64数据URL
    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    
    // 9. 清理资源
    page.cleanup()
    
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
