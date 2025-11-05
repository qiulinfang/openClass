/**
 * 视频缩略图生成工具
 * 从视频文件数据生成第一帧缩略图
 */

/**
 * 从视频文件数据生成第一帧缩略图
 * @param fileData 视频文件的二进制数据
 * @param maxWidth 缩略图最大宽度（默认200px）
 * @param maxHeight 缩略图最大高度（默认280px）
 * @returns Promise<string> 返回base64格式的缩略图数据URL
 */
export async function generateVideoThumbnail(
  fileData: Uint8Array,
  maxWidth: number = 200,
  maxHeight: number = 280
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 第1步：将Uint8Array转换为Blob
      const blob = new Blob([fileData])
      
      // 第2步：创建视频URL
      const videoUrl = URL.createObjectURL(blob)
      
      // 第3步：创建video元素
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true // 静音以避免自动播放限制
      video.playsInline = true
      
      // 第4步：等待视频加载元数据
      video.onloadedmetadata = () => {
        try {
          // 第5步：跳转到第一帧（0秒）
          video.currentTime = 0.1 // 使用0.1秒以确保第一帧已加载
        } catch (error) {
          console.warn('设置视频时间失败:', error)
        }
      }
      
      // 第6步：等待视频帧加载完成
      video.onseeked = () => {
        try {
          // 第7步：计算缩略图尺寸
          const videoWidth = video.videoWidth
          const videoHeight = video.videoHeight
          
          if (videoWidth === 0 || videoHeight === 0) {
            throw new Error('无法获取视频尺寸')
          }
          
          const scale = Math.min(maxWidth / videoWidth, maxHeight / videoHeight, 1)
          const thumbWidth = videoWidth * scale
          const thumbHeight = videoHeight * scale
          
          // 第8步：创建canvas元素
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (!context) {
            throw new Error('无法创建canvas上下文')
          }
          
          // 第9步：设置canvas尺寸
          canvas.width = thumbWidth
          canvas.height = thumbHeight
          
          // 第10步：将视频帧绘制到canvas
          context.drawImage(video, 0, 0, thumbWidth, thumbHeight)
          
          // 第11步：转换为base64数据URL
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          
          // 第12步：清理资源
          URL.revokeObjectURL(videoUrl)
          video.src = ''
          video.load()
          
          resolve(thumbnailDataUrl)
          
        } catch (error) {
          URL.revokeObjectURL(videoUrl)
          video.src = ''
          video.load()
          reject(error)
        }
      }
      
      // 第13步：处理视频加载错误
      video.onerror = (error) => {
        URL.revokeObjectURL(videoUrl)
        video.src = ''
        video.load()
        
        // 如果视频加载失败，创建视频图标缩略图
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          reject(new Error('无法创建canvas上下文'))
          return
        }
        
        canvas.width = maxWidth
        canvas.height = maxHeight
        
        // 绘制背景
        context.fillStyle = '#000000'
        context.fillRect(0, 0, maxWidth, maxHeight)
        
        // 绘制播放图标
        context.fillStyle = '#ffffff'
        context.beginPath()
        context.moveTo(maxWidth / 2 - 10, maxHeight / 2 - 15)
        context.lineTo(maxWidth / 2 - 10, maxHeight / 2 + 15)
        context.lineTo(maxWidth / 2 + 15, maxHeight / 2)
        context.closePath()
        context.fill()
        
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve(thumbnailDataUrl)
      }
      
      // 第14步：设置视频源并加载
      video.src = videoUrl
      
      // 第15步：设置超时，防止视频加载时间过长
      setTimeout(() => {
        if (video.readyState < 2) { // 如果视频元数据还未加载完成
          URL.revokeObjectURL(videoUrl)
          video.src = ''
          video.load()
          
          // 创建视频图标缩略图
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (!context) {
            reject(new Error('视频加载超时'))
            return
          }
          
          canvas.width = maxWidth
          canvas.height = maxHeight
          
          context.fillStyle = '#000000'
          context.fillRect(0, 0, maxWidth, maxHeight)
          
          context.fillStyle = '#ffffff'
          context.beginPath()
          context.moveTo(maxWidth / 2 - 10, maxHeight / 2 - 15)
          context.lineTo(maxWidth / 2 - 10, maxHeight / 2 + 15)
          context.lineTo(maxWidth / 2 + 15, maxHeight / 2)
          context.closePath()
          context.fill()
          
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          resolve(thumbnailDataUrl)
        }
      }, 10000) // 10秒超时
      
    } catch (error) {
      console.error('生成视频缩略图失败:', error)
      reject(new Error(`生成视频缩略图失败: ${error instanceof Error ? error.message : '未知错误'}`))
    }
  })
}

/**
 * 检查文件是否为视频格式
 * @param fileName 文件名
 * @returns boolean 是否为视频文件
 */
export function isVideoFile(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop()
  const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'm4v']
  return videoExtensions.includes(extension || '')
}

