import React, { useMemo, useRef, useEffect } from 'react'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import Loading from '@/components/base/Loading'
import generateImgGif from '/icons/generateImg.webp'
import '@/components/chat/message/StreamingMessage.css'

export interface StreamingMessageProps {
  content: string
  isStreaming?: boolean
  messageType?: 'text' | 'html'
  rawHtmlMap?: Record<string, [string, string?]>
  onReloadHtmlImage?: (url: string) => void
  onOpenHtmlPreview?: (payload: { url: string; html?: string }) => void
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  isStreaming = false,
  messageType = 'text',
  rawHtmlMap = {},
  onReloadHtmlImage,
  onOpenHtmlPreview,
}) => {
  const { renderMessageContent } = useMessageRenderer()
  const contentRef = useRef<HTMLDivElement>(null)

  const displayedContent = useMemo(() => {
    if (messageType === 'html') {
      const filteredContent = content.replace(/(`?!\[\]\()?\s*https:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html\s*(\)`?)?.*?(\n|$)/gi, '')
      return renderMessageContent(filteredContent.trim())
    }
    return renderMessageContent(content)
  }, [content, messageType, renderMessageContent])

  const htmlSegments = useMemo(() => {
    if (messageType !== 'html') return []
    const regex = /(`?!\[\]\()?(\s*https:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html\s*)(\)`?)?/gi
    const segments: any[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(content)) !== null) {
      const url = match[2].trim()
      const start = match.index

      if (start > lastIndex) {
        const textPart = content.slice(lastIndex, start)
        if (textPart) {
          segments.push({
            key: `t-${lastIndex}-${start}`,
            type: 'text',
            rendered: renderMessageContent(textPart),
          })
        }
      }

      segments.push({
        key: `l-${start}-${regex.lastIndex}`,
        type: 'link',
        url,
        rawHtml: rawHtmlMap[url]?.[0] || '',
      })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < content.length) {
      const textPart = content.slice(lastIndex)
      if (textPart) {
        segments.push({
          key: `t-${lastIndex}-end`,
          type: 'text',
          rendered: renderMessageContent(textPart),
        })
      }
    }
    return segments
  }, [content, messageType, rawHtmlMap, renderMessageContent])

  const openHtmlDialog = (url: string) => {
    if (!url) return
    const cachedHtml = rawHtmlMap[url]?.[0]
    onOpenHtmlPreview?.({ url, html: cachedHtml })
  }

  // 处理 Markdown 渲染出的图片和公式 (模拟 Vue 的 setStreamingContentRef)
  useEffect(() => {
    if (contentRef.current) {
      // 可以在这里调用 MathJax 渲染，如果 useMessageRenderer 没处理的话
      // 以及处理图片类名等
      const allImages = contentRef.current.querySelectorAll('img')
      allImages.forEach((img) => {
        if (!img.classList.contains('markdown-image')) {
          img.classList.add('markdown-image')
        }
      })
    }
  }, [displayedContent, htmlSegments])

  return (
    <div className="streaming-message">
      <div className="message-content" ref={contentRef}>
        {isStreaming && (messageType === 'html' || !content) ? (
          <div
            className="skeleton-card"
            style={{ backgroundImage: `url(${generateImgGif})` }}
          />
        ) : isStreaming ? (
          <div className="streaming-content">
            <span dangerouslySetInnerHTML={{ __html: displayedContent }} />
            <span className="typing-cursor">|</span>
          </div>
        ) : messageType === 'html' ? (
          <div className="html-message-container">
            {htmlSegments.map((seg) => (
              <div key={seg.key} className="html-segment-wrapper">
                {seg.type === 'text' ? (
                  <div className="html-text-segment">
                    <span dangerouslySetInnerHTML={{ __html: seg.rendered }} />
                  </div>
                ) : (
                  <div
                    className="html-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => openHtmlDialog(seg.url)}
                  >
                    <div className="html-card-content">
                      {seg.url && rawHtmlMap[seg.url]?.[1] ? (
                        <img
                          src={rawHtmlMap[seg.url]?.[1]}
                          alt="HTML预览"
                          className="html-card-img"
                        />
                      ) : (
                        <Loading text="加载中..." size={24} className="html-card-loading-wrapper" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="typewriter-content">
            <span dangerouslySetInnerHTML={{ __html: displayedContent }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StreamingMessage
