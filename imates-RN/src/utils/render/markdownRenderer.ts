/**
 * Markdown 渲染工具（React Native 版本）
 * 提供 Markdown 渲染功能，用于渲染聊天消息中的 Markdown 和数学公式
 * 
 * 注意：React Native 中使用 react-native-markdown-display 进行渲染，
 * 这个工具主要用于预处理 LaTeX 格式
 */

/**
 * 预处理LaTeX公式格式
 * 将各种LaTeX格式统一转换为markdown-it可识别的格式
 * 支持MathLive输出格式和传统LaTeX格式
 */
function preprocessLatexFormats(contentStr: string): string {
  let processedContent = contentStr

  // 1. 处理MathLive输出格式 - 检测MathLive的数学模式标记
  // MathLive通常输出带有数学模式标记的内容
  const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs
  processedContent = processedContent.replace(mathLiveRegex, '$$$1$$')

  // 2. 处理分段函数 - 将包含array环境的行内公式转换为块级公式
  const piecewiseFunctionRegex = /\\\(([^)]*\\begin\{array\}[^)]*\\end\{array\}[^)]*)\\\)/gs
  processedContent = processedContent.replace(piecewiseFunctionRegex, (match, content) => {
    // 分段函数使用块级公式显示
    return `$$${content}$$`
  })

  // 3. 处理其他复杂公式 - 包含多行或复杂结构的行内公式
  const complexFormulaRegex = /\\\(([^)]*\\begin\{[^}]*\}[^)]*\\end\{[^}]*\}[^)]*)\\\)/gs
  processedContent = processedContent.replace(complexFormulaRegex, (match, content) => {
    // 复杂公式使用块级公式显示
    return `$$${content}$$`
  })

  // 4. 处理普通行内公式 \(...\) 格式
  const inlineRegex = /\\\((.*?)\\\)/gs
  processedContent = processedContent.replace(inlineRegex, '$$$1$')

  // 5. 处理块级公式 \[...\] 格式
  const displayRegex = /\\\[(.*?)\\\]/gs
  processedContent = processedContent.replace(displayRegex, '$$$$$1$$$$')

  // 6. 处理MathLive的AsciiMath格式（如果存在）
  const asciiMathRegex = /\`(.*?)\`/gs
  processedContent = processedContent.replace(asciiMathRegex, '$$$1$$')

  // 7. 处理MathLive的MathML格式（转换为LaTeX）
  const mathMLRegex = /<math[^>]*>(.*?)<\/math>/gs
  processedContent = processedContent.replace(mathMLRegex, (match, content) => {
    // 简单的MathML到LaTeX转换（可以根据需要扩展）
    return `$$${content}$$`
  })

  return processedContent
}

/**
 * 渲染缓存，避免重复渲染相同内容
 */
const renderCache = new Map<string, string>()
const MAX_CACHE_SIZE = 100

/**
 * 管理缓存
 * 在缓存满时清理最旧的条目，然后缓存新结果
 */
function manageCache(contentStr: string, result: string): void {
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
 * 处理输入内容，进行LaTeX预处理
 * 注意：实际渲染由 react-native-markdown-display 组件完成
 * 这个函数主要用于预处理内容
 */
export function renderMessageContent(content: any): string {
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
    
    // 5. 后处理渲染结果（清理多余的换行符）
    const trimmedRendered = processedContent.replace(/\n+$/, '')
    
    // 6. 管理缓存
    manageCache(contentStr, trimmedRendered)

    return trimmedRendered
  } catch (error) {
    console.warn('[markdownRenderer] 渲染错误:', error)
    // 错误处理：返回原始内容的字符串形式
    return typeof content === 'string' ? content : String(content || '')
  }
}

/**
 * 清理渲染缓存
 */
export function clearRenderCache(): void {
  renderCache.clear()
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats() {
  return {
    size: renderCache.size,
    maxSize: MAX_CACHE_SIZE,
  }
}
