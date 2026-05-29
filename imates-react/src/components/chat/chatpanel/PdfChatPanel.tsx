import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { CHAT_TAB_OPTIONS } from '@/constants/options'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import {
  getScreenshotSessionsByResourceId,
  deleteScreenshotSession,
  batchDeleteScreenshotSessions,
  updateScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import ChatView from '@/components/ChatView'
import SessionList from '@/components/chat/session/SessionList'
import Button from '@/components/base/Button'
import selectAndAskIcon from '/icons/selectAndAsk.svg'
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord.svg'
import type { AiTextbookSession, ChatBubble, ChatEntry } from '@/types'
import type { BuiltinToolType, ToolbarTool } from '@/types/toolbarTools'
import '@/components/chat/chatpanel/PdfChatPanel.css'

export interface PdfChatPanelProps {
  visible?: boolean
  onClose?: () => void
  onScreenshotClick?: (active: boolean) => void
}

export const PdfChatPanel = forwardRef<any, PdfChatPanelProps>(({
  visible = false,
  onClose,
  onScreenshotClick,
}, ref) => {
  const pdfViewerStore = usePdfViewerStore()
  const aiTextbookStore = useAiTextbookChatStore()
  const teacherChatStore = useTeacherChatStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const [sessions, setSessions] = useState<AiTextbookSession[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(undefined)
  const [showGlobalChatDialog, setShowGlobalChatDialog] = useState(false)
  const [globalChatEntry, setGlobalChatEntry] = useState<ChatEntry | undefined>(undefined)
  const [overlayButtonStyle, setOverlayButtonStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: '24px',
    top: '16px',
    width: '32px',
    height: '32px',
    zIndex: 35,
  })
  const [overlayButtonReady, setOverlayButtonReady] = useState(false)

  const chatViewRef = useRef<any>(null)

  const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>
  
  const isSelectAndAskSelected = pdfViewerStore.selectedTool === 'screenshot'
  const isExploring = isSelectAndAskSelected && activeTab === 'ai-chat'
  const selectAndAskIconToUse = isSelectAndAskSelected ? selectAndAskIconSelected : selectAndAskIcon
  const hasAttachedScreenshots = (aiTextbookStore.inputAttachedScreenshots?.length ?? 0) > 0

  const toolbarToolNames = useMemo((): ToolbarTool[] => [
    { type: 'select-and-ask', isActive: isSelectAndAskSelected },
    { type: 'formula' },
    { type: 'ask-teacher' },
  ], [isSelectAndAskSelected])

  const getResourceId = useCallback(() => {
    const params = new URLSearchParams(location.search)
    return params.get('resourceId') || undefined
  }, [location.search])

  const getSessionId = (session: AiTextbookSession): string => {
    return session.sessionId || session.id || ''
  }

  const loadSessions = useCallback(async () => {
    const resourceId = getResourceId() || ''
    const byResource = await getScreenshotSessionsByResourceId(resourceId)
    setSessions(byResource)
  }, [getResourceId])

  useEffect(() => {
    const resourceId = getResourceId()
    if (resourceId) {
      aiTextbookStore.setResourceId(resourceId)
    }
    loadSessions()
  }, [getResourceId, aiTextbookStore, loadSessions])

  useEffect(() => {
    if (activeTab === 'question-record') {
      loadSessions()
    }
  }, [activeTab, loadSessions])

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
  }, [isExploring, activeTab, aiTextbookStore.inputAttachedScreenshots?.length, updateOverlayButtonPosition])

  const handleExploreClick = () => {
    onScreenshotClick?.(!isSelectAndAskSelected)
  }

  const handleSessionClick = async (record: any) => {
    const sid = getSessionId(record)
    setSelectedRecordId(sid)
    setActiveTab('ai-chat')
    setTimeout(() => {
      chatViewRef.current?.scrollToSession?.(sid)
    }, 100)
  }

  const handleSessionDelete = async (record: AiTextbookSession) => {
    const sessionId = getSessionId(record)
    const ok = await deleteScreenshotSession(sessionId)
    if (ok) {
      if (selectedRecordId === sessionId) {
        setSelectedRecordId(undefined)
      }
      await loadSessions()
    }
  }

  const handleBatchDelete = async (recordIds: string[]) => {
    const ok = await batchDeleteScreenshotSessions(recordIds)
    if (ok) {
      if (selectedRecordId && recordIds.includes(selectedRecordId)) {
        setSelectedRecordId(undefined)
      }
      await loadSessions()
    }
  }

  const handleSessionPin = async (record: AiTextbookSession) => {
    const updatedRecord = { ...record, pinned: !record.pinned }
    const ok = await updateScreenshotSession(updatedRecord)
    if (ok) {
      await loadSessions()
    }
  }

  const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
    const { url, html } = payload
    if (!url) return
    if (html) sessionStorage.setItem('htmlPreview_inlineContent', html)
    const currentSessionId = (aiTextbookStore as any).currentSessionId
    navigate(`/html-preview?url=${encodeURIComponent(url)}&sessionId=${currentSessionId || ''}&reopenPanel=pdf`)
  }

  useImperativeHandle(ref, () => ({
    reloadSessions: loadSessions,
    openTextbookScreenshotEditor: (payload: any) => {
      chatViewRef.current?.openTextbookScreenshotEditor?.(payload)
    }
  }))

  if (!visible) return null

  return (
    <div className="chat-panel-container">
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
          <ChatView
            ref={chatViewRef}
            type="ai-textbook"
            compressedHeight={360}
            toolbarTools={toolbarToolNames}
            onScreenshotClick={handleExploreClick}
            onOpenHtmlPreview={handleOpenHtmlPreview}
            onOpenTeacherDialog={(data: any) => {
              // 处理打开教师对话逻辑
            }}
            onSwitchToTeacher={(data: any) => {
              // 处理切换到教师逻辑
            }}
            onRequestScreenshot={(p) => {
              if (p.kind === 'pdf_page') onScreenshotClick?.(true)
            }}
          />
        </div>
        <div style={{ display: activeTab === 'question-record' ? 'flex' : 'none' }} className="tab-content">
          <div className="session-list-wrapper">
            <SessionList
              records={sessions as any[]}
              selectedRecordId={selectedRecordId}
              onRecordClick={handleSessionClick}
              onRecordDelete={(record: any) => handleSessionDelete(record)}
              onRecordPin={(record: any) => handleSessionPin(record)}
              onBatchDelete={handleBatchDelete}
              showHeader={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

export default PdfChatPanel
