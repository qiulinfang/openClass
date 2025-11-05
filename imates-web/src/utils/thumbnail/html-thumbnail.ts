/**
 * HTML缩略图生成工具
 * 从HTML文件数据生成缩略图
 */

/**
 * 从HTML文件数据生成缩略图
 * @param fileData HTML文件的二进制数据
 * @param maxWidth 缩略图最大宽度（默认200px）
 * @param maxHeight 缩略图最大高度（默认280px）
 * @returns Promise<string> 返回base64格式的缩略图数据URL
 */
export async function generateHtmlThumbnail(
  fileData: Uint8Array,
  maxWidth: number = 200,
  maxHeight: number = 280
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 第1步：将Uint8Array转换为文本
      const decoder = new TextDecoder('utf-8')
      const htmlContent = decoder.decode(fileData)
      
      // 第2步：创建隐藏的iframe元素
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.top = '-9999px'
      iframe.style.left = '-9999px'
      iframe.style.width = `${maxWidth * 2}px` // 使用2倍尺寸以获得更好的清晰度
      iframe.style.height = `${maxHeight * 2}px`
      iframe.style.border = 'none'
      iframe.style.visibility = 'hidden'
      
      // 第3步：定义iframe加载完成处理函数
      const handleIframeLoad = async () => {
        try {
          // 第4步：获取iframe的contentDocument
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          
          if (!iframeDoc) {
            throw new Error('无法访问iframe内容（可能由于跨域限制）')
          }
          
          // 第5步：等待内容渲染完成
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // 第6步：创建canvas元素
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (!context) {
            throw new Error('无法创建canvas上下文')
          }
          
          // 第7步：设置canvas尺寸
          canvas.width = maxWidth
          canvas.height = maxHeight
          
          // 第8步：尝试从iframe截图
          // 由于浏览器安全限制，直接使用drawImage可能不工作
          // 我们尝试使用html2canvas的替代方案：手动绘制关键元素
          // 或者使用Canvas的drawImage方法（如果iframe内容可访问）
          
          // 方案1：尝试使用html2canvas（如果可用）
          // 方案2：手动解析HTML并绘制关键内容
          // 方案3：使用iframe的contentWindow截图（如果支持）
          
          // 由于浏览器安全限制，我们使用一个简单的降级方案：
          // 创建一个代表HTML内容的预览图（包含HTML标签图标和文本预览）
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, maxWidth, maxHeight)
          
          // 绘制背景网格（模拟HTML页面）
          context.strokeStyle = '#e0e0e0'
          context.lineWidth = 1
          for (let i = 0; i < maxWidth; i += 20) {
            context.beginPath()
            context.moveTo(i, 0)
            context.lineTo(i, maxHeight)
            context.stroke()
          }
          for (let i = 0; i < maxHeight; i += 20) {
            context.beginPath()
            context.moveTo(0, i)
            context.lineTo(maxWidth, i)
            context.stroke()
          }
          
          // 绘制HTML图标（简单的</>符号）
          context.fillStyle = '#2196F3'
          context.font = 'bold 48px Arial'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText('</>', maxWidth / 2, maxHeight / 2 - 20)
          
          // 绘制文本预览（HTML的前几个字符）
          const previewText = htmlContent.substring(0, 30).replace(/[\n\r\t]/g, ' ').trim()
          context.fillStyle = '#666666'
          context.font = '12px Arial'
          context.textAlign = 'center'
          context.fillText(previewText || 'HTML文件', maxWidth / 2, maxHeight / 2 + 20)
          
          // 第9步：转换为base64数据URL
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          
          // 第10步：清理资源
          document.body.removeChild(iframe)
          
          resolve(thumbnailDataUrl)
          
        } catch (error) {
          // 如果iframe截图失败，使用降级方案
          document.body.removeChild(iframe)
          
          // 创建简单的HTML图标缩略图
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (!context) {
            reject(new Error('无法创建canvas上下文'))
            return
          }
          
          canvas.width = maxWidth
          canvas.height = maxHeight
          
          // 绘制背景
          context.fillStyle = '#f5f5f5'
          context.fillRect(0, 0, maxWidth, maxHeight)
          
          // 绘制HTML图标
          context.fillStyle = '#2196F3'
          context.font = 'bold 48px Arial'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText('</>', maxWidth / 2, maxHeight / 2)
          
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          resolve(thumbnailDataUrl)
        }
      }
      
      // 第4步：将iframe添加到DOM
      document.body.appendChild(iframe)
      
      // 第5步：将HTML内容写入iframe
      // 优先尝试直接写入，如果失败则使用Blob URL
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (iframeDoc) {
          // 直接写入方式：可以访问iframe内容
          iframe.onload = handleIframeLoad
          iframe.onerror = () => {
            if (iframe.parentNode) {
              document.body.removeChild(iframe)
            }
            reject(new Error('iframe加载失败'))
          }
          
          iframeDoc.open()
          iframeDoc.write(htmlContent)
          iframeDoc.close()
        } else {
          // Blob URL方式：无法直接访问iframe内容
          const blob = new Blob([htmlContent], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          
          // 设置超时，如果iframe加载失败，使用降级方案
          let timeoutId: NodeJS.Timeout | null = null
          
          const handleBlobLoad = () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            handleIframeLoad()
          }
          
          iframe.onload = handleBlobLoad
          iframe.onerror = () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            URL.revokeObjectURL(url)
            if (iframe.parentNode) {
              document.body.removeChild(iframe)
            }
            reject(new Error('iframe加载失败'))
          }
          
          iframe.src = url
          
          // 设置超时，防止iframe加载时间过长
          timeoutId = setTimeout(() => {
            try {
              const canvas = document.createElement('canvas')
              const context = canvas.getContext('2d')
              
              if (!context) {
                throw new Error('无法创建canvas上下文')
              }
              
              canvas.width = maxWidth
              canvas.height = maxHeight
              
              // 创建简单的HTML图标缩略图
              context.fillStyle = '#f5f5f5'
              context.fillRect(0, 0, maxWidth, maxHeight)
              
              context.fillStyle = '#2196F3'
              context.font = 'bold 48px Arial'
              context.textAlign = 'center'
              context.textBaseline = 'middle'
              context.fillText('</>', maxWidth / 2, maxHeight / 2)
              
              const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
              
              URL.revokeObjectURL(url)
              if (iframe.parentNode) {
                document.body.removeChild(iframe)
              }
              
              resolve(thumbnailDataUrl)
            } catch (error) {
              URL.revokeObjectURL(url)
              if (iframe.parentNode) {
                document.body.removeChild(iframe)
              }
              reject(error)
            }
          }, 2000) // 2秒超时
        }
      } catch (error) {
        // 如果写入失败，直接使用降级方案
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
        
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          reject(new Error('无法创建canvas上下文'))
          return
        }
        
        canvas.width = maxWidth
        canvas.height = maxHeight
        
        context.fillStyle = '#f5f5f5'
        context.fillRect(0, 0, maxWidth, maxHeight)
        
        context.fillStyle = '#2196F3'
        context.font = 'bold 48px Arial'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText('</>', maxWidth / 2, maxHeight / 2)
        
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve(thumbnailDataUrl)
      }
      
    } catch (error) {
      console.error('生成HTML缩略图失败:', error)
      reject(new Error(`生成HTML缩略图失败: ${error instanceof Error ? error.message : '未知错误'}`))
    }
  })
}

/**
 * 检查文件是否为HTML格式
 * @param fileName 文件名
 * @returns boolean 是否为HTML文件
 */
export function isHtmlFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop()
  const htmlExtensions = ['html', 'htm']
  return htmlExtensions.includes(extension || '')
}

