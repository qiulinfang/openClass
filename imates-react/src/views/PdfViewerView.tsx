import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DrawingBoard } from '@/components/drawing/DrawingBoard'
import '@/views/PdfViewerView.css'

export const PdfViewerView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [splitterModel] = useState(60)
  const [selectedTool] = useState('pan')
  const [chatPanelVisible] = useState(true)
  const [isHorizontalReading] = useState(false)

  const pdfUrl = searchParams.get('url') || ''

  const toolStates = {
    undo: false,
    redo: false,
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleToolChange = (tool: string) => {
    console.log('[PdfViewerView] 工具切换', tool)
  }

  const handleSearch = () => {
    console.log('[PdfViewerView] 搜索')
  }

  const handleHelp = () => {
    console.log('[PdfViewerView] 帮助')
  }

  const handleUndo = () => {
    console.log('[PdfViewerView] 撤销')
  }

  const handleRedo = () => {
    console.log('[PdfViewerView] 重做')
  }

  const setVerticalReading = () => {
    console.log('[PdfViewerView] 纵向阅读')
  }

  const setHorizontalReading = () => {
    console.log('[PdfViewerView] 横向阅读')
  }

  return (
    <div className="content-layout">
      <div className="pdf-viewer-container">
        <div className="pdf-toolbar">
          <button className="back-btn" onClick={handleGoBack}>
            <img src="/icons/goback.svg" alt="返回" />
          </button>
          <div className="toolbar-tools">
            <button className={`tool-btn ${selectedTool === 'pan' ? 'active' : ''}`} onClick={() => handleToolChange('pan')}>
              手型
            </button>
            <button className={`tool-btn ${selectedTool === 'screenshot' ? 'active' : ''}`} onClick={() => handleToolChange('screenshot')}>
              截图
            </button>
            <button className={`tool-btn ${selectedTool === 'mark' ? 'active' : ''}`} onClick={() => handleToolChange('mark')}>
              标记
            </button>
          </div>
          <div className="direction-toggle">
            <button className={`direction-btn ${!isHorizontalReading ? 'active' : ''}`} onClick={setVerticalReading}>
              纵向
            </button>
            <button className={`direction-btn ${isHorizontalReading ? 'active' : ''}`} onClick={setHorizontalReading}>
              横向
            </button>
          </div>
        </div>

        <div className="pdf-content">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="pdf-iframe" title="PDF Viewer" />
          ) : (
            <div className="pdf-placeholder">
              <span>加载PDF文件...</span>
            </div>
          )}
        </div>
      </div>

      {chatPanelVisible && (
        <div className="chat-panel">
          <div className="chat-placeholder">
            <span>对话面板</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfViewerView
