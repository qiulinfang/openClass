import React, { useState, useRef } from 'react'
import './InteractiveCanvasView.css'

export interface CanvasItem {
  id: string
  x: number
  y: number
  content: string
  isEditing?: boolean
}

export const InteractiveCanvasView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'canvas' | 'chat'>('canvas')
  const [items, setItems] = useState<CanvasItem[]>([])
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    console.log('[InteractiveCanvasView] 放置元素')
  }

  const enableEdit = (item: CanvasItem) => {
    setItems(items.map(i => i.id === item.id ? { ...i, isEditing: true } : i))
  }

  const handleDragStart = (e: React.DragEvent, item: CanvasItem) => {
    console.log('[InteractiveCanvasView] 开始拖拽', item)
  }

  const handleTouchStart = (e: React.TouchEvent, item: CanvasItem) => {
    console.log('[InteractiveCanvasView] 触摸开始', item)
  }

  const handleTouchMove = (e: React.TouchEvent, item: CanvasItem) => {
    console.log('[InteractiveCanvasView] 触摸移动', item)
  }

  return (
    <div className="interactive-canvas-view">
      <div className="mobile-tabs">
        <button
          className={`tab-btn ${activeTab === 'canvas' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          onClick={() => setActiveTab('canvas')}
        >
          画布
        </button>
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          onClick={() => setActiveTab('chat')}
        >
          对话
        </button>
      </div>

      <main className={`canvas-main ${activeTab !== 'canvas' ? 'hidden-mobile show-desktop' : ''}`}>
        <header className="canvas-header">
          <h1 className="canvas-title">创意画布</h1>
          <span className="canvas-subtitle">支持拖拽与双击编辑</span>
        </header>

        <div
          ref={canvasRef}
          className="canvas-viewport"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {items.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="empty-text">从右侧划选内容拖拽至此处</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                draggable={!item.isEditing}
                onDoubleClick={() => enableEdit(item)}
                onDragStart={(e) => handleDragStart(e as any, item)}
                onTouchStart={(e) => handleTouchStart(e, item)}
                onTouchMove={(e) => handleTouchMove(e, item)}
                className={`canvas-item ${item.isEditing ? 'canvas-item-editing' : 'canvas-item-normal'}`}
                style={{ left: item.x, top: item.y }}
              >
                {item.isEditing ? (
                  <textarea
                    value={item.content}
                    className="item-editor"
                    autoFocus
                  />
                ) : (
                  <div className="item-content">{item.content}</div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      <aside className={`chat-sidebar ${activeTab !== 'chat' ? 'hidden-mobile show-desktop' : ''}`}>
        <div className="chat-placeholder">
          <span>对话面板</span>
        </div>
      </aside>
    </div>
  )
}

export default InteractiveCanvasView
