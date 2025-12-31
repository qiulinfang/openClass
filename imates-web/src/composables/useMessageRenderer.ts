import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'

// 初始化 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false, // 完全禁用typographer功能，防止 (C) -> 等字符转换
  breaks: true, // 将换行符转换为 <br> 标签
}).use(mathjax3)

export function useMessageRenderer() {
  // 渲染缓存，避免重复渲染相同内容
  const renderCache = new Map<string, string>()
  const MAX_CACHE_SIZE = 100

  const preprocessMarkdownHeadings = (contentStr: string): string => {
    // 仅对非代码块区域进行处理：把非行首出现的标题标记补成新的一行
    // 例："### 1" -> "\n### 1"
    // 避免误伤 fenced code block（```...```）内部
    const parts = contentStr.split(/(```[\s\S]*?```)/g)
    return parts
      .map((part) => {
        if (part.startsWith('```')) return part
        return part.replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n$2')
      })
      .join('')
  }

  /**
   * 预处理LaTeX公式格式
   * 只处理行内公式格式，将 \(...\) 转换为 $...$ 格式
   */
  const preprocessLatexFormats = (contentStr: string): string => {
    let processedContent = contentStr

    // 0. 合并“孤立 $ 块”为块级公式：
    //    形如：
    //    $\n ... \n$
    //    或：$  \n ... \n  $
    //    这种写法在 markdown 中容易被拆成多个段落/换行，导致渲染碎片化。
    //    这里将其统一转换为：\n\n$$...$$\n\n
    const lonelyDollarBlockRegex = /(^|\n)\s*\$(?:\s*)\n([\s\S]*?)\n\s*\$\s*(?=\n|$)/g
    processedContent = processedContent.replace(lonelyDollarBlockRegex, (_m, prefix, content) => {
      const trimmed = String(content ?? '').trim()
      return `${prefix}\n\n$$${trimmed}$$\n\n`
    })

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

    // 处理行内公式 \(...\) 格式，转换为 $...$ 格式
    // 支持 \(...\) 和 \( ... \` 两种格式（允许空格）
    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/gs
    processedContent = processedContent.replace(inlineRegex, '$$$1$')

    // 5. 处理块级公式 \[...\] 格式
    //    注意：块级公式应当独立成段（前后留空行），否则在 markdown-it-mathjax3 下可能被拆段/断行。
    const displayRegex = /\\\[(.*?)\\\]/gs
    processedContent = processedContent.replace(displayRegex, (_match, content) => {
      const trimmed = String(content ?? '').trim()
      return `\n\n$$${trimmed}$$\n\n`
    })

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
  const renderMessageContent = (content: unknown): string => {
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

      // 4. 先反转义常见 HTML 实体，避免公式中出现 &gt; / &lt; / &amp; 之类的字面量
      //    示例：$\scriptstyle x &gt; 0$ -> $\scriptstyle x > 0$
      const unescaped = contentStr
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')

      // 5. 预处理 Markdown 标题（容错：允许标题标记不在行首时自动换行）
      const preprocessedMarkdown = preprocessMarkdownHeadings(unescaped)

      // 6. 预处理LaTeX公式格式
      const processedContent = preprocessLatexFormats(preprocessedMarkdown)

      // 7. 执行Markdown渲染
      const rendered = md.render(processedContent)

      // 8. 后处理渲染结果（清理多余的换行符）
      const trimmedRendered = rendered.replace(/\n+$/, '')

      // 核心日志：记录原始内容和渲染结果
      console.log('[useMessageRenderer] 题目渲染:', {
        原始内容: contentStr,
        渲染结果: trimmedRendered,
        包含公式: trimmedRendered.includes('mjx-container') || trimmedRendered.includes('mjx-chtml')
      })

      // 9. 管理缓存
      manageCache(contentStr, trimmedRendered)

      return trimmedRendered
    } catch {
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
      maxSize: MAX_CACHE_SIZE,
    }
  }

  return {
    renderMessageContent,
    clearRenderCache,
    getCacheStats,
  }
}
