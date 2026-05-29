import React, { useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import ChatView from '@/components/ChatView'
import Button from '@/components/base/Button'
import type { BuiltinToolType } from '@/types/toolbarTools'
import '@/components/chat/chatpanel/HtmlChatPanel.css'

export interface HtmlChatPanelProps {
  visible?: boolean
  showCloseButton?: boolean
  onClose?: () => void
  onScreenshotClick?: () => void
  onRequestScreenshot?: (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => void
}

export const HtmlChatPanel = forwardRef<any, HtmlChatPanelProps>(({
  visible = false,
  showCloseButton = true,
  onClose,
  onScreenshotClick,
  onRequestScreenshot,
}, ref) => {
  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const chatViewRef = useRef<any>(null)

  const tabOptions = useMemo(() => [
    { label: 'AI 问答', value: 'ai-chat' as const },
  ], [])

  const toolbarToolNames: BuiltinToolType[] = ['screenshot']

  useImperativeHandle(ref, () => ({
    onImageSelected: (imageInfo: any) => {
      chatViewRef.current?.onImageSelected?.(imageInfo)
    }
  }))

  if (!visible) return null

  return (
    <div className="html-chat-panel">
      <div className="chat-panel-header">
        <div className="header-title">AI 问答</div>
        {showCloseButton && (
          <Button
            variant="ghost"
            size="sm"
            icon="/icons/close.svg"
            onClick={onClose}
            className="close-button"
          />
        )}
      </div>

      <div className="chat-content-container">
        <div style={{ display: activeTab === 'ai-chat' ? 'flex' : 'none' }} className="tab-content">
          <ChatView
            ref={chatViewRef}
            type="html-preview"
            compressedHeight={360}
            toolbarTools={toolbarToolNames}
            hideHistory={true}
            onScreenshotClick={onScreenshotClick}
            onRequestScreenshot={onRequestScreenshot}
          />
        </div>
        <div style={{ display: activeTab === 'question-record' ? 'flex' : 'none' }} className="tab-content">
          <div className="session-card-wrapper">
            <div className="snapshot-empty">暂无会话记录</div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default HtmlChatPanel
