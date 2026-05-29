import React, { useState, useMemo } from 'react'
import { Modal } from '@/components/base/Modal'
import AvatarCropper from '@/components/base/AvatarCropper'
import { useImagePicker } from '@/hooks/useImagePicker'
import { showMessage } from '@/utils'
import avatarIcon from '/icons/avatar.svg'
import '@/components/dialog/ProfileDialog.css'

export interface ProfileDialogProps {
  open?: boolean
  userInfo?: {
    id: string
    name: string
    avatar: string
    avatarNew: string
    roles?: string[]
  }
  onClose?: () => void
  onAvatarChanged?: (avatarUrl: string) => void
  onLogout?: () => void
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({
  open = false,
  userInfo,
  onClose,
  onAvatarChanged,
  onLogout,
}) => {
  const [cropVisible, setCropVisible] = useState(false)
  const [cropSrc, setCropSrc] = useState('')
  const { pickImage } = useImagePicker()

  const userId = useMemo(() => userInfo?.id || '未知', [userInfo])

  const currentAvatar = useMemo(() => {
    if (userInfo?.avatarNew) {
      return userInfo.avatarNew
    }
    return avatarIcon
  }, [userInfo])

  const displayUserName = useMemo(() => {
    const name = userInfo?.name?.toString().trim()
    return name || '用户'
  }, [userInfo])

  const handleAvatarClick = async () => {
    try {
      const imageInfo = await pickImage()
      if (!imageInfo || !imageInfo.base64DataUrl) {
        return
      }

      setCropSrc(imageInfo.base64DataUrl)
      setCropVisible(true)
    } catch (error) {
      console.error('[ProfileDialog] 选择头像失败:', error)
      showMessage('头像更新失败，请重试', 'error')
    }
  }

  const handleCropConfirm = (croppedDataUrl: string) => {
    onAvatarChanged?.(croppedDataUrl)
    showMessage('头像更新成功', 'success')
    setCropVisible(false)
  }

  const handleCropCancel = () => {
    setCropSrc('')
    setCropVisible(false)
  }

  const handleLogout = () => {
    onLogout?.()
  }

  return (
    <>
      <Modal
        open={open}
        title="个人信息"
        autoSize={true}
        titleAlign="left"
        headerBackgroundColor="#ffffff"
        className="profile-dialog"
        onClose={onClose}
      >
        <div className="profile-dialog-content">
          <div className="profile-list">
            <div className="list-item avatar-item" onClick={handleAvatarClick}>
              <div className="item-label">头像</div>
              <div className="item-content">
                <div className="user-avatar-list">
                  <img src={currentAvatar} alt="avatar" className="avatar-image-list" />
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
                <span className="item-value">{displayUserName}</span>
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
      </Modal>

      <AvatarCropper
        open={cropVisible}
        src={cropSrc}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </>
  )
}

export default ProfileDialog
