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
   * 将 \(...\)、\[...\]、MathLive 模式、孤立 $ 块统一转换规范化
   */
  const preprocessLatexFormats = (contentStr: string): string => {
    let processedContent = contentStr

    // 0. 合并“孤立 $ 块”为块级公式：\n\n$$...$$\n\n
    const lonelyDollarBlockRegex = /(^|\n)\s*\$(?:\s*)\n([\s\S]*?)\n\s*\$\s*(?=\n|$)/g
    processedContent = processedContent.replace(lonelyDollarBlockRegex, (_m, prefix, content) => {
      const trimmed = String(content ?? '').trim()
      return `${prefix}\n\n$$${trimmed}$$\n\n`
    })

    // 1. 处理 MathLive 输出格式
    const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs
    processedContent = processedContent.replace(mathLiveRegex, (_m, c) => `$$${c}$$`)

    // 2. 处理分段函数包含 array 环境的行内公式为块级公式
    const piecewiseFunctionRegex = /\\\(([^)]*\\begin\{array\}[^)]*\\end\{array\}[^)]*)\\\)/gs
    processedContent = processedContent.replace(piecewiseFunctionRegex, (_m, content) => {
      return `$$${content}$$`
    })

    // 3. 处理复杂多行环境的行内公式为块级公式
    const complexFormulaRegex = /\\\(([^)]*\\begin\{[^}]*\}[^)]*\\end\{[^}]*\}[^)]*)\\\)/gs
    processedContent = processedContent.replace(complexFormulaRegex, (_m, content) => {
      return `$$${content}$$`
    })

    // 4. 处理行内公式 \(...\) 格式，转换为 $...$ 格式（避免字符串替换 $$ 脱敏成 $$formula$）
    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/gs
    processedContent = processedContent.replace(inlineRegex, (_m, c) => `$${c}$`)

    // 5. 处理块级公式 \[...\] 格式
    const displayRegex = /\\\[(.*?)\\\]/gs
    processedContent = processedContent.replace(displayRegex, (_m, content) => {
      const trimmed = String(content ?? '').trim()
      return `\n\n$$${trimmed}$$\n\n`
    })

    // 6. 处理 MathML 格式（转换为 LaTeX）
    const mathMLRegex = /<math[^>]*>(.*?)<\/math>/gs
    processedContent = processedContent.replace(mathMLRegex, (_m, content) => {
      return `$$${content}$$`
    })

    return processedContent
  }

  /**
   * 管理缓存
   */
  const manageCache = (contentStr: string, result: string): void => {
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value
      if (firstKey !== undefined) {
        renderCache.delete(firstKey)
      }
    }
    renderCache.set(contentStr, result)
  }

  /**
   * 渲染消息内容
   */
  const renderMessageContent = (content: unknown): string => {
    try {
      const contentStr = typeof content === 'string' ? content : String(content || '')

      if (renderCache.has(contentStr)) {
        return renderCache.get(contentStr)!
      }

      if (!contentStr.trim()) {
        return contentStr
      }

      // 4. 先反转义常见 HTML 实体
      const unescaped = contentStr
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')

      // 5. 预处理 Markdown 标题
      const preprocessedMarkdown = preprocessMarkdownHeadings(unescaped)
        .split('\n')
        .map(line => {
          if (/^\s*<[a-zA-Z]/.test(line)) {
            return line.trimStart()
          }
          return line
        })
        .join('\n')

      // 6. 预处理 LaTeX 公式格式
      const processedContent = preprocessLatexFormats(preprocessedMarkdown)

      // 7. 执行 Markdown + MathJax3 渲染
      const rendered = md.render(processedContent)

      // 8. 后处理渲染结果
      const trimmedRendered = rendered.replace(/\n+$/, '')

      // 9. 管理缓存
      manageCache(contentStr, trimmedRendered)

      return trimmedRendered
    } catch {
      return typeof content === 'string' ? content : String(content || '')
    }
  }

  const clearRenderCache = () => {
    renderCache.clear()
  }

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
