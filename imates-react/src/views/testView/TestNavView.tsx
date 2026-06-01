import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/base/Button'
import './TestNavView.css'

interface NavItem {
  title: string
  path: string
  icon: string
  category: string
  color: string
  description: string
}

interface Category {
  id: string
  label: string
  icon: string
}

const categories: Category[] = [
  { id: 'all', label: '全部模块', icon: '📁' },
  { id: 'render', label: '渲染引擎', icon: '✨' },
  { id: 'business', label: '业务流程', icon: '🔗' },
  { id: 'debug', label: '开发调试', icon: '🐞' },
  { id: 'component', label: '底层组件', icon: '🧩' }
]

const navItems: NavItem[] = [
  {
    title: 'Markdown 渲染测试',
    path: '/markdown-test',
    icon: '📝',
    category: 'render',
    color: '#3498db',
    description: '测试 Markdown 渲染效果，支持 LaTeX 公式、表格、代码块等实时预览。'
  },
  {
    title: 'API 接口调试',
    path: '/debug-api',
    icon: '📡',
    category: 'debug',
    color: '#e67e22',
    description: '系统内部 API 接口调试工具，方便验证后端接口数据返回。'
  },
  {
    title: '会话管理测试',
    path: '/chat-session-test',
    icon: '💬',
    category: 'business',
    color: '#9b59b6',
    description: '测试聊天会话的存储、同步以及消息流式输出效果。'
  },
  {
    title: 'Lottie 动画测试',
    path: '/lottie-test',
    icon: '🎞️',
    category: 'render',
    color: '#e91e63',
    description: '预览和调试系统中使用到的 Lottie 动画文件。'
  },
  {
    title: '基础渲染对比',
    path: '/render-test',
    icon: '⚖️',
    category: 'render',
    color: '#00bcd4',
    description: '对比不同渲染引擎（MathJax vs KaTeX）在处理 LaTeX 时的表现。'
  },
  {
    title: '老师端功能调试',
    path: '/teacher-debug',
    icon: '👨‍🏫',
    category: 'business',
    color: '#4caf50',
    description: '专门用于模拟和调试老师端（WebSocket）下发消息和指令。'
  },
  {
    title: '习题组件测试',
    path: '/test-exercise',
    icon: '✍️',
    category: 'component',
    color: '#795548',
    description: '测试各类习题（选择、填空、判断）在不同数据下的渲染和交互。'
  }
]

const TestNavView: React.FC = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredItems = useMemo(() => {
    return navItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchText.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchText.toLowerCase())
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [searchText, activeCategory])

  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return navItems.length
    return navItems.filter(item => item.category === catId).length
  }

  const getCategoryLabel = (catId: string) => {
    return categories.find(c => c.id === catId)?.label || catId
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="test-dashboard-view">
      <div className="bg-decoration">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="dashboard-container">
        <aside className="sidebar-panel">
          <div className="sidebar-header">
            <span style={{ fontSize: '32px' }}>💻</span>
            <div className="text-h6">DevConsole</div>
          </div>

          <nav className="sidebar-nav">
            {categories.map(cat => (
              <div 
                key={cat.id}
                className={`nav-item ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span style={{ marginRight: '12px' }}>{cat.icon}</span>
                <span>{cat.label}</span>
                {getCategoryCount(cat.id) > 0 && (
                  <span className="category-count">{getCategoryCount(cat.id)}</span>
                )}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <Button 
              label="返回首页" 
              variant="ghost"
              className="full-width"
              onClick={() => navigate('/')}
            />
          </div>
        </aside>

        <main className="main-panel">
          <header className="header-toolbar">
            <div className="header-left">
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>测试页面导航</h1>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>系统测试与调试中心 · V1.0.4</p>
            </div>
            
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                ref={searchInputRef}
                className="search-input"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索测试模块... (/)"
              />
            </div>
          </header>

          <div className="scroll-area">
            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍❌</div>
                <div style={{ fontSize: '1.25rem' }}>未找到匹配的测试模块</div>
              </div>
            ) : (
              <div className="grid-container">
                {filteredItems.map((item, index) => (
                  <div 
                    key={item.path} 
                    className="animated-item"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="glass-card" onClick={() => navigate(item.path)}>
                      <div className="card-glow" style={{ background: item.color }}></div>
                      <div className="card-header">
                        <div className="icon-wrapper" style={{ background: `${item.color}15`, color: item.color }}>
                          {item.icon}
                        </div>
                        <span className="category-badge">{getCategoryLabel(item.category)}</span>
                      </div>
                      
                      <div className="card-title">{item.title}</div>
                      <div className="description">{item.description}</div>
                      
                      <div className="card-footer">
                        <div className="status-indicator">
                          <div className="dot active"></div>
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>稳定版</span>
                        </div>
                        <span className="enter-icon">➡️</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default TestNavView
