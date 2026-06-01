import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getTeacherWebSocket } from '@/services/websocket/teacher-websocket'
import { httpClient } from '@/services/http/http-client'
import { getApiPaths, getCurrentEnvType, AppEnvType, trySwitchEnv } from '@/config/env-config'
import Button from '@/components/base/Button'
import './TeacherDebugView.css'

// 类型定义
interface TeacherSession {
  id: string
  studentId: string
  studentName: string
  studentAvatar: string | null
  msgType: string
  msgContent: string
  msgTime: string
  hasUnRead: boolean
  pinStatus?: number // 0: 未置顶, 1: 已置顶
  unreadCount?: number 
}

interface MessageItem {
  senderType: 'TEACHER' | 'STUDENT' | string
  content: string
  msgType: string
  timestamp: number
}

const TeacherDebugView: React.FC = () => {
  // --- 状态定义 ---
  const [wsConnected, setWsConnected] = useState(false)
  const [sessions, setSessions] = useState<TeacherSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [replyText, setReplyText] = useState('')
  const [newQuestionNotice, setNewQuestionNotice] = useState<any>(null)
  
  const messageBoxRef = useRef<HTMLDivElement>(null)
  const teacherId = '1866415928790540290'
  const ws = getTeacherWebSocket()

  const scrollToBottom = useCallback(() => {
    if (messageBoxRef.current) {
      messageBoxRef.current.scrollTo({
        top: messageBoxRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const apiPaths = getApiPaths()
      const apiPath = apiPaths.yanban.teacher.historyList.replace('/historyList', '')
      const finalUrl = `${apiPath}/sessionList`
      
      console.log('[TeacherDebug] 🚀 开始请求会话列表:', {
        url: finalUrl,
        teacherId
      })
      
      const res = await httpClient.post<any>(finalUrl, {
        teacherId: teacherId,
        page: 1,
        pageSize: 50
      })

      if (res.success && res.data) {
        const rawData = res.data.data || res.data
        const records = rawData.records || rawData.list || (Array.isArray(rawData) ? rawData : [])
        
        setSessions(records.map((item: any) => ({
          ...item,
          unreadCount: item.hasUnRead ? 1 : 0
        })))
      }
    } catch (err) {
      console.error('[TeacherDebug] ❌ 获取会话列表异常:', err)
    }
  }, [teacherId])

  const fetchHistory = useCallback(async (sessionId: string) => {
    try {
      const res = await httpClient.post<any>(getApiPaths().yanban.teacher.historyList, {
        sessionId,
        page: 1,
        pageSize: 50
      })
      if (res.success && res.data) {
        const history = Array.isArray(res.data) ? res.data : (res.data.data || [])
        setMessages(history.map((m: any) => ({
          senderType: m.senderType || (m.account === teacherId ? 'TEACHER' : 'STUDENT'),
          content: m.msgContent,
          msgType: m.msgType,
          timestamp: m.createTime ? new Date(m.createTime).getTime() : Date.now(),
          senderName: m.msgSendName,
          senderAvatar: m.msgSendAvatar
        })))
        setTimeout(scrollToBottom, 100)
      }
    } catch (err) {
      console.error('获取历史记录失败:', err)
    }
  }, [teacherId, scrollToBottom])

  const markAsRead = useCallback(async (sessionId: string) => {
    try {
      const apiPath = getApiPaths().yanban.teacher.historyList.replace('/historyList', '')
      await httpClient.post(`${apiPath}/readMessage`, { sessionId, teacherId })
      
      setSessions(prev => prev.map(item => 
        item.id === sessionId ? { ...item, hasUnRead: false, unreadCount: 0 } : item
      ))
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }, [teacherId])

  const selectSession = useCallback(async (session: TeacherSession) => {
    setCurrentSessionId(session.id)
    await markAsRead(session.id)
    await fetchHistory(session.id)
  }, [markAsRead, fetchHistory])

  const handleNewQuestion = useCallback((msg: any) => {
    if (msg.data && msg.data.payload) {
      setNewQuestionNotice({
        sessionId: msg.data.payload.sessionId,
        content: msg.data.payload.content
      })
      fetchSessions()
    }
  }, [fetchSessions])

  const setupWs = useCallback(() => {
    console.log(`[TeacherDebug] 🔌 正在以教师账号 ${teacherId} 建立连接...`)
    ws.disconnect()
    ws.connect(teacherId)
    
    ws.on('connected', () => {
      setWsConnected(true)
    })
    
    ws.on('disconnected', () => {
      setWsConnected(false)
    })

    ws.on('message', (msg: any) => {
      if (msg.type === 'TYPE_NEW_QUESTION' || msg.type === 'NEW_QUESTION') {
        handleNewQuestion(msg)
      }
    })

    ws.on('TYPE_NEW_QUESTION', handleNewQuestion)
    ws.on('NEW_QUESTION', handleNewQuestion)

    ws.on('TEACHER_RESPONSE', (msg: any) => {
      if (msg.data && msg.data.sessionId === currentSessionId) {
        setMessages(prev => [...prev, {
          senderType: 'TEACHER',
          content: msg.data.content,
          msgType: msg.data.msgType || '0',
          timestamp: msg.data.timestamp || Date.now()
        }])
        setTimeout(scrollToBottom, 100)
      }
    })
  }, [teacherId, currentSessionId, ws, handleNewQuestion, scrollToBottom])

  useEffect(() => {
    setupWs()
    fetchSessions()
    setWsConnected(ws.isConnected())

    return () => {
      ws.off('connected')
      ws.off('disconnected')
      ws.off('NEW_QUESTION')
      ws.off('TYPE_NEW_QUESTION')
      ws.off('TEACHER_RESPONSE')
      ws.off('message')
    }
  }, [setupWs, fetchSessions, ws])

  const handleEnvChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const targetEnv = event.target.value as AppEnvType
    const success = trySwitchEnv(targetEnv, '985211')
    if (success) {
      window.location.reload()
    } else {
      alert('环境切换失败，请检查权限')
    }
  }

  const togglePinSession = async (e: React.MouseEvent, session: TeacherSession) => {
    e.stopPropagation()
    try {
      const newStatus = session.pinStatus === 1 ? 0 : 1
      const isTest = getCurrentEnvType() === AppEnvType.INTERNAL_TEST
      const prefix = isTest ? '/yb-teacher-test/yb-teacher/' : '/teacher-ws-release/blw-edu-yb/'
      const apiPath = `${prefix}api/question/pinSession`
      
      const res = await httpClient.post<any>(apiPath, {
        sessionId: session.id,
        pinStatus: newStatus
      })

      if (res.success) {
        await fetchSessions()
      } else {
        alert('操作失败: ' + (res.message || '未知错误'))
      }
    } catch (err) {
      console.error('[TeacherDebug] ❌ 置顶操作异常:', err)
    }
  }

  const sendReply = async () => {
    if (!replyText.trim() || !currentSessionId) return

    const content = replyText
    const sessionId = currentSessionId

    try {
      const apiPath = getApiPaths().yanban.teacher.historyList.replace('/historyList', '')
      const res = await httpClient.post(`${apiPath}/replyMessage`, {
        sessionId,
        teacherId,
        msgType: '0',
        msgContent: content
      })

      if (res.success) {
        setMessages(prev => [...prev, {
          senderType: 'TEACHER',
          content: content,
          msgType: '0',
          timestamp: Date.now()
        }])
        setReplyText('')
        setTimeout(scrollToBottom, 100)
      }
    } catch (err) {
      console.error('发送回复失败:', err)
    }
  }

  const formatTime = (ts: number) => {
    const date = new Date(ts)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const goToSession = (sessionId: string) => {
    setNewQuestionNotice(null)
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      selectSession(session)
    } else {
      setCurrentSessionId(sessionId)
      fetchHistory(sessionId)
    }
  }

  return (
    <div className="teacher-test-page">
      <div className="app-header">
        <div className="header-left">
          <span className="brand">教师端</span>
          <div className="env-selector">
            <select value={getCurrentEnvType()} onChange={handleEnvChange}>
              <option value={AppEnvType.RELEASE}>正式环境</option>
              <option value={AppEnvType.INTERNAL_TEST}>测试环境</option>
            </select>
          </div>
        </div>
        <div className="header-right">
          <div className={`status-indicator ${wsConnected ? 'is-online' : ''}`} title={wsConnected ? '已连接' : '已断开'}></div>
          <Button 
            label="重连" 
            size="xs" 
            variant="ghost" 
            onClick={() => { ws.disconnect(); setupWs(); }}
          />
        </div>
      </div>

      <div className="main-content">
        <aside className="session-nav">
          <div className="nav-header">
            <span className="count">共 {sessions.length} 个会话</span>
            <button className="refresh-icon" onClick={fetchSessions}>🔄</button>
          </div>
          
          <div className="session-scroll-area">
            {sessions.map(session => (
              <div 
                key={session.id}
                className={`session-card ${currentSessionId === session.id ? 'active' : ''} ${session.pinStatus === 1 ? 'is-pinned' : ''}`}
                onClick={() => selectSession(session)}
              >
                <div className="session-avatar">
                  {(session.studentName || '学').charAt(0)}
                </div>
                <div className="session-detail">
                  <div className="session-top">
                    <span className="name">
                      {session.pinStatus === 1 && <span className="pin-tag">📌</span>}
                      {session.studentName || '学生'}
                    </span>
                    <span className="time">{session.msgTime}</span>
                  </div>
                  <div className="session-bottom">
                    <p className="preview">{session.msgContent}</p>
                    <div className="session-actions">
                      {session.unreadCount ? <div className="unread-dot"></div> : null}
                      <button 
                        className="pin-btn" 
                        title={session.pinStatus === 1 ? '取消置顶' : '置顶'}
                        onClick={(e) => togglePinSession(e, session)}
                      >
                        {session.pinStatus === 1 ? '📍' : '📌'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {sessions.length === 0 && (
              <div className="empty-state">
                <p>暂无消息</p>
              </div>
            )}
          </div>
        </aside>

        <main className="chat-viewport">
          {currentSessionId ? (
            <>
              <header className="chat-header">
                <div className="student-profile">
                  <div className="avatar-sm">{currentSessionId.charAt(0).toUpperCase()}</div>
                  <span className="current-name">会话ID: {currentSessionId}</span>
                </div>
              </header>

              <div className="message-list" ref={messageBoxRef}>
                {messages.map((msg, index) => (
                  <div 
                    key={index}
                    className={`message-group ${msg.senderType === 'TEACHER' ? 'sent' : 'received'}`}
                  >
                    <div className="message-bubble">
                      {msg.msgType === '1' ? (
                        <div className="image-content">
                          <img src={msg.content} alt="图片内容" onClick={() => window.open(msg.content, '_blank')} />
                        </div>
                      ) : (
                        <div className="text-content">{msg.content}</div>
                      )}
                      <div className="message-meta">
                        {formatTime(msg.timestamp)}
                        {msg.senderType === 'TEACHER' && <span className="check-icon">✓</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="input-panel">
                <div className="input-wrapper">
                  <textarea 
                    className="reply-textarea"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="输入回复内容..."
                    onKeyUp={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        sendReply()
                      }
                    }}
                  ></textarea>
                  <Button 
                    className="send-btn" 
                    disabled={!replyText.trim()}
                    onClick={sendReply}
                  >
                    发送
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <div className="hero-screen">
              <div className="hero-content">
                <div className="hero-illustration">🛋️</div>
                <h1>准备好开始答疑了吗？</h1>
                <p>从左侧列表中选择一个学生会话，开始提供专业的指导。</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {newQuestionNotice && (
        <div className="smart-notice">
          <div className="notice-body">
            <div className="notice-icon">🔔</div>
            <div className="notice-info">
              <h4>新消息通知</h4>
              <p>{newQuestionNotice.content}</p>
            </div>
          </div>
          <div className="notice-foot">
            <button className="btn-text" onClick={() => setNewQuestionNotice(null)}>忽略</button>
            <button className="btn-primary" onClick={() => goToSession(newQuestionNotice.sessionId)}>立即查看</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherDebugView
