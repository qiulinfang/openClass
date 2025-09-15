
import MarkdownIt from 'markdown-it'
// @ts-ignore - markdown-it-mathjax3 可能没有类型声明
import mathjax3 from 'markdown-it-mathjax3'

// 初始化 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,  // 完全禁用typographer功能，防止 (C) -> © 等字符转换
}).use(mathjax3)

export function useMessageRenderer() {
  // 渲染缓存，避免重复渲染相同内容
  const renderCache = new Map<string, string>()
  const MAX_CACHE_SIZE = 100
  
/**
 * 预处理LaTeX公式格式
 * 将各种LaTeX格式统一转换为markdown-it可识别的格式
 * 支持MathLive输出格式和传统LaTeX格式
 */
const preprocessLatexFormats = (contentStr: string): string => {
  let processedContent = contentStr;
  
  // 1. 处理MathLive输出格式 - 检测MathLive的数学模式标记
  // MathLive通常输出带有数学模式标记的内容
  const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs;
  processedContent = processedContent.replace(mathLiveRegex, '$$$1$$');
  
  // 2. 处理行内公式 \(...\) 格式
  const inlineRegex = /\\\((.*?)\\\)/gs;
  processedContent = processedContent.replace(inlineRegex, '$$$1$');
  
  // 3. 处理块级公式 \[...\] 格式
  const displayRegex = /\\\[(.*?)\\\]/gs;
  processedContent = processedContent.replace(displayRegex, '$$$$$1$$$$');
  
  // 4. 处理MathLive的AsciiMath格式（如果存在）
  const asciiMathRegex = /\`(.*?)\`/gs;
  processedContent = processedContent.replace(asciiMathRegex, '$$$1$$');
  
  // 5. 处理MathLive的MathML格式（转换为LaTeX）
  const mathMLRegex = /<math[^>]*>(.*?)<\/math>/gs;
  processedContent = processedContent.replace(mathMLRegex, (match, content) => {
    // 简单的MathML到LaTeX转换（可以根据需要扩展）
    return `$$${content}$$`;
  });
  
  return processedContent;
};
  
  /**
   * 管理缓存
   * 在缓存满时清理最旧的条目，然后缓存新结果
   */
  const manageCache = (contentStr: string, result: string): void => {
    // 如果缓存已满，清除最旧的缓存项
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value
      if (firstKey !== undefined) {
        renderCache.delete(firstKey)
      }
    }
    // 缓存渲染结果
    renderCache.set(contentStr, result)
  }
  
  /**
   * 渲染消息内容
   * 处理输入内容，进行LaTeX预处理、Markdown渲染和缓存管理
   */
  const renderMessageContent = (content: any): string => {
    try {
      // 1. 标准化输入内容
      const contentStr = typeof content === 'string' ? content : String(content || '')
      
      // 2. 检查缓存
      if (renderCache.has(contentStr)) {
        return renderCache.get(contentStr)!
      }
      
      // 3. 验证内容有效性
      if (!contentStr.trim()) {
        return contentStr
      }
      
      // 4. 预处理LaTeX公式格式
      const processedContent = preprocessLatexFormats(contentStr)
      // 5. 执行Markdown渲染
      const rendered = md.render(processedContent)
      // 6. 后处理渲染结果（清理多余的换行符）
      const trimmedRendered = rendered.replace(/\n+$/, '')
      // 7. 管理缓存
      manageCache(contentStr, trimmedRendered)
      
      return trimmedRendered
    } catch (error) {
      // 错误处理：返回原始内容的字符串形式
      return typeof content === 'string' ? content : String(content || '')
    }
  }

  // 清理渲染缓存
  const clearRenderCache = () => {
    renderCache.clear()
  }
  
  // 获取缓存统计信息
  const getCacheStats = () => {
    return {
      size: renderCache.size,
      maxSize: MAX_CACHE_SIZE
    }
  }

  return {
    renderMessageContent,
    clearRenderCache,
    getCacheStats,
  }
}