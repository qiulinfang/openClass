import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CHAT_TAB_OPTIONS } from '@/constants/options'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { showMessage } from '@/utils'
import { useScreenSnapshot } from '@/hooks/useScreenSnapshot'
import SessionTree from '@/components/chat/session/SessionTree'
import ChatView from '@/components/ChatView'
import Button from '@/components/base/Button'
import selectAndAskIcon from '/icons/selectAndAsk.svg'
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord.svg'
import type { ChatBubble } from '@/types/chat'
import type { BuiltinToolType } from '@/types/toolbarTools'
import '@/components/chat/chatpanel/DraftNoteChatPanel.css'

export interface DraftNoteChatPanelProps {
  visible?: boolean
  showCloseButton?: boolean
  isExploring?: boolean
  isCapturing?: boolean
  onClose?: () => void
  onScreenshotClick?: (active: boolean) => void
  onRequestScreenshot?: (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => void
}

export const DraftNoteChatPanel: React.FC<DraftNoteChatPanelProps> = ({
  visible = false,
  showCloseButton = true,
  isExploring: propsExploring = false,
  isCapturing = false,
  onClose,
  onScreenshotClick,
  onRequestScreenshot,
}) => {
  const aiGeneralStore = useAiGeneralChatStore()
  const teacherChatStore = useTeacherChatStore()
  const draftStore = useDraftStore()
  const navigate = useNavigate()
  const { captureScreenSnapshot } = useScreenSnapshot()

  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const [activeCategory, setActiveCategory] = useState<'ai-general' | 'teacher'>('ai-general')
  const [overlayButtonStyle, setOverlayButtonStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: '24px',
    top: '16px',
    width: '32px',
    height: '32px',
    zIndex: 35,
  })
  const [overlayButtonReady, setOverlayButtonReady] = useState(false)

  const sessionTreeRef = useRef<any>(null)
  const aiGeneralChatViewRef = useRef<any>(null)

  const isExploring = useMemo(() => {
    return (propsExploring || isCapturing) && activeTab === 'ai-chat'
  }, [propsExploring, isCapturing, activeTab])

  const toolbarToolNames = useMemo(() => {
    return [
      { type: 'select-and-ask' as BuiltinToolType, isActive: isExploring },
      { type: 'formula' as BuiltinToolType },
      { type: 'ask-teacher' as BuiltinToolType },
      { type: 'new-session' as BuiltinToolType },
    ]
  }, [isExploring])

  const selectAndAskIconToUse = isExploring ? selectAndAskIconSelected : selectAndAskIcon

  const hasAttachedScreenshots = (aiGeneralStore.inputAttachedScreenshots?.length ?? 0) > 0

  const updateOverlayButtonPosition = useCallback(() => {
    setOverlayButtonReady(false)
    setTimeout(() => {
      const actualButton = document.querySelector('.chat-content-container .tab-content .toolbar-btn') as HTMLElement
      if (!actualButton) return

      const buttonRect = actualButton.getBoundingClientRect()
      setOverlayButtonStyle({
        position: 'fixed',
        left: `${buttonRect.left}px`,
        top: `${buttonRect.top}px`,
        width: `${buttonRect.width}px`,
        height: `${buttonRect.height}px`,
        zIndex: 35,
      })
      setOverlayButtonReady(true)
    }, 100)
  }, [])

  useEffect(() => {
    if (isExploring && activeTab === 'ai-chat') {
      updateOverlayButtonPosition()
    } else {
      setOverlayButtonReady(false)
    }
  }, [isExploring, activeTab, aiGeneralStore.inputAttachedScreenshots?.length, updateOverlayButtonPosition])

  useEffect(() => {
    window.addEventListener('resize', updateOverlayButtonPosition)
    return () => window.removeEventListener('resize', updateOverlayButtonPosition)
  }, [updateOverlayButtonPosition])

  const handleExploreClick = () => {
    if (isCapturing) {
      onScreenshotClick?.(false)
    } else {
      onScreenshotClick?.(!propsExploring)
    }
  }

  const handleScreenshotClickAction = () => {
    onRequestScreenshot?.({ kind: 'screen_snapshot' })
  }

  const handleOpenTeacherDialog = async ({ sessionId }: { sessionId: string }) => {
    try {
      await teacherChatStore.activateTeacherSession(sessionId)
      setActiveCategory('teacher')
      sessionTreeRef.current?.highlightSession?.(sessionId)
    } catch (error) {
      console.error('设置老师会话失败:', error)
      showMessage('设置老师会话失败', 'error')
    }
  }

  const handleSwitchToTeacher = async (forwardData: { sessionId?: string }) => {
    if (!forwardData?.sessionId) return
    try {
      await teacherChatStore.activateTeacherSession(forwardData.sessionId)
      setActiveCategory('teacher')
      sessionTreeRef.current?.highlightSession?.(forwardData.sessionId)
    } catch (error) {
      console.error('设置老师会话失败:', error)
      showMessage('设置老师会话失败', 'error')
    }
  }

