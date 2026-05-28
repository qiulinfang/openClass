import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './MyFavoritesView.css'

export interface FavoriteSession {
  id?: string
  session: {
    sessionName?: string
    [key: string]: any
  }
  timestamp?: string
}

export interface FavoriteExercise {
  id?: string
  question?: string
  timestamp?: string
}

export const MyFavoritesView: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'session' | 'exercise'>('session')
  const [isLoadingQa] = useState(false)
  const [isLoadingExercise] = useState(false)
  const [qaFavorites] = useState<FavoriteSession[]>([])
  const [exerciseFavorites] = useState<FavoriteExercise[]>([])

  const navItems = [
    { label: '会话收藏', value: 'session' },
    { label: '练习收藏', value: 'exercise' },
  ]

  const goBack = () => {
    navigate(-1)
  }

  const handleQaRefresh = () => {
    console.log('[MyFavoritesView] 刷新会话收藏')
  }

  const handleExerciseRefresh = () => {
    console.log('[MyFavoritesView] 刷新练习收藏')
  }

  const handleSessionFavoriteClick = (session: any) => {
    console.log('[MyFavoritesView] 点击会话收藏', session)
  }

  const handleExerciseFavoriteClick = (exercise: any) => {
    console.log('[MyFavoritesView] 点击练习收藏', exercise)
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleDateString()
  }

  const renderContent = (content?: string) => {
    return content || ''
  }

  return (
    <div className="my-favorites-view">
      <div className="toolbar">
        <div className="back-btn" onClick={goBack}>
          <img src="/icons/goback.svg" alt="返回" className="back-icon" />
        </div>
        <div className="nav-items">
          {navItems.map((item) => (
            <div
              key={item.value}
              className={`nav-item ${activeTab === item.value ? 'active' : ''}`}
              onClick={() => setActiveTab(item.value as 'session' | 'exercise')}
            >
              {item.label}
            </div>
          ))}
        </div>
        <div className="placeholder"></div>
      </div>

      <div className="content-area">
        {activeTab === 'session' && (
          <div className="list-container">
            {qaFavorites.length === 0 && !isLoadingQa ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" width="80" height="80" fill="#ccc">
                  <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
                </svg>
                <div className="empty-title">暂无会话收藏</div>
                <div className="empty-desc">收藏的会话将显示在这里</div>
              </div>
            ) : (
              <div className="favorites-list">
                {qaFavorites.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="favorite-card qa-card"
                    onClick={() => handleSessionFavoriteClick(item.session)}
                  >
                    <div className="card-content">
                      <div className="card-text" dangerouslySetInnerHTML={{ __html: renderContent(item.session.sessionName) }} />
                      <div className="card-timestamp">{formatTimestamp(item.timestamp)}</div>
                    </div>
                    <div className="card-actions"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercise' && (
          <div className="list-container">
            {exerciseFavorites.length === 0 && !isLoadingExercise ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" width="80" height="80" fill="#ccc">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <div className="empty-title">暂无练习收藏</div>
                <div className="empty-desc">收藏的练习将显示在这里</div>
              </div>
            ) : (
              <div className="favorites-list">
                {exerciseFavorites.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="favorite-card exercise-card"
                    onClick={() => handleExerciseFavoriteClick(item)}
                  >
                    <div className="card-content">
                      <div className="card-text">{item.question || '练习题目'}</div>
                      <div className="card-timestamp">{formatTimestamp(item.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyFavoritesView
