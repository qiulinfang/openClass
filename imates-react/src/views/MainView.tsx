import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { ProfileDialog } from '../components/dialog/ProfileDialog'
import { MyProfileView } from './MyProfileView'
import { getUserInfo, setUserInfo, setXuebanToken, setYanbanToken } from '../services'

// 导入普通状态图标
import avatarIcon from '/icons/avatar.svg'
import toolBoxIcon from '/icons/toolBox.svg'
import downloadResourcesIcon from '/icons/downloadResources.svg'
import knowledgeGraphIcon from '/icons/knowledge_graph.svg'
import exerciseIcon from '/icons/my_exercises.svg'
import homeworkIcon from '/icons/homework.png'
import photoQaIcon from '/icons/paizhaodayi.svg'
import mistakeBookIcon from '/icons/cuotiben.svg'

// 导入选中状态图标
import toolBoxSelectIcon from '/icons/toolBox_select.svg'
import downloadResourcesSelectIcon from '/icons/downloadResources_select.svg'
import knowledgeGraphSelectIcon from '/icons/knowledge_graph_select.svg'
import exerciseSelectIcon from '/icons/my_exercises_select.svg'
import homeworkSelectIcon from '/icons/homework_select.png'
import photoQaSelectIcon from '/icons/paizhaodayi_select.svg'
import mistakeBookSelectIcon from '/icons/cuotiben_select.svg'

import './MainView.css'

interface NavItem {
  key: string
  label: string
  iconType: string
  routeName?: string
}

export const MainView: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isInClass] = useState(false)
  const [userClientUnreadCount] = useState(0)
  const [hasResourceNotification] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [showToolbox, setShowToolbox] = useState(false)
  const [userInfo, setLocalUserInfo] = useState<{ id: string; name: string; avatar: string; avatarNew: string }>({
    id: '',
    name: '',
    avatar: '',
    avatarNew: '',
  })

  const navMainItems: NavItem[] = [
    { key: 'toolbox', label: '工具箱', iconType: 'toolbox' },
    { key: 'knowledge', label: '知识图谱', iconType: 'knowledge', routeName: '/app/knowledge-graph' },
    { key: 'exercise', label: '我的习题', iconType: 'exercise', routeName: '/app/exercise-solve' },
    { key: 'homework', label: '我的作业', iconType: 'homework', routeName: '/app/my-homework' },
    { key: 'mistake', label: '错题本', iconType: 'mistake', routeName: '/app/mistake-book' },
    { key: 'photoQa', label: '拍照答疑', iconType: 'photoQa', routeName: '/photo-search' },
  ]

  const navBottomItems: NavItem[] = [
    { key: 'resources', label: '资源下载', iconType: 'resources', routeName: '/app/my-resources' },
  ]

  const activeNavItem = useMemo(() => {
    const path = location.pathname
    if (path.includes('knowledge-graph')) return 'knowledge'
    if (path.includes('exercise-solve')) return 'exercise'
    if (path.includes('my-homework')) return 'homework'
    if (path.includes('mistake-book')) return 'mistake'
    if (path.includes('photo-search')) return 'photoQa'
    if (path.includes('my-resources')) return 'resources'
    return ''
  }, [location.pathname])

  const isNavItemActive = (key: string) => {
    if (key === 'toolbox') return showToolbox
    return activeNavItem === key
  }

  const mainViewStyle = useMemo(() => {
    const path = location.pathname
    if (path.includes('knowledge-graph')) return { background: '#271a43' }
    if (path.includes('exercise-solve')) return { background: 'linear-gradient(to bottom, #0f002e 50%, #edeffe 50%)' }
    if (path.includes('my-resources')) return { background: 'linear-gradient(to bottom, #ffffff 50%, #edeffe 50%)' }
    if (path.includes('my-homework')) return { background: 'linear-gradient(to bottom, #ffffff 50%, #f1f3ff 50%)' }
    if (path.includes('mistake-book')) return { background: 'linear-gradient(to bottom, #e9eaff 50%, #f7f7f7 50%)' }
    if (path.includes('photo-search')) return { background: 'linear-gradient(to bottom, #0f002e 50%, #f7f6ff 50%)' }
    return { background: '#3d3070' }
  }, [location.pathname])

  const hideFunctionMenu = useMemo(() => {
    const hideRoutes = ['homework-answer', 'pdf-viewer', 'html-viewer', 'video-viewer', 'html-preview', 'draft-notebook']
    return hideRoutes.some(route => location.pathname.includes(route))
  }, [location.pathname])

  useEffect(() => {
    const info = getUserInfo()
    if (info) {
      setLocalUserInfo({
        id: (info as any).id || '',
        name: (info as any).name || '',
        avatar: (info as any).avatar || '',
        avatarNew: (info as any).avatarNew || '',
      })
    }
  }, [])

  const handleAvatarClick = () => {
    setShowProfileDialog(true)
  }

  const handleLogout = () => {
    setShowProfileDialog(false)
    setXuebanToken(null)
    setYanbanToken(null)
    setUserInfo(null)
    navigate('/login')
  }

  const handleAvatarChanged = (newAvatar: string) => {
    const newInfo = { ...userInfo, avatarNew: newAvatar }
    setLocalUserInfo(newInfo)
    setUserInfo(newInfo as any)
  }

  const handleContentAreaClick = () => {
    if (showToolbox) {
      setShowToolbox(false)
    }
  }

  const handleNavItemClick = (item: NavItem) => {
    if (item.key === 'toolbox') {
      setShowToolbox(!showToolbox)
      return
    }
    if (item.routeName) {
      navigate(item.routeName)
    }
  }

  const getNavIcon = (item: NavItem) => {
    const active = isNavItemActive(item.key)
    switch (item.iconType) {
      case 'toolbox':
        return showToolbox ? toolBoxSelectIcon : toolBoxIcon
      case 'knowledge':
        return active ? knowledgeGraphSelectIcon : knowledgeGraphIcon
      case 'exercise':
        return active ? exerciseSelectIcon : exerciseIcon
      case 'homework':
        return active ? homeworkSelectIcon : homeworkIcon
      case 'mistake':
        return active ? mistakeBookSelectIcon : mistakeBookIcon
      case 'photoQa':
        return active ? photoQaSelectIcon : photoQaIcon
      case 'resources':
        return active ? downloadResourcesSelectIcon : downloadResourcesIcon
      default:
        return downloadResourcesIcon
    }
  }

  return (
    <div className="main-view">
      {!hideFunctionMenu && (
        <div className="function-menu" style={mainViewStyle}>
          <div className="nav-items-container">
            <div className="user-avatar" onClick={handleAvatarClick}>
              <img src={userInfo.avatarNew || userInfo.avatar || avatarIcon} alt="avatar" style={{ width: 40, height: 40 }} />
              <div className="user-name">{userInfo.name || '用户'}</div>
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
        {/* 工具箱区域 */}
        <div className={`toolbox-area ${showToolbox ? 'is-visible' : ''}`} onClick={(e) => e.stopPropagation()}>
          {showToolbox && <MyProfileView />}
        </div>

        <div className="content-area" onClick={handleContentAreaClick}>
          <Outlet />
        </div>
      </div>

      <ProfileDialog
        open={showProfileDialog}
        userId={userInfo.id}
        userName={userInfo.name}
        avatar={userInfo.avatarNew || userInfo.avatar}
        onClose={() => setShowProfileDialog(false)}
        onLogout={handleLogout}
      />
    </div>
  )
}

export default MainView
