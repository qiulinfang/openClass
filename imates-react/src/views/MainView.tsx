import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './MainView.css'

interface NavItem {
  key: string
  label: string
  icon: string
}

export const MainView: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isInClass] = useState(false)
  const [userClientUnreadCount] = useState(0)
  const [hasResourceNotification] = useState(false)
  const [hideFunctionMenu] = useState(false)

  const navMainItems: NavItem[] = [
    { key: 'home', label: '首页', icon: '/icons/home.svg' },
    { key: 'exercise', label: '习题', icon: '/icons/exercise.svg' },
    { key: 'homework', label: '作业', icon: '/icons/homework.svg' },
    { key: 'mistake', label: '错题本', icon: '/icons/mistake.svg' },
    { key: 'toolbox', label: '工具箱', icon: '/icons/toolbox.svg' },
  ]

  const navBottomItems: NavItem[] = [
    { key: 'resources', label: '我的资源', icon: '/icons/resources.svg' },
    { key: 'profile', label: '我的', icon: '/icons/profile.svg' },
  ]

  const isNavItemActive = (key: string) => {
    return location.pathname.includes(key)
  }

  const handleAvatarClick = () => {
    navigate('/profile')
  }

  const handleNavItemClick = (item: NavItem) => {
    switch (item.key) {
      case 'home':
        navigate('/home')
        break
      case 'exercise':
        navigate('/exercise')
        break
      case 'homework':
        navigate('/homework')
        break
      case 'mistake':
        navigate('/mistake')
        break
      case 'toolbox':
        navigate('/toolbox')
        break
      case 'resources':
        navigate('/resources')
        break
      case 'profile':
        navigate('/profile')
        break
    }
  }

  const getNavIcon = (item: NavItem) => {
    return item.icon
  }

  return (
    <div className="main-view">
      {!hideFunctionMenu && (
        <div className="function-menu">
          <div className="nav-items-container">
            <div className="user-avatar" onClick={handleAvatarClick}>
              <img src="/icons/avatar.svg" alt="avatar" style={{ width: 40, height: 40 }} />
              <div className="user-name">用户</div>
            </div>

            <div className="nav-items-wrapper">
              {navMainItems.map((item) => (
                <div
                  key={item.key}
                  className={`nav-item ${isNavItemActive(item.key) ? 'active' : ''}`}
                  onClick={() => handleNavItemClick(item)}
                >
                  <div className="nav-icon-wrapper">
                    <img src={getNavIcon(item)} alt={item.label} className="nav-icon" />
                    {item.key === 'toolbox' && userClientUnreadCount > 0 && (
                      <span className="notification-badge">{userClientUnreadCount}</span>
                    )}
                  </div>
                  <span className="nav-text">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="nav-items-bottom">
              {navBottomItems.map((item) => (
                <div
                  key={item.key}
                  className={`nav-item ${isNavItemActive(item.key) ? 'active' : ''}`}
                  onClick={() => handleNavItemClick(item)}
                >
                  <div className="nav-icon-wrapper">
                    <img src={getNavIcon(item)} alt={item.label} className="nav-icon" />
                    {item.key === 'resources' && hasResourceNotification && (
                      <span className="notification-dot"></span>
                    )}
                  </div>
                  <span className="nav-text">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="right-main-area">
        <div className="main-content">
          <span>主内容区域</span>
        </div>
      </div>
    </div>
  )
}

export default MainView
