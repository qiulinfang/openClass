import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './MyProfileView.css'

export const MyProfileView: React.FC = () => {
  const navigate = useNavigate()
  const [isInClass] = useState(false)
  const [userClientUnreadCount] = useState(0)
  const [showJoinClassDialog, setShowJoinClassDialog] = useState(false)

  const toggleJoinClass = () => {
    setShowJoinClassDialog(true)
  }

  const openTeacherQADialog = () => {
    console.log('[MyProfileView] 打开老师答疑')
  }

  const showFavorites = () => {
    navigate('/favorites')
  }

  const openDraftNotebook = () => {
    navigate('/draft-notebook')
  }

  const showFeedback = () => {
    console.log('[MyProfileView] 打开反馈')
  }

  const confirmJoinClass = () => {
    console.log('[MyProfileView] 确认加入/退出课堂')
    setShowJoinClassDialog(false)
  }

  const handleJoinClassDialogCancel = () => {
    setShowJoinClassDialog(false)
  }

  return (
    <div className="profile-container">
      <div className="features-section">
        <div className="content-wrapper">
          <div
            className={`feature-card ${isInClass ? 'in-class' : ''}`}
            onClick={toggleJoinClass}
          >
            <img src="/icons/join-class.svg" alt="加入课堂" className="card-icon" />
          </div>

          <div className="feature-card" onClick={openTeacherQADialog}>
            <img src="/icons/teacher-qa.svg" alt="老师答疑" className="card-icon" />
          </div>

          <div className="feature-card" onClick={showFavorites}>
            <img src="/icons/favorites.svg" alt="我的收藏" className="card-icon" />
          </div>

          <div className="feature-card" onClick={openDraftNotebook}>
            <img src="/icons/draft.svg" alt="草稿本" className="card-icon" />
          </div>

          <div className="feature-card" onClick={showFeedback}>
            <img src="/icons/feedback.svg" alt="在线客服" className="card-icon" />
            {userClientUnreadCount > 0 && (
              <span className="notification-badge">{userClientUnreadCount}</span>
            )}
          </div>
        </div>
      </div>

      {showJoinClassDialog && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              {isInClass ? '确认退出课堂' : '课堂提示'}
            </div>
            <div className="dialog-body">
              {isInClass ? (
                <div className="exit-classroom">
                  <div className="exit-icon">!</div>
                  <div className="exit-text">
                    <div className="primary">确认退出课堂？</div>
                    <div className="secondary">退出后将不能和老师互动，且投屏会结束。</div>
                  </div>
                </div>
              ) : (
                <div className="join-classroom-content">
                  <div className="status-text">确认加入课堂？</div>
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button className="cancel-btn" onClick={handleJoinClassDialogCancel}>
                取消
              </button>
              <button className="confirm-btn" onClick={confirmJoinClass}>
                {isInClass ? '确认退出' : '确认加入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyProfileView
