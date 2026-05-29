import React, { useMemo } from 'react'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import '@/components/display/MarkdownTitle.css'

export interface MarkdownTitleProps {
  title?: string
}

export const MarkdownTitle: React.FC<MarkdownTitleProps> = ({
  title = '',
}) => {
  const { renderMessageContent } = useMessageRenderer()

  const truncateTitle = (text: string): string => {
    const maxLength = 20
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const renderedTitle = useMemo(() => {
    const content = title || '新会话'
    const truncated = truncateTitle(content)
    const rendered = renderMessageContent(truncated)
    return `<strong>${rendered}</strong>`
  }, [title, renderMessageContent])

  return (
    <div className="title-wrapper">
      <div 
        className="card-title markdown-title" 
        dangerouslySetInnerHTML={{ __html: renderedTitle }} 
      />
    </div>
  )
}

export default MarkdownTitle
