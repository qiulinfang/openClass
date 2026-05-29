import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { androidBridge } from '@/services/business/android-bridge'
import { authService, getUserInfo, getXuebanToken, setUserInfo } from '@/services'
import { showMessage } from '@/utils'
import { Dialog } from '@/components/base/Dialog'
import '@/views/MyProfileView.css'

// 导入图标
import drawIcon from '/icons/draw.svg'
import joinClassIcon from '/icons/join_class.svg'
import myFavoritesIcon from '/icons/my_favorites.svg'
import feedbackIcon from '/icons/feedback.svg'
import teacherQAIcon from '/icons/teacher_qa.svg'

export const MyProfileView: React.FC = () => {
  const navigate = useNavigate()
  
  // 状态数据
  const [isInClass, setIsInClass] = useState(false)
  const [isProjecting, setIsProjecting] = useState(false)
  const [userClientUnreadCount] = useState(0)
  const [showJoinClassDialog, setShowJoinClassDialog] = useState(false)

  // 获取用户信息
  const userInfo = useMemo(() => {
    return getUserInfo() || { id: '', name: '', avatar: '', roles: [] }
  }, [])

  // 检查课堂状态
  const checkClassroomStatus = () => {
    const status = androidBridge.getClassroomStatus()
    if (status && status.isInClass === true) {
      setIsInClass(true)
      setIsProjecting(status.status === 'streaming')
    } else {
      setIsInClass(false)
      setIsProjecting(false)
    }
  }

  useEffect(() => {
    checkClassroomStatus()

    // 绑定原生事件
    androidBridge.onClassroomJoined(() => {
      setIsInClass(true)
      showMessage('已加入课堂', 'success')
    })
    androidBridge.onClassroomExited(() => {
      setIsInClass(false)
      showMessage('已退出课堂', 'info')
    })
    androidBridge.onClassroomStatusChanged((newStatus: any) => {
      const inClass = !!newStatus?.isInClass
      setIsInClass(inClass)
      setIsProjecting(newStatus?.status === 'streaming')
    })
    androidBridge.onScreenProjectionStarted(() => setIsProjecting(true))
    androidBridge.onScreenProjectionStopped(() => setIsProjecting(false))
  }, [])

  const toggleJoinClass = () => {
    setShowJoinClassDialog(true)
  }

  const confirmJoinClass = () => {
    setShowJoinClassDialog(false)

    if (!androidBridge.isAndroidBridgeAvailable()) {
      showMessage('Web 演示模式：已完成教室选择，但当前环境不支持真实加入课堂', 'info')
      return
    }

    if (isInClass) {
      const ok = androidBridge.exitClassroom()
      if (ok) {
        setIsInClass(false)
        setIsProjecting(false)
        showMessage('已退出课堂', 'success')
      } else {
        showMessage('退出课堂失败', 'error')
      }
      return
    }

    const studentId = userInfo.id || ''
    const studentName = userInfo.name || '用户'
    const isGuest = !studentId

    const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
    if (ok) {
      setIsInClass(true)
      showMessage('已加入课堂', 'success')
    } else {
      showMessage('加入课堂失败', 'error')
    }
  }

  const openTeacherQADialog = () => {
    console.log('[MyProfileView] 打开老师答疑')
  }

  const showFavorites = () => {
    navigate('/app/my-favorites')
  }

  const openDraftNotebook = () => {
    navigate('/app/draft-notebook')
  }

  const showFeedback = () => {
    console.log('[MyProfileView] 打开反馈')
  }

  return (
    <div className="profile-container">
      <div className="features-section">
        <div className="content-wrapper">
          {/* 加入课堂卡片 */}
          <div
            className={`feature-card ${isInClass ? 'in-class' : ''}`}
            onClick={toggleJoinClass}
          >
            <img src={joinClassIcon} alt="加入课堂" className="card-icon" />
          </div>

          {/* 老师答疑卡片 */}
          <div className="feature-card" onClick={openTeacherQADialog}>
            <img src={teacherQAIcon} alt="老师答疑" className="card-icon" />
          </div>

          {/* 我的收藏卡片 */}
          <div className="feature-card" onClick={showFavorites}>
            <img src={myFavoritesIcon} alt="我的收藏" className="card-icon" />
          </div>

          {/* 草稿本卡片 */}
          <div className="feature-card" onClick={openDraftNotebook}>
            <img src={drawIcon} alt="草稿本" className="card-icon" />
          </div>

          {/* 意见反馈卡片 */}
          <div className="feature-card" onClick={showFeedback}>
            <img src={feedbackIcon} alt="在线客服" className="card-icon" />
            {userClientUnreadCount > 0 && (
              <span className="notification-badge">{userClientUnreadCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* 对话框 */}
      <Dialog
        open={showJoinClassDialog}
        title={isInClass ? '确认退出课堂' : '课堂提示'}
        onClose={() => setShowJoinClassDialog(false)}
        onConfirm={confirmJoinClass}
        confirmButtonText={isInClass ? '确认退出' : '确认加入'}
      >
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
      </Dialog>
    </div>
  )
}

export default MyProfileView
