import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { CHAT_TAB_OPTIONS } from '@/constants/options'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useScreenSnapshot } from '@/hooks/useScreenSnapshot'
import { showMessage } from '@/utils'
import ChatView from '@/components/ChatView'
import SessionList from '@/components/chat/session/SessionList'
import type { AiTextbookSession, ChatEntry, ExerciseItem } from '@/types'
import type { BuiltinToolType } from '@/types/toolbarTools'
import Button from '@/components/base/Button'
import '@/components/chat/chatpanel/ExerciseChatPanel.css'

export interface ExerciseChatPanelProps {
  question?: ExerciseItem | null
  sessions?: AiTextbookSession[]
  visible?: boolean
  onClose?: () => void
  onScrollToBottom?: () => void
  onSendMessage?: (message: string) => void
  onOpenTeacherDialog?: (data: { sessionId: string; message?: any }) => void
  onSwitchToTeacher?: (data: any) => void
  onPasteToDraft?: (payload: any) => void
  onSessionClick?: (record: AiTextbookSession) => void
  onAddSession?: () => void
}

export const ExerciseChatPanel: React.FC<ExerciseChatPanelProps> = ({
  question,
  sessions: propsSessions,
  visible = false,
  onClose,
  onScrollToBottom,
  onSendMessage,
  onOpenTeacherDialog,
  onSwitchToTeacher,
  onPasteToDraft,
  onSessionClick,
  onAddSession,
}) => {
  const aiExerciseStore = useAiExerciseChatStore()
  const teacherChatStore = useTeacherChatStore()
  const { captureScreenSnapshot } = useScreenSnapshot()

  const [activeTab, setActiveTab] = useState<'ai-chat' | 'question-record'>('ai-chat')
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(undefined)

  const chatViewRef = useRef<any>(null)

  const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>
  const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

  const sessions = useMemo((): AiTextbookSession[] => {
    const sourceSessions = propsSessions || aiExerciseStore.sessions || []
    return sourceSessions.map((s: any) => ({
      ...s,
      id: (s.id || s.sessionId || '').toString(),
      sessionId: s.id || s.sessionId,
      sessionName: s.title || s.sessionName,
      createTime: s.createdAt || s.createTime,
      updateTime: s.updatedAt || s.updateTime,
    }))
  }, [propsSessions, aiExerciseStore.sessions])

  const handleSessionClick = async (record: any) => {
    const sid = record.id || record.sessionId
    setSelectedRecordId(sid)
    setActiveTab('ai-chat')
    onSessionClick?.(record)
    if (sid) {
      await aiExerciseStore.switchToSession(sid)
      setTimeout(() => {
        chatViewRef.current?.scrollToSession?.(sid)
      }, 100)
    }
  }

  const handleBatchDelete = async (recordIds: string[]) => {
    aiExerciseStore.sessions = aiExerciseStore.sessions.filter(
      (s: any) => !recordIds.includes(s.id || s.sessionId)
    )
    if (selectedRecordId && recordIds.includes(selectedRecordId)) {
      setSelectedRecordId(undefined)
    }
    if (aiExerciseStore.sessions.length === 0) {
      aiExerciseStore.resetState()
    }
  }

  const handleSessionPin = async (record: AiTextbookSession) => {
    record.pinned = !record.pinned
  }

  const handleOpenTeacherDialog = ({ sessionId }: { sessionId: string; message?: any }) => {
    onOpenTeacherDialog?.({ sessionId })
  }

  const handleSwitchToTeacher = (forwardData: any) => {
    if (forwardData.sessionId) {
      onSwitchToTeacher?.(forwardData)
    }
  }

  const handleSessionDelete = async (record: any) => {
    const sid = record.id || record.sessionId
    if (!sid) return
    const index = aiExerciseStore.sessions.findIndex((s: any) => (s.id || s.sessionId) === sid)
    if (index !== -1) {
      aiExerciseStore.sessions.splice(index, 1)
      if (selectedRecordId === sid) setSelectedRecordId(undefined)
      if (aiExerciseStore.sessions.length === 0) aiExerciseStore.resetState()
    }
  }

  const handleScreenshotClick = async () => {
    if (!question) {
      showMessage('请先选择一道题目', 'warning')
      return
    }
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
    if (!question) {
      showMessage('请先选择一道题目', 'warning')
      return
    }
    if (payload?.kind !== 'screen_snapshot') return
    handleScreenshotClick()
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
            type="ai-exercise"
            compressedHeight={360}
            question={question}
            hideAskTeacherIcon={false}
            toolbarTools={toolbarToolNames}
            onScrollToBottom={onScrollToBottom}
            onSendMessage={onSendMessage}
            onOpenTeacherDialog={onOpenTeacherDialog}
            onSwitchToTeacher={onSwitchToTeacher}
            onPasteToDraft={onPasteToDraft}
            onScreenshotClick={handleScreenshotClick}
            onRequestScreenshot={handleRequestScreenshot}
            onNewSessionClick={onAddSession}
          />
        </div>
        <div style={{ display: activeTab === 'question-record' ? 'flex' : 'none' }} className="tab-content">
          <div className="session-list-wrapper">
            <SessionList
              records={sessions as any[]}
              selectedRecordId={selectedRecordId}
              onRecordClick={handleSessionClick}
              onRecordDelete={handleSessionDelete}
              onRecordPin={(record: any) => handleSessionPin(record)}
              onBatchDelete={handleBatchDelete}
              showHeader={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExerciseChatPanel
