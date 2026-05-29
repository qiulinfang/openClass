import React, { useState, useMemo, useEffect } from 'react'
import '@/components/pdf/PdfNoteAnchor.css'

export interface PdfNoteAnchorProps {
  mode: 'marker' | 'create' | 'display'
  // 坐标归一化 [0,1]
  x: number
  y: number
  pageLayout: { width: number; height: number }
  // 展示模式下的文本和激活状态
  text?: string
  active?: boolean
  // 是否显示输入卡片
  inlineActive?: boolean
  modelValue?: string
  onConfirm?: (text: string) => void
  onCancel?: () => void
  onMarkerClick?: () => void
  onUpdateModelValue?: (val: string) => void
}

export const PdfNoteAnchor: React.FC<PdfNoteAnchorProps> = ({
  mode,
  x,
  y,
  pageLayout,
  text = '',
  active = false,
  inlineActive = false,
  modelValue = '',
  onConfirm,
  onCancel,
  onMarkerClick,
  onUpdateModelValue,
}) => {
  // 内联输入气泡展开状态：仅在 create 模式下生效
  const [isOpen, setIsOpen] = useState(mode === 'create' && !!inlineActive)

  useEffect(() => {
    if (mode === 'create') {
      setIsOpen(!!inlineActive)
    }
  }, [inlineActive, mode])

  // 从 localStorage 中获取当前用户信息
  const userInitial = useMemo(() => {
    try {
      const raw = localStorage.getItem('userInfo')
      if (raw) {
        const userInfo = JSON.parse(raw)
        const name: string | undefined = userInfo?.name
        if (name && name.length > 0) {
          return name.charAt(0)
        }
      }
    } catch (e) {
      console.warn('[PdfNoteAnchor] 解析 userInfo 失败', e)
    }
    return 'G'
  }, [])

  const markerStyle = {
    position: 'absolute' as const,
    left: `${x * pageLayout.width}px`,
    top: `${y * pageLayout.height}px`,
  }

  const tooltipStyle = {
    position: 'absolute' as const,
    left: `${x * pageLayout.width}px`,
    top: `${y * pageLayout.height - 8}px`,
  }

  const handleMarkerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (mode === 'create') {
      // 新增模式：点击锚点展开/收起输入卡片
      setIsOpen(!isOpen)
      return
    }
    // marker/display 模式：点击锚点仅通知父组件
    onMarkerClick?.()
  }

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    onConfirm?.(modelValue.trim())
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    onCancel?.()
  }

  return (
    <div>
      {/* 笔记锚点标记 */}
      <div
        className="note-marker"
        style={markerStyle}
        onClick={handleMarkerClick}
      >
        <img src="/icons/bubbles.svg" alt="note" className="note-marker-icon" />
        <span className="note-marker-initial">{userInitial}</span>
      </div>

      {/* 内联新增输入气泡（create 模式才渲染，display/marker 模式不显示输入） */}
      {mode === 'create' && isOpen && (
        <div className="note-tooltip" style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
          <div className="note-input-card">
            <textarea
              className="note-textarea"
              value={modelValue}
              onChange={(e) => onUpdateModelValue?.(e.target.value)}
              autoFocus
              placeholder="输入笔记"
            />
            <div className="note-input-actions">
              <button className="action-btn confirm" onClick={handleConfirm}>
                <span className="material-icons" style={{ fontSize: '16px' }}>check</span>
              </button>
              <button className="action-btn cancel" onClick={handleCancel}>
                <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 已保存笔记提示卡片（display 模式且 active 时渲染） */}
      {mode === 'display' && active && (
        <div className="note-tooltip" style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
          <div className="note-input-card">
            <div className="note-display-text">{text || '暂无内容'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfNoteAnchor
