import React, { useEffect, useState } from 'react'
import '@/components/chat/message/StreamingMessage.css'

export interface StreamingMessageProps {
  content?: string
  isComplete?: boolean
  isUser?: boolean
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content = '',
  isComplete = false,
  isUser = false,
}) => {
  const [displayContent, setDisplayContent] = useState('')

  useEffect(() => {
    setDisplayContent(content)
  }, [content])

  return (
    <div className={`streaming-message ${isUser ? 'streaming-user' : ''}`}>
      <div className="message-content">
        {displayContent}
        {!isComplete && <span className="cursor">▊</span>}
      </div>
    </div>
  )
}

export default StreamingMessage
