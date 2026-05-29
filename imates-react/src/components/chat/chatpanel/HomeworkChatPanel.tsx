import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useNavigate } from 'react-router-dom'
import { CHAT_TAB_OPTIONS } from '@/constants/options'
import { useAiHomeworkChatStore } from '@/stores/aiHomeworkChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { useScreenSnapshot } from '@/hooks/useScreenSnapshot'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { showMessage } from '@/utils'
import type { ExerciseItem, AiHomeworkSession } from '@/types'
import type { BuiltinToolType } from '@/types/toolbarTools'
import ChatView from '@/components/ChatView'
import CardStack, { CardStackCard } from '@/components/base/CardStack'
import MarkdownTitle from '@/components/display/MarkdownTitle'
import Button from '@/components/base/Button'
import Dialog from '@/components/base/Dialog'
import goBackBlackIcon from '/icons/goback_black.svg'
import newSessionIcon from '/icons/new.svg'
import deleteSessionIcon from '/icons/delete.svg'
import '@/components/chat/chatpanel/HomeworkChatPanel.css'

export interface HomeworkChatPanelProps {
  question?: ExerciseItem | null
  showCloseButton?: boolean
  visible?: boolean
  onClose?: () => void
  onScrollToBottom?: () => void
  onOpenTeacherDialog?: (data: { sessionId: string; message?: any }) => void
  onSwitchToTeacher?: (data: any) => void
  onPasteToDraft?: (payload: any) => void
  onAddSession?: () => void
}

