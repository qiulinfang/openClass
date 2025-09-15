/**
 * 图片处理工具类
 * 专门处理安卓原生应用返回的图片数据
 * 简化数据链路，只保留必要的转换功能
 */

/**
 * 将安卓原生应用的图片URI转换为Base64 Data URL
 * 这是唯一需要的转换方式，因为图片信息只能来自于安卓原生的拍照和相册
 * @param uri - 安卓原生应用返回的图片URI
 * @returns Promise<string> - Base64 Data URL格式的字符串 (data:image/jpg;base64,xxx)
 */
export async function uriToBase64DataUrl(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法获取Canvas上下文'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      try {
        // 转换为Base64 Data URL，使用JPEG格式
        // 与安卓原生应用保持一致：data:image/jpg;base64,{base64String}
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        // 将image/jpeg替换为image/jpg以完全匹配安卓原生格式
        const correctedDataUrl = dataUrl.replace('data:image/jpeg;', 'data:image/jpg;');
        resolve(correctedDataUrl);
      } catch (error) {
        reject(new Error('Canvas转换失败'));
      }
    };
    
    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };
    
    img.src = uri;
  });
}