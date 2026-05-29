import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import ChatView from '@/components/ChatView'
import CardStack, { CardStackCard } from '@/components/base/CardStack'
import MarkdownTitle from '@/components/display/MarkdownTitle'
import Button from '@/components/base/Button'
import Dialog from '@/components/base/Dialog'
import { showMessage } from '@/utils'
import type { ExerciseItem } from '@/types'
import '@/components/chat/chatpanel/ExerciseChatPanelNew.css'

// 图标资源
import goBackBlackIcon from '/icons/goback_black.svg'
import newSessionIcon from '/icons/new.svg'
import deleteSessionIcon from '/icons/delete.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord.svg'

export interface ExerciseChatPanelNewProps {
  question?: ExerciseItem | null
  visible?: boolean
  onClose?: () => void
  onScrollToBottom?: () => void
  onSendMessage?: (message: string) => void
  onOpenTeacherDialog?: (data: { sessionId: string }) => void
  onSwitchToTeacher?: (data: any) => void
  onPasteToDraft?: (payload: any) => void
  onAddSession?: () => void
  onRequestScreenshot?: (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => void
  onScreenshotClick?: (active: boolean) => void
  onOpenHtmlPreview?: (payload: { url: string; html?: string; sessionId?: string | null }) => void
  isExploring?: boolean
  isCapturing?: boolean
}

export const ExerciseChatPanelNew = forwardRef<any, ExerciseChatPanelNewProps>(({
  question,
  visible = false,
  onClose,
  onScrollToBottom,
  onSendMessage,
  onAddSession,
  onSwitchToTeacher,
  onScreenshotClick,
  isExploring = false,
}, ref) => {
  const aiExerciseStore = useAiExerciseChatStore()
  const draftStore = useDraftStore()
  const { renderMessageContent } = useMessageRenderer()
  
  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)
  const chatViewRef = useRef<any>(null)

  const tabOptions = [
    { label: 'AI 问答', value: 'ai-chat' },
    { label: '会话记录', value: 'question-record' }
  ]

  const hasAiSessions = useMemo(() => {
    return Array.isArray(aiExerciseStore.sessions) && aiExerciseStore.sessions.length > 0
  }, [aiExerciseStore.sessions])

  const sessionCards = useMemo((): CardStackCard[] => {
    const sourceSessions = aiExerciseStore.sessions || []
    return sourceSessions.map((session: any, index: number) => ({
      id: (session.id || session.sessionId).toString(),
      title: `会话 ${index + 1}`,
      updateTime: session.updatedAt || session.updateTime,
      previewMessagesMarkdown: session.previewMessagesMarkdown || [],
    }))
  }, [aiExerciseStore.sessions])

  // --- 暴露方法 ---
  useImperativeHandle(ref, () => ({
    switchToAiChat: () => setActiveTab('ai-chat'),
    switchToSessionRecord: () => setActiveTab('question-record'),
    getActiveTab: () => activeTab,
    getChatViewRef: () => chatViewRef.current,
    scrollToSession: (sessionId: string) => chatViewRef.current?.scrollToSession?.(sessionId),
  }))

  // --- 逻辑处理 ---

  const handleSessionCardClick = async (card: CardStackCard) => {
    const sessionId = card.id.toString()
    if (!sessionId) return
    setActiveTab('ai-chat')
    await aiExerciseStore.switchToSession(sessionId)
    setTimeout(() => {
      chatViewRef.current?.scrollToSession?.(sessionId)
    }, 100)
  }

  const handleDeleteSessionRequest = async (id: string | number) => {
    const sessionId = id.toString()
    if (!sessionId) return
    const questionBmNo = (question?.bmNo || question?.id || '').toString()
    if (!questionBmNo) return

    const sessions = aiExerciseStore.sessions || []
    const isLastSession = sessions.length === 1

    // 删除草稿
    const draftKey = `${questionBmNo}::${sessionId}`
    try {
      await draftStore.deleteDraft(draftKey)
    } catch (e) {
      console.warn('[草稿链路] 删除会话草稿失败:', e)
    }

    if (isLastSession) {
      try {
        await draftStore.deleteDraft(`${questionBmNo}::default`)
      } catch (e) {
        console.warn('[草稿链路] 删除默认草稿失败:', e)
      }
    }

    // 假设 store 有 deleteSession 方法，根据 Vue 代码判断
    if ((aiExerciseStore as any).deleteSession) {
       await (aiExerciseStore as any).deleteSession(sessionId, questionBmNo)
    }
  }

  const handleClearAllSessionsClick = () => {
    if (hasAiSessions) {
      setShowClearAllDialog(true)
    }
  }

  const confirmClearAllSessions = async () => {
    try {
      const questionBmNo = (question?.bmNo || question?.id || '').toString()
      if (!questionBmNo) return

      const sessionIds = aiExerciseStore.sessions.map((s: any) => s.id || s.sessionId)
      const draftKeys = sessionIds.map((sid: string) => `${questionBmNo}::${sid}`)
      draftKeys.push(`${questionBmNo}::default`)

      await draftStore.deleteDrafts(draftKeys)
      
      for (const sid of sessionIds) {
        if ((aiExerciseStore as any).deleteSession) {
           await (aiExerciseStore as any).deleteSession(sid, questionBmNo)
        }
      }

      showMessage('会话已清除', 'success')
      setShowClearAllDialog(false)
    } catch (error) {
      console.error('清除会话失败:', error)
      showMessage('清除会话失败', 'error')
    }
  }

  const handleAddSessionClick = async () => {
    const questionBmNo = (question?.bmNo || question?.id || '').toString()
    if (questionBmNo) {
      await aiExerciseStore.createNewSession(questionBmNo)
      setActiveTab('ai-chat')
      onAddSession?.()
    }
  }

  if (!visible) return null

  return (
    <div className="chat-panel-container">
      {/* 探索遮罩 */}
      {isExploring && activeTab === 'ai-chat' && (
        <div className="explore-overlay">
          <img src={textbookipIcon} alt="textbookip" className="explore-icon textbookip" />
          <img src={ipWordIcon} alt="ipWord" className="explore-icon ipWord" />
        </div>
      )}

      {/* 对话面板头部 */}
      <div className="chat-panel-header">
        <div className="chat-tabs">
          <div className="tab-list">
            {tabOptions.map(tab => (
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
        {onClose && (
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Tab 内容区域 */}
      <div className="chat-content-container">
        {activeTab === 'ai-chat' ? (
          <div className="tab-content">
            <ChatView
              ref={chatViewRef}
              type="ai-exercise"
              question={question}
              onScrollToBottom={onScrollToBottom}
              onSendMessage={onSendMessage}
              onSwitchToTeacher={onSwitchToTeacher}
              onScreenshotClick={() => onScreenshotClick?.(true)}
              onNewSessionClick={handleAddSessionClick}
            />
          </div>
        ) : (
          <div className="tab-content question-record-content">
            <div className="session-card-wrapper">
              <CardStack
                value={sessionCards}
                emptyText="暂无会话记录"
                onCardClick={handleSessionCardClick}
                onCardRemove={handleDeleteSessionRequest}
                renderTitle={(card: CardStackCard) => <MarkdownTitle title={card.title} />}
                renderCardBody={(card: CardStackCard) => (
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
            {/* 底部操作条 */}
            <div className="session-bottom-bar">
              <Button
                label="返回"
                icon={goBackBlackIcon}
                variant="ghost"
                onClick={() => setActiveTab('ai-chat')}
              />
              <Button
                label="新建"
                icon={newSessionIcon}
                variant="ghost"
                onClick={handleAddSessionClick}
              />
              <Button
                label="清除会话"
                icon={deleteSessionIcon}
                variant="ghost"
                disabled={!hasAiSessions}
                onClick={handleClearAllSessionsClick}
              />
            </div>
          </div>
        )}
      </div>

      {/* 清除会话确认对话框 */}
      <Dialog
        open={showClearAllDialog}
        title="清除确认"
        confirmButtonText="清除"
        cancelButtonText="取消"
        onConfirm={confirmClearAllSessions}
        onCancel={() => setShowClearAllDialog(false)}
      >
        确定要清除当前题目的所有会话吗？此操作不可撤销。
      </Dialog>
    </div>
  )
})

ExerciseChatPanelNew.displayName = 'ExerciseChatPanelNew'

export default ExerciseChatPanelNew
