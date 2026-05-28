import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './PhotoSearchView.css'

export const PhotoSearchView: React.FC = () => {
  const navigate = useNavigate()
  const [showDebugPanel] = useState(false)
  const [activeTab] = useState('camera')
  const [isSearching] = useState(false)
  const [currentImage] = useState<string | null>(null)
  const [showCameraPreview] = useState(true)
  const [searchResults] = useState<any[]>([])

  const handleClose = () => {
    navigate(-1)
  }

  const handleCapture = () => {
    console.log('[PhotoSearchView] 拍照')
  }

  const handleSelectFromGallery = () => {
    console.log('[PhotoSearchView] 从相册选择')
  }

  const handleSearch = () => {
    console.log('[PhotoSearchView] 搜索')
  }

  const handleRetake = () => {
    console.log('[PhotoSearchView] 重拍')
  }

  return (
    <div className="photo-search-fullscreen">
      <button className="back-btn" onClick={handleClose}>
        <img src="/icons/goback.svg" alt="返回" className="back-icon" />
      </button>

      {showDebugPanel && (
        <div className="debug-panel">
          <span>调试面板</span>
        </div>
      )}

      <div className="camera-preview-area">
        {showCameraPreview ? (
          <div className="camera-preview">
            <div className="camera-placeholder">
              <span>相机预览</span>
            </div>
          </div>
        ) : currentImage ? (
          <div className="image-preview">
            <img src={currentImage} alt="预览" className="preview-image" />
          </div>
        ) : null}
      </div>

      <div className="search-controls">
        {activeTab === 'camera' && !currentImage && (
          <div className="capture-controls">
            <button className="gallery-btn" onClick={handleSelectFromGallery}>
              相册
            </button>
            <button className="capture-btn" onClick={handleCapture}>
              <div className="capture-inner"></div>
            </button>
            <button className="flash-btn">
              ⚡
            </button>
          </div>
        )}

        {currentImage && (
          <div className="search-actions">
            <button className="retake-btn" onClick={handleRetake}>
              重拍
            </button>
            <button className="search-btn" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? '搜索中...' : '搜题'}
            </button>
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <span>搜索结果</span>
          </div>
          <div className="results-list">
            {searchResults.map((result, index) => (
              <div key={index} className="result-item">
                <span>{result.title || '题目'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotoSearchView
