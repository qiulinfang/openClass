import { useCallback, useMemo } from 'react'
import MarkdownIt from 'markdown-it'
// @ts-ignore
import mathjax3 from 'markdown-it-mathjax3'

// 初始化 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: true,
}).use(mathjax3)

export function useMessageRenderer() {
  // 渲染缓存，避免重复渲染相同内容
  const renderCache = useMemo(() => new Map<string, string>(), [])
  const MAX_CACHE_SIZE = 100

  const preprocessMarkdownHeadings = useCallback((contentStr: string): string => {
    const parts = contentStr.split(/(```[\s\S]*?```)/g)
    return parts
      .map((part) => {
        if (part.startsWith('```')) return part
        return part.replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n$2')
      })
      .join('')
  }, [])

  const preprocessLatexFormats = useCallback((contentStr: string): string => {
    let processedContent = contentStr

    const lonelyDollarBlockRegex = /(^|\n)\s*\$(?:\s*)\n([\s\S]*?)\n\s*\$\s*(?=\n|$)/g
    processedContent = processedContent.replace(lonelyDollarBlockRegex, (_m, prefix, content) => {
      const trimmed = String(content ?? '').trim()
      return `${prefix}\n\n$$${trimmed}$$\n\n`
    })

    const mathLiveRegex = /\\begin\{math\}(.*?)\\end\{math\}/gs
    processedContent = processedContent.replace(mathLiveRegex, '$$$1$$')

    const piecewiseFunctionRegex = /\\\(([^)]*\\begin\{array\}[^)]*\\end\{array\}[^)]*)\\\)/gs
    processedContent = processedContent.replace(piecewiseFunctionRegex, (match, content) => {
      return `$$${content}$$`
    })

    const complexFormulaRegex = /\\\(([^)]*\\begin\{[^}]*\}[^)]*\\end\{[^}]*\}[^)]*)\\\)/gs
    processedContent = processedContent.replace(complexFormulaRegex, (match, content) => {
      return `$$${content}$$`
    })

    const inlineRegex = /\\\(\s*(.*?)\s*\\\)/gs
    processedContent = processedContent.replace(inlineRegex, '$$$1$')

    const displayRegex = /\\\[(.*?)\\\]/gs
    processedContent = processedContent.replace(displayRegex, (_match, content) => {
      const trimmed = String(content ?? '').trim()
      return `\n\n$$${trimmed}$$\n\n`
    })

    const asciiMathRegex = /\`(.*?)\`/gs
    processedContent = processedContent.replace(asciiMathRegex, '$$$1$$')

    const mathMLRegex = /<math[^>]*>(.*?)<\/math>/gs
    processedContent = processedContent.replace(mathMLRegex, (match, content) => {
      return `$$${content}$$`
    })

    return processedContent
  }, [])

  const renderMessageContent = useCallback((content: unknown): string => {
    try {
      const contentStr = typeof content === 'string' ? content : String(content || '')
      if (renderCache.has(contentStr)) {
        return renderCache.get(contentStr)!
      }
      if (!contentStr.trim()) {
        return contentStr
      }

      const unescaped = contentStr
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')

      const preprocessedMarkdown = preprocessMarkdownHeadings(unescaped)
        .split('\n')
        .map(line => {
          if (/^\s*<[a-zA-Z]/.test(line)) {
            return line.trimStart()
          }
          return line
        })
        .join('\n')

      const processedContent = preprocessLatexFormats(preprocessedMarkdown)
      const rendered = md.render(processedContent)
      const trimmedRendered = rendered.replace(/\n+$/, '')

      if (renderCache.size >= MAX_CACHE_SIZE) {
        const firstKey = renderCache.keys().next().value
        if (firstKey !== undefined) renderCache.delete(firstKey)
      }
      renderCache.set(contentStr, trimmedRendered)

      return trimmedRendered
    } catch {
      return typeof content === 'string' ? content : String(content || '')
    }
  }, [preprocessMarkdownHeadings, preprocessLatexFormats, renderCache])

  const clearRenderCache = useCallback(() => {
    renderCache.clear()
  }, [renderCache])

  return {
    renderMessageContent,
    clearRenderCache,
  }
}
