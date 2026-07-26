// @ts-ignore
import MarkdownIt from 'markdown-it'
// @ts-ignore
import katex from 'katex'
// @ts-ignore
import markdownItKatex from 'markdown-it-katex'

// 初始化 markdown-it 实例并挂载 markdown-it-katex 插件（适配 UniApp rich-text HTML 标签与 katex.min.css 渲染）
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false, // 完全禁用typographer功能，防止 (C) -> 等字符转换
  breaks: true, // 将换行符转换为 <br> 标签
}).use(markdownItKatex, { katex, throwOnError: false })

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
   * 包含 imates-web 所有规范化规则及 UniApp 特有的 TeX 命令自动容错补齐
   */
  const preprocessLatexFormats = (contentStr: string): string => {
    let processedContent = contentStr

    // 0. 自动为紧跟数字/字母的 TeX 命令补齐空格（例如 \geq0 -> \geq 0, \pm1 -> \pm 1）
    processedContent = processedContent.replace(
      /\\(geq|leq|pm|lvert|rvert|times|div|alpha|beta|theta|infty|frac|sqrt)([0-9a-zA-Z])/g,
      '\\$1 $2'
    )

    // 1. 合并“孤立 $ 块”为块级公式：
    //    形如：
    //    $\n ... \n$
    //    或：$  \n ... \n  $
    //    统一转换为：\n\n$$...$$\n\n
    const lonelyDollarBlockRegex = /(^|\n)\s*\$(?:\s*)\n([\s\S]*?)\n\s*\$\s*(?=\n|$)/g
    processedContent = processedContent.replace(lonelyDollarBlockRegex, (_m, prefix, content) => {
      const trimmed = String(content ?? '').trim()
      return `${prefix}\n\n$$${trimmed}$$\n\n`
    })

    // 2. 处理MathLive输出格式 - 检测MathLive的数学模式标记
    const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs
    processedContent = processedContent.replace(mathLiveRegex, '$$$1$$')

    // 3. 处理分段函数 - 将包含array环境的行内公式转换为块级公式
    const piecewiseFunctionRegex = /\\\(([^)]*\\begin\{array\}[^)]*\\end\{array\}[^)]*)\\\)/gs
    processedContent = processedContent.replace(piecewiseFunctionRegex, (_match, content) => {
      return `$$${content}$$`
    })

    // 4. 处理其他复杂公式 - 包含多行或复杂结构的行内公式
    const complexFormulaRegex = /\\\(([^)]*\\begin\{[^}]*\}[^)]*\\end\{[^}]*\}[^)]*)\\\)/gs
    processedContent = processedContent.replace(complexFormulaRegex, (_match, content) => {
      return `$$${content}$$`
    })

    // 5. 处理行内公式 \(...\) 格式，转换为 $...$ 格式
    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/gs
    processedContent = processedContent.replace(inlineRegex, '$$$1$')

    // 6. 处理块级公式 \[...\] 格式
    const displayRegex = /\\\[(.*?)\\\]/gs
    processedContent = processedContent.replace(displayRegex, (_match, content) => {
      const trimmed = String(content ?? '').trim()
      return `\n\n$$${trimmed}$$\n\n`
    })

    // 7. 处理MathLive的AsciiMath格式（如果存在）
    const asciiMathRegex = /\`(.*?)\`/gs
    processedContent = processedContent.replace(asciiMathRegex, '$$$1$$')

    // 8. 处理MathLive的MathML格式（转换为LaTeX）
    const mathMLRegex = /<math[^>]*>(.*?)<\/math>/gs
    processedContent = processedContent.replace(mathMLRegex, (_match, content) => {
      return `$$${content}$$`
    })

    // 9. 自动识别未包裹 $ 但包含 TeX 符号（如 \lvert, \rvert, \leq, \pm, \frac）的完整公式片段并补齐 $ 包裹
    processedContent = processedContent.replace(
      /(?<!\$)\b([a-zA-Z0-9_\s()=><+\-*\/^.|,]+(?:\\(?:lvert|rvert|leq|geq|pm|frac|sqrt|alpha|beta|theta|infty|times|div)[a-zA-Z0-9_\s()=><+\-*\/^.|,]*)+)(?!\$)/g,
      (_match, body) => {
        return `$${body.trim()}$`
      }
    )

    return processedContent
  }

  /**
   * 管理缓存
   * 在缓存满时清理最旧的条目，然后缓存新结果
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
      const unescaped = contentStr
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')

      // 5. 预处理 Markdown 标题（容错：允许标题标记不在行首时自动换行）
      const preprocessedMarkdown = preprocessMarkdownHeadings(unescaped)
        .split('\n')
        .map((line) => {
          if (/^\s*<[a-zA-Z]/.test(line)) {
            return line.trimStart()
          }
          return line
        })
        .join('\n')

      // 6. 预处理LaTeX公式格式
      const processedContent = preprocessLatexFormats(preprocessedMarkdown)

      // 7. 执行Markdown + KaTeX 渲染（生成 UniApp <rich-text> 兼容的 HTML 节点）
      const rendered = md.render(processedContent)

      // 8. 后处理渲染结果（清理多余的换行符）
      const trimmedRendered = rendered.replace(/\n+$/, '')

      // 9. 管理缓存
      manageCache(contentStr, trimmedRendered)

      return trimmedRendered
    } catch {
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
