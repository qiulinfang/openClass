import React from 'react'
import CardStack from '@/components/base/CardStack'
import './ChatSessionTestView.css'

const ChatSessionTestView: React.FC = () => {
  return (
    <div className="chat-session-test-view">
      <div className="test-container">
        <h2>CardStack 组件测试</h2>
        
        <div className="component-wrapper">
          {/* 组件内部已处理卡片宽度，这里只需要让容器 100% 宽度即可 */}
          <CardStack />
        </div>
      </div>
    </div>
  )
}

export default ChatSessionTestView
