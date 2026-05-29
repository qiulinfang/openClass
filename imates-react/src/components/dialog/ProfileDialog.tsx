import React, { useState } from 'react'
import { Dialog } from '@/components/base/Dialog'
import '@/components/dialog/ProfileDialog.css'

export interface ProfileDialogProps {
  open?: boolean
  userId?: string
  userName?: string
  avatar?: string
  onClose?: () => void
  onLogout?: () => void
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({
  open = false,
  userId = '',
  userName = '',
  avatar = '',
  onClose,
  onLogout,
}) => {
  const [cropVisible, setCropVisible] = useState(false)
  const [cropSrc, setCropSrc] = useState('')

  const handleAvatarClick = () => {
    console.log('[ProfileDialog] 点击头像')
  }

  const handleLogout = () => {
    onLogout?.()
  }

  if (!open) return null

  return (
    <Dialog open={open} title="个人信息" onClose={onClose}>
      <div className="profile-dialog-content">
        <div className="profile-list">
          <div className="list-item avatar-item" onClick={handleAvatarClick}>
            <div className="item-label">头像</div>
            <div className="item-content">
              <div className="user-avatar-list">
                <img src={avatar || '/icons/default-avatar.png'} alt="avatar" className="avatar-image-list" />
                <div className="avatar-overlay-list">
                  <span className="change-avatar-text">更换</span>
                </div>
              </div>
            </div>
            <div className="item-arrow">›</div>
          </div>

          <div className="list-item">
            <div className="item-label">用户名</div>
            <div className="item-content">
              <span className="item-value">{userName || '未设置'}</span>
            </div>
          </div>

          <div className="list-item">
            <div className="item-label">用户ID</div>
            <div className="item-content">
              <span className="item-value">{userId}</span>
            </div>
          </div>

          <div className="list-item logout-item" onClick={handleLogout}>
            <div className="item-label logout-label">退出登录</div>
            <div className="item-content"></div>
            <div className="item-arrow">›</div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default ProfileDialog