export const HomeworkChatPanel = forwardRef<any, HomeworkChatPanelProps>(({
  question,
  showCloseButton = true,
  visible = false,
  onClose,
  onScrollToBottom,
  onOpenTeacherDialog,
  onSwitchToTeacher,
  onPasteToDraft,
  onAddSession,
}, ref) => {
  const aiHomeworkStore = useAiHomeworkChatStore()
  const draftStore = useDraftStore()
  const navigate = useNavigate()
  const { captureScreenSnapshot } = useScreenSnapshot()
  const { renderMessageContent } = useMessageRenderer()

  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(undefined)
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)

  const chatViewRef = useRef<any>(null)

  const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>
  const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

  useImperativeHandle(ref, () => ({
    sendQuestion: (q: ExerciseItem) => {
      if (chatViewRef.current?.sendMessage) {
        // 实现发送题目的逻辑，可以先设置输入框内容或直接调用 store
        const content = q.question || q.title || ''
        chatViewRef.current.sendMessage(content)
      }
    }
  }))

  useEffect(() => {
    if (question?.bmNo) {
      aiHomeworkStore.setQuestionContext(question.bmNo)
    }
  }, [question?.bmNo, aiHomeworkStore])

  const handleOpenTeacherDialog = ({ sessionId }: { sessionId: string; message?: any }) => {
    onOpenTeacherDialog?.({ sessionId })
  }

  const handleSwitchToTeacher = (forwardData: any) => {
    if (forwardData.sessionId) {
      onSwitchToTeacher?.(forwardData)
    }
  }

  const handleSuggestionSendMessage = (suggestion: string) => {
    if (chatViewRef.current) {
      const chatView = chatViewRef.current as any
      chatView.setInputMessage?.(suggestion)
      chatView.sendMessage?.(suggestion)
    }
  }

  const filteredSessions = useMemo(() => {
    const sourceSessions = aiHomeworkStore.sessions || []
    if (!aiHomeworkStore.currentQuestionId) return sourceSessions
    return sourceSessions.filter(s => s.metadata?.questionBmNo === aiHomeworkStore.currentQuestionId)
  }, [aiHomeworkStore.sessions, aiHomeworkStore.currentQuestionId])

  const sessionCards = useMemo((): CardStackCard[] => {
    return filteredSessions.map((session: AiHomeworkSession, index: number) => ({
      id: session.sessionId,
      title: `会话 ${index + 1}`,
      updateTime: session.updateTime,
      previewMessagesMarkdown: (session as any).previewMessagesMarkdown || [],
    }))
  }, [filteredSessions])

  const hasAiSessions = filteredSessions.length > 0

  const handleSessionCardClick = async (sessionId: string) => {
    if (!sessionId) return
    setSelectedRecordId(sessionId)
    setActiveTab('ai-chat')
    await aiHomeworkStore.switchSession(sessionId)
    setTimeout(() => {
      chatViewRef.current?.scrollToSession?.(sessionId)
    }, 100)
  }

  const handleDeleteSessionRequest = async (sessionId: string | number) => {
    const sid = sessionId.toString()
    await aiHomeworkStore.deleteSession(sid)
    if (selectedRecordId === sid) setSelectedRecordId(undefined)
  }

  const handleScreenshotClick = async () => {
    try {
      const { dataUrl, width, height } = await captureScreenSnapshot()
      if (!dataUrl) return
      const imageInfo = {
        filePath: '',
        width: width || 0,
        height: height || 0,
        fileSize: Math.round(dataUrl.length * 0.75),
        base64DataUrl: dataUrl,
      }
      await chatViewRef.current?.onImageSelected?.(imageInfo)
    } catch (error) {
      console.error('截图失败:', error)
    }
  }

  const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
    if (payload?.kind !== 'screen_snapshot') return
    handleScreenshotClick()
  }

  const handleAddSessionClick = async () => {
    aiHomeworkStore.resetState(false)
    setActiveTab('ai-chat')
    onAddSession?.()
  }

  const confirmClearAllSessions = async () => {
    try {
      const sessionIds = filteredSessions.map((s: any) => s.sessionId)
      for (const id of sessionIds) {
        await aiHomeworkStore.deleteSession(id)
      }
      showMessage('会话已清除', 'success')
      setShowClearAllDialog(false)
    } catch (error) {
      showMessage('清除会话失败', 'error')
    }
  }

  const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
    const { url, html } = payload
    if (!url) return
    const currentSessionId = aiHomeworkStore.currentSession?.sessionId
    if (html) sessionStorage.setItem('htmlPreview_inlineContent', html)
    onClose?.()
    navigate(`/html-preview?url=${encodeURIComponent(url)}&sessionId=${currentSessionId || ''}&reopenPanel=homework`)
  }

  if (!visible) return null

  return (
    <div className="chat-panel-container">
      <div className="chat-panel-header">
        <div className="chat-tabs">
          <div className="tab-list">
            {tabOptions.map((tab) => (
              <div
                key={tab.value}
                className={`tab-item ${activeTab === tab.value ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(tab.value as any)}
              >
                <span>{tab.label}</span>
              </div>
            ))}
          </div>
        </div>
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
            type="ai-homework"
            compressedHeight={360}
            question={question}
            toolbarTools={toolbarToolNames}
            onScrollToBottom={onScrollToBottom}
            onSendMessage={handleSuggestionSendMessage}
            onOpenTeacherDialog={handleOpenTeacherDialog}
            onSwitchToTeacher={handleSwitchToTeacher}
            onPasteToDraft={onPasteToDraft}
            onScreenshotClick={handleScreenshotClick}
            onRequestScreenshot={handleRequestScreenshot}
            onNewSessionClick={handleAddSessionClick}
            onOpenHtmlPreview={handleOpenHtmlPreview}
          />
        </div>
        <div style={{ display: activeTab === 'question-record' ? 'flex' : 'none' }} className="tab-content question-record-content">
          <div className="session-card-wrapper">
            <CardStack
              value={sessionCards}
              emptyText="暂无会话记录"
              onCardClick={(c) => handleSessionCardClick(c.id.toString())}
              onCardRemove={handleDeleteSessionRequest}
              renderTitle={(card) => <MarkdownTitle title={card.title} />}
              renderCardBody={(card) => (
                <div className="chat-snapshot">
                  <div className="snapshot-messages">
                    {card.previewMessagesMarkdown && card.previewMessagesMarkdown.length > 0 ? (
                      card.previewMessagesMarkdown.map((content: string, idx: number) => (
                        <div
                          key={idx}
                          className={`snapshot-bubble ${idx % 2 === 0 ? 'user' : 'ai'}`}
                        >
                          <div
                            className="bubble-text markdown-content"
                            dangerouslySetInnerHTML={{ __html: renderMessageContent(content) }}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="snapshot-empty">
                        <span>点击开始对话</span>
                      </div>
                    )}
                  </div>
                  <div className="snapshot-fade"></div>
                </div>
              )}
            />
          </div>
          <div className="session-bottom-bar">
            <Button label="返回" icon={goBackBlackIcon} variant="ghost" onClick={() => setActiveTab('ai-chat')} />
            <Button label="新建" icon={newSessionIcon} variant="ghost" onClick={handleAddSessionClick} />
            <Button label="清除会话" icon={deleteSessionIcon} variant="ghost" disabled={!hasAiSessions} onClick={() => setShowClearAllDialog(true)} />
          </div>
        </div>
      </div>

      <Dialog
        open={showClearAllDialog}
        title="清除确认"
        confirmButtonText="清除"
        onConfirm={confirmClearAllSessions}
        onCancel={() => setShowClearAllDialog(false)}
      >
        确定要清除所有通用会话吗？此操作不可撤销。
      </Dialog>
    </div>
  )
})

export default HomeworkChatPanel
