import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChatView } from '@/components/ChatView'
import type { ChatType } from '@/components/chat/strategies/ChatStrategyFactory'
import { getXuebanToken, getUserInfo, authService, logout } from '@/services'
import '@/pages/ChatDemoPage.css'

const chatTypes: { value: ChatType; label: string }[] = [
  { value: 'ai-general', label: 'AI 对话' },
  { value: 'ai-exercise', label: 'AI 题目' },
  { value: 'ai-homework', label: 'AI 作业' },
  { value: 'ai-textbook', label: 'AI 教材' },
  { value: 'teacher', label: '老师对话' },
  { value: 'user-client', label: '客户端' },
  { value: 'html-preview', label: 'HTML 预览' },
]

export const ChatDemoPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentType, setCurrentType] = useState<ChatType>('ai-general')
  const [showFooterText, setShowFooterText] = useState(true)
  const [showToolbar, setShowToolbar] = useState(true)
  const [showActionButtons, setShowActionButtons] = useState(true)
  const [showTime, setShowTime] = useState(false)
  const [showReadStatus, setShowReadStatus] = useState(false)

  useEffect(() => {
    if (!getXuebanToken()) {
      navigate('/')
    }
  }, [navigate])

  const userInfo = getUserInfo()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleSendMessage = (message: string) => {
    console.log('发送消息:', message)
  }

  const handleResponse = () => {
    console.log('收到回复')
  }

  const handleFocus = () => {
    console.log('输入框获得焦点')
  }

  return (
    <div className="chat-demo-page">
      <div className="demo-header">
        <div className="demo-header-top">
          <h1>ChatView 演示</h1>
          <div className="user-info">
            <span>{userInfo?.name || userInfo?.account || '用户'}</span>
            <button className="logout-btn" onClick={handleLogout}>退出</button>
          </div>
        </div>
        <div className="type-selector">
          {chatTypes.map((type) => (
            <button
              key={type.value}
              className={`type-button ${currentType === type.value ? 'active' : ''}`}
              onClick={() => setCurrentType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="demo-settings">
        <label>
          <input
            type="checkbox"
            checked={showFooterText}
            onChange={(e) => setShowFooterText(e.target.checked)}
          />
          显示底部提示
        </label>
        <label>
          <input
            type="checkbox"
            checked={showToolbar}
            onChange={(e) => setShowToolbar(e.target.checked)}
          />
          显示工具栏
        </label>
        <label>
          <input
            type="checkbox"
            checked={showActionButtons}
            onChange={(e) => setShowActionButtons(e.target.checked)}
          />
          显示消息按钮
        </label>
        <label>
          <input
            type="checkbox"
            checked={showTime}
            onChange={(e) => setShowTime(e.target.checked)}
          />
          显示时间
        </label>
        <label>
          <input
            type="checkbox"
            checked={showReadStatus}
            onChange={(e) => setShowReadStatus(e.target.checked)}
          />
          显示已读状态
        </label>
      </div>

      <div className="demo-content">
        <ChatView
          type={currentType}
          showFooterText={showFooterText}
          showToolbar={showToolbar}
          showActionButtons={showActionButtons}
          showTime={showTime}
          showReadStatus={showReadStatus}
          onSendMessage={handleSendMessage}
          onResponse={handleResponse}
          onFocus={handleFocus}
        />
      </div>
    </div>
  )
}

export default ChatDemoPage
