import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CHAT_TAB_OPTIONS } from '@/constants/options'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { showMessage } from '@/utils'
import { getUserId } from '@/services'
import { useScreenSnapshot } from '@/hooks/useScreenSnapshot'
import SessionTree from '@/components/chat/session/SessionTree'
import ChatView from '@/components/ChatView'
import Button from '@/components/base/Button'
import switcherIcon from '/icons/Switcher.svg'
import type { ChatBubble, ChatEntry } from '@/types/chat'
import type { BuiltinToolType } from '@/types/toolbarTools'
import '@/components/chat/chatpanel/MainChatPanel.css'

export interface MainChatPanelProps {
  visible?: boolean
  entry?: ChatEntry
  screenshotFlowVisible?: boolean
  onClose?: () => void
  onToggleMode?: () => void
}

export const MainChatPanel: React.FC<MainChatPanelProps> = ({
  visible = false,
  entry,
  screenshotFlowVisible = false,
  onClose,
  onToggleMode,
}) => {
  const aiGeneralStore = useAiGeneralChatStore()
  const teacherChatStore = useTeacherChatStore()
  const navigate = useNavigate()
  const { captureScreenSnapshot } = useScreenSnapshot()

  const [panelWidth, setPanelWidth] = useState(460)
  const [isResizing, setIsResizing] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const [activeCategory, setActiveCategory] = useState<'ai-general' | 'teacher'>('ai-general')

  const startX = useRef(0)
  const startWidth = useRef(0)
  const resizingPointerId = useRef<number | null>(null)
  const rafId = useRef<number | null>(null)
  const pendingWidth = useRef<number | null>(null)

  const sessionTreeRef = useRef<any>(null)
  const aiGeneralChatViewRef = useRef<any>(null)

  const isDev = import.meta.env.MODE === 'development'

  const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>
  const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

  const clampWidth = (w: number) => Math.max(300, Math.min(800, w))

  const scheduleWidthUpdate = useCallback((nextWidth: number) => {
    pendingWidth.current = clampWidth(nextWidth)
    if (rafId.current !== null) return

    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null
      if (pendingWidth.current === null) return
      setPanelWidth(pendingWidth.current)
      pendingWidth.current = null
    })
  }, [])

  const startResize = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    setIsResizing(true)
    resizingPointerId.current = e.pointerId
    startX.current = e.clientX
    startWidth.current = panelWidth
    
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  const handleResize = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return
    if (resizingPointerId.current !== null && e.pointerId !== resizingPointerId.current) return
    const deltaX = startX.current - e.clientX
    scheduleWidthUpdate(startWidth.current + deltaX)
  }, [isResizing, scheduleWidthUpdate])

  const stopResize = useCallback((e?: React.PointerEvent) => {
    if (e && resizingPointerId.current !== null && e.pointerId !== resizingPointerId.current) return
    setIsResizing(false)
    resizingPointerId.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (rafId.current !== null) {
      window.cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (rafId.current !== null) window.cancelAnimationFrame(rafId.current)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const applyEntry = useCallback(async (nextEntry?: ChatEntry) => {
    if (!nextEntry) return
    setActiveTab('ai-chat')
    setActiveCategory(nextEntry.category)

    if (nextEntry.mode === 'default') {
      if (nextEntry.category === 'ai-general') {
        await aiGeneralStore.loadSessions()
        const targetSessionId = aiGeneralStore.currentSession?.sessionId ?? aiGeneralStore.sessions[0]?.sessionId
        if (targetSessionId) {
          if (aiGeneralStore.currentSession?.sessionId !== targetSessionId) {
            await aiGeneralStore.switchSession(targetSessionId)
          }
          sessionTreeRef.current?.highlightSession?.(targetSessionId)
        }
      } else {
        const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
        const targetSessionId = teacherChatStore.currentSession?.sessionId ?? allTeacherSessions[0]?.sessionId
        if (targetSessionId) {
          if (teacherChatStore.currentSession?.sessionId !== targetSessionId) {
            await teacherChatStore.activateTeacherSession(targetSessionId)
          }
          sessionTreeRef.current?.highlightSession?.(targetSessionId)
        }
      }
      return
    }

    if (nextEntry.mode === 'new') {
      if (nextEntry.category === 'ai-general') {
        aiGeneralStore.resetState()
      } else {
        ensureTeacherSessionSelected()
      }
      return
    }

    if (nextEntry.mode === 'session') {
      if (nextEntry.category === 'ai-general') {
        await aiGeneralStore.loadSessions()
        await aiGeneralStore.switchSession(nextEntry.sessionId)
        sessionTreeRef.current?.highlightSession?.(nextEntry.sessionId)
      } else {
        await teacherChatStore.activateTeacherSession(nextEntry.sessionId)
        sessionTreeRef.current?.highlightSession?.(nextEntry.sessionId)
      }
    }
  }, [aiGeneralStore, teacherChatStore])

  const ensureTeacherSessionSelected = useCallback(() => {
    if (teacherChatStore.currentSession?.sessionId) return
    const allSessions = Object.values(teacherChatStore.loadAllSessions())
    if (!allSessions || allSessions.length === 0) return
    const firstSession = allSessions[0]
    teacherChatStore.setSession(firstSession)
  }, [teacherChatStore])

  useEffect(() => {
    if (visible && entry) {
      applyEntry(entry)
    }
  }, [visible, entry, applyEntry])

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

  const handleAiSessionDeleted = (sessionId: string, success: boolean, wasCurrent: boolean) => {
    if (success && wasCurrent) setActiveCategory('ai-general')
  }

  const handleTeacherSessionDeleted = (sessionId: string, success: boolean, wasCurrent: boolean) => {
    if (success && wasCurrent) setActiveCategory('ai-general')
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
    // 根据当前选中的节点类型来决定创建哪种类型的对话
    const selectedCategory = sessionTreeRef.current?.getSelectedCategory()

    if (selectedCategory === 'BIOLOGY' || selectedCategory === 'MATH') {
      const availableTeachers = teacherChatStore.getAvailableTeachers()

      if (availableTeachers.length === 0) {
        showMessage('所有老师都有对话记录', 'info')
        return
      }
      // TODO: 实现教师选择对话框
      return
    }

    // 默认创建AI对话
    if (!aiGeneralStore.messages.length && !aiGeneralStore.isCreatingSession) {
      showMessage('请先在当前会话中发送消息', 'warning')
      return
    }
    aiGeneralStore.resetState()
    setActiveCategory('ai-general')
  }

  const handleScreenshotClick = async () => {
    try {
      const { dataUrl, width, height } = await captureScreenSnapshot()
      if (!dataUrl) return
      if (activeCategory === 'ai-general') {
        const imageInfo = {
          filePath: '',
          width: width || 0,
          height: height || 0,
          fileSize: Math.round(dataUrl.length * 0.75),
          base64DataUrl: dataUrl,
        }
        await aiGeneralChatViewRef.current?.onImageSelected?.(imageInfo)
      }
    } catch (error) {
      console.error('截图失败:', error)
      showMessage('截图失败', 'error')
    }
  }

  const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
    if (payload?.kind !== 'screen_snapshot') return
    handleScreenshotClick()
  }

  const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
    const { url, html } = payload
    if (!url) return
    if (html) sessionStorage.setItem('htmlPreview_inlineContent', html)
    onClose?.()
    navigate(`/html-preview?url=${encodeURIComponent(url)}&reopenPanel=main`)
  }

  if (!visible) return null

  return createPortal(
    <div 
      className="main-chat-overlay" 
      onClick={onClose}
      onPointerMove={handleResize}
      onPointerUp={stopResize}
      onPointerCancel={stopResize}
    >
      <div
        className={`main-chat-panel ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ width: `${panelWidth}px` }}
      >
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onPointerDown={startResize}
        />

        <div className="chat-panel-header">
          <div className="chat-tabs">
            <div className="tab-list">
              {tabOptions.map((tab) => (
                <div
                  key={tab.value}
                  className={`tab-item ${activeTab === tab.value ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.value)}
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

          <button type="button" className="toggle-mode-button" onClick={onToggleMode}>
            <img src={switcherIcon} alt="switch mode" className="toggle-mode-icon" />
          </button>

          <Button
            variant="ghost"
            size="sm"
            icon="/icons/close.svg"
            onClick={onClose}
            className="close-button"
          />
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
                    onScreenshotClick={handleScreenshotClick}
                    onRequestScreenshot={handleRequestScreenshot}
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
                  setActiveCategory('ai-general')
                  if (!aiGeneralStore.messages.length && !aiGeneralStore.isCreatingSession) {
                    showMessage('请先在当前会话中发送消息', 'warning')
                    return
                  }
                  aiGeneralStore.resetState()
                }}
                onAiSessionDeleted={handleAiSessionDeleted}
                onTeacherSessionDeleted={handleTeacherSessionDeleted}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MainChatPanel