  const handleNewChatClick = async () => {
    const selectedCategory = sessionTreeRef.current?.getSelectedCategory()
    if (selectedCategory === 'BIOLOGY' || selectedCategory === 'MATH') {
      const availableTeachers = teacherChatStore.getAvailableTeachers()
      if (availableTeachers.length === 0) {
        showMessage('所有老师都有对话记录', 'info')
        return
      }
      return
    }

    const canCreateSession = aiGeneralStore.messages.length > 0
    if (!canCreateSession) {
      if (!aiGeneralStore.isCreatingSession) {
        showMessage('请先在当前会话中发送消息', 'warning')
      }
      return
    }
    aiGeneralStore.resetState()
    setActiveCategory('ai-general')
  }

  const handleSessionSelected = async (type: 'ai' | 'teacher', sessionId: string) => {
    setActiveTab('ai-chat')
    setActiveCategory(type === 'ai' ? 'ai-general' : 'teacher')
    if (type === 'ai') {
      await aiGeneralStore.loadSessions()
      await aiGeneralStore.switchSession(sessionId)
    } else {
      await teacherChatStore.activateTeacherSession(sessionId)
    }
    sessionTreeRef.current?.highlightSession?.(sessionId)
  }
  const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
    const { url, html } = payload
    if (!url) return
    if (html) sessionStorage.setItem('htmlPreview_inlineContent', html)
    onClose?.()
    navigate(`/html-preview?url=${encodeURIComponent(url)}&reopenPanel=main`)
  }

  if (!visible) return null

  return (
    <div className="chat-panel-container">
      <div className="panel-bg"></div>
      <div className="panel-main">
        {isExploring && (
          <div className="explore-overlay" onClick={(e) => e.stopPropagation()}>
            <img src={textbookipIcon} alt="textbookip" className="explore-icon textbookip" />
            <img src={ipWordIcon} alt="ipWord" className="explore-icon ipWord" />
          </div>
        )}

        {isExploring && overlayButtonReady && createPortal(
          <button
            type="button"
            className={`pdf-toolbar-btn explore-icon pdf-toolbar-icon-overlay ${hasAttachedScreenshots ? 'explore-icon-large' : ''}`}
            style={overlayButtonStyle}
            onClick={(e) => { e.stopPropagation(); handleExploreClick() }}
          >
            <img src={selectAndAskIconToUse} alt="选中并问" style={{ width: '100%', height: '100%' }} />
          </button>,
          document.body
        )}

        <div className="chat-panel-header">
          <div className="chat-tabs">
            <div className="tab-list">
              {CHAT_TAB_OPTIONS.map((tab) => (
                <div
                  key={tab.value}
                  className={`tab-item ${activeTab === tab.value ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.value as any)}
                >
                  <span>
                    {tab.value === 'ai-chat'
                      ? activeCategory === 'teacher'
                        ? '老师答疑'
                        : 'AI问答'
                      : tab.label}
                  </span>
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
            <div className="main-chat-body">
              <div className="right-panel">
                {activeCategory === 'ai-general' ? (
                  <ChatView
                    ref={aiGeneralChatViewRef}
                    type="ai-general"
                    compressedHeight={339}
                    toolbarTools={toolbarToolNames}
    onOpenTeacherDialog={handleOpenTeacherDialog}
    onSwitchToTeacher={handleSwitchToTeacher}
                    onScreenshotClick={handleScreenshotClickAction}
                    onRequestScreenshot={(p) => onRequestScreenshot?.(p)}
                    onNewSessionClick={handleNewChatClick}
                    onOpenHtmlPreview={handleOpenHtmlPreview}
                  />
                ) : teacherChatStore.currentSession?.sessionId ? (
                  <ChatView
                    key={teacherChatStore.currentSession.sessionId}
                    type="teacher"
                    compressedHeight={339}
                    sessionId={teacherChatStore.currentSession.sessionId}
                    onOpenHtmlPreview={handleOpenHtmlPreview}
                  />
                ) : (
                  <div className="empty-chat">
                    <div className="empty-text">请选择或创建一个会话</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: activeTab === 'question-record' ? 'flex' : 'none' }} className="tab-content">
            <div className="session-list-wrapper">
              <SessionTree
                ref={sessionTreeRef}
                onSessionSelected={handleSessionSelected}
                onCreateNewChat={() => {
                  setActiveTab('ai-chat')
                  handleNewChatClick()
                }}
                onAiSessionDeleted={(sid, success, wasCurrent) => {
                  if (success && wasCurrent) setActiveCategory('ai-general')
                }}
                onTeacherSessionDeleted={(sid, success, wasCurrent) => {
                  if (success && wasCurrent) setActiveCategory('ai-general')
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DraftNoteChatPanel
