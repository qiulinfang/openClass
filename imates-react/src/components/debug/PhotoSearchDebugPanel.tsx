import React, { useState, useMemo } from 'react'
import './PhotoSearchDebugPanel.css'

export interface PhotoSearchDebugPanelProps {
  visible?: boolean
  onClose?: () => void
  
  // 环境信息
  isAndroid: boolean
  hasAndroidBridge: boolean
  
  // 视图状态
  showCameraPreview: boolean
  showCropView: boolean
  showDrawer: boolean
  activeTab: 'photo' | 'keyword'
  
  // 相机状态
  cameraStream: MediaStream | null
  videoElement: HTMLVideoElement | null
  
  // 图片状态
  currentImage: { file: File; preview: string; base64DataUrl?: string } | null
  imagePreview: string
  croppedImageBase64: string
  isFromGallery: boolean
  
  // 框选状态
  cropRect: { x: number; y: number; width: number; height: number } | null
  isCropping: boolean
  isDragging: boolean
  isResizing: boolean
  resizeHandle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null
  currentCursor: string
  
  // 缩放状态
  imageScale: number
  imageOffsetX: number
  imageOffsetY: number
  isPanning: boolean
  isPinching: boolean
  imageDrawInfo: {
    drawX: number
    drawY: number
    drawWidth: number
    drawHeight: number
    originalWidth: number
    originalHeight: number
  } | null
  
  // 搜索状态
  isSearching: boolean
  isKeywordSearching: boolean
  keywordText: string
  photoQuestionData: any
  keywordQuestionData: any
  
  // 其他状态
  selectedSubject: string | null
  splitterModel: number
  chatViewRef: any
  isChatLoading: boolean
}

export const PhotoSearchDebugPanel: React.FC<PhotoSearchDebugPanelProps> = ({
  visible = false,
  onClose,
  isAndroid,
  hasAndroidBridge,
  showCameraPreview,
  showCropView,
  showDrawer,
  activeTab,
  cameraStream,
  videoElement,
  currentImage,
  imagePreview,
  croppedImageBase64,
  isFromGallery,
  cropRect,
  isCropping,
  isDragging,
  isResizing,
  resizeHandle,
  currentCursor,
  imageScale,
  imageOffsetX,
  imageOffsetY,
  isPanning,
  isPinching,
  imageDrawInfo,
  isSearching,
  isKeywordSearching,
  keywordText,
  photoQuestionData,
  keywordQuestionData,
  selectedSubject,
  splitterModel,
  chatViewRef,
  isChatLoading,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['env', 'view', 'camera', 'image', 'crop', 'zoom', 'search', 'other'])
  )

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const cameraStreamInfo = useMemo(() => {
    if (!cameraStream) return null
    const tracks = cameraStream.getVideoTracks()
    if (tracks.length === 0) return '无视频轨道'
    const track = tracks[0]
    const settings = track.getSettings()
    return `分辨率: ${settings.width}x${settings.height}, 帧率: ${settings.frameRate || 'N/A'}fps`
  }, [cameraStream])

  const currentImageInfo = useMemo(() => {
    if (!currentImage) return null
    const file = currentImage.file
    return `名称: ${file.name}, 大小: ${(file.size / 1024).toFixed(2)}KB, 类型: ${file.type}`
  }, [currentImage])

  if (!visible) return null

  return (
    <div className="photo-search-debug-panel">
      <div className="debug-card">
        <div className="card-header">
          <span>🔧 调试面板</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="card-content">
          {/* 环境信息 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('env')}>
              <span>环境信息</span>
              <span className="arrow">{expandedSections.has('env') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('env') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">运行环境:</span>
                  <span className={`badge ${isAndroid ? 'success' : 'info'}`}>
                    {isAndroid ? 'Android' : 'Web'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">Android Bridge:</span>
                  <span className={`badge ${hasAndroidBridge ? 'success' : 'error'}`}>
                    {hasAndroidBridge ? '可用' : '不可用'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 视图状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('view')}>
              <span>视图状态</span>
              <span className="arrow">{expandedSections.has('view') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('view') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">相机预览:</span>
                  <span className={`badge ${showCameraPreview ? 'success' : 'grey'}`}>
                    {showCameraPreview ? '显示' : '隐藏'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">框选视图:</span>
                  <span className={`badge ${showCropView ? 'success' : 'grey'}`}>
                    {showCropView ? '显示' : '隐藏'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">抽屉:</span>
                  <span className={`badge ${showDrawer ? 'success' : 'grey'}`}>
                    {showDrawer ? '打开' : '关闭'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">当前标签页:</span>
                  <span className="badge info">{activeTab}</span>
                </div>
              </div>
            )}
          </div>

          {/* 相机状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('camera')}>
              <span>相机状态</span>
              <span className="arrow">{expandedSections.has('camera') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('camera') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">相机流:</span>
                  <span className={`badge ${cameraStream ? 'success' : 'grey'}`}>
                    {cameraStream ? '运行中' : '未运行'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">Video元素:</span>
                  <span className={`badge ${videoElement ? 'success' : 'grey'}`}>
                    {videoElement ? '存在' : '不存在'}
                  </span>
                </div>
                {cameraStreamInfo && (
                  <div className="debug-item">
                    <span className="debug-label">流信息:</span>
                    <div className="debug-value">{cameraStreamInfo}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 图片状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('image')}>
              <span>图片状态</span>
              <span className="arrow">{expandedSections.has('image') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('image') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">当前图片:</span>
                  <span className={`badge ${currentImage ? 'success' : 'grey'}`}>
                    {currentImage ? '有' : '无'}
                  </span>
                </div>
                {currentImageInfo && (
                  <div className="debug-item">
                    <span className="debug-label">图片信息:</span>
                    <div className="debug-value">{currentImageInfo}</div>
                  </div>
                )}
                <div className="debug-item">
                  <span className="debug-label">预览URL:</span>
                  <span className={`badge ${imagePreview ? 'success' : 'grey'}`}>
                    {imagePreview ? '有' : '无'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">裁剪图片:</span>
                  <span className={`badge ${croppedImageBase64 ? 'success' : 'grey'}`}>
                    {croppedImageBase64 ? '有' : '无'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">来源:</span>
                  <span className={`badge ${isFromGallery ? 'info' : 'secondary'}`}>
                    {isFromGallery ? '相册' : '相机'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 框选状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('crop')}>
              <span>框选状态</span>
              <span className="arrow">{expandedSections.has('crop') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('crop') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">框选区域:</span>
                  <span className={`badge ${cropRect ? 'success' : 'grey'}`}>
                    {cropRect ? '有' : '无'}
                  </span>
                </div>
                {cropRect && (
                  <div className="debug-item">
                    <span className="debug-label">位置:</span>
                    <div className="debug-value">
                      x: {Math.round(cropRect.x)}, y: {Math.round(cropRect.y)}, w: {Math.round(cropRect.width)}, h: {Math.round(cropRect.height)}
                    </div>
                  </div>
                )}
                <div className="debug-item">
                  <span className="debug-label">正在框选:</span>
                  <span className={`badge ${isCropping ? 'warning' : 'grey'}`}>
                    {isCropping ? '是' : '否'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">正在拖拽:</span>
                  <span className={`badge ${isDragging ? 'warning' : 'grey'}`}>
                    {isDragging ? '是' : '否'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">正在调整大小:</span>
                  <span className={`badge ${isResizing ? 'warning' : 'grey'}`}>
                    {isResizing ? '是' : '否'}
                  </span>
                </div>
                {resizeHandle && (
                  <div className="debug-item">
                    <span className="debug-label">调整手柄:</span>
                    <span className="badge secondary">{resizeHandle}</span>
                  </div>
                )}
                <div className="debug-item">
                  <span className="debug-label">光标样式:</span>
                  <span className="badge secondary">{currentCursor}</span>
                </div>
              </div>
            )}
          </div>

          {/* 缩放状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('zoom')}>
              <span>缩放状态</span>
              <span className="arrow">{expandedSections.has('zoom') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('zoom') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">缩放比例:</span>
                  <span className="badge secondary">{imageScale.toFixed(2)}</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">X偏移:</span>
                  <span className="badge secondary">{imageOffsetX.toFixed(0)}px</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">Y偏移:</span>
                  <span className="badge secondary">{imageOffsetY.toFixed(0)}px</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">正在平移:</span>
                  <span className={`badge ${isPanning ? 'warning' : 'grey'}`}>
                    {isPanning ? '是' : '否'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">正在捏合:</span>
                  <span className={`badge ${isPinching ? 'warning' : 'grey'}`}>
                    {isPinching ? '是' : '否'}
                  </span>
                </div>
                {imageDrawInfo && (
                  <div className="debug-item">
                    <span className="debug-label">绘制信息:</span>
                    <div className="debug-value">
                      drawX: {imageDrawInfo.drawX.toFixed(0)}, 
                      drawY: {imageDrawInfo.drawY.toFixed(0)}, 
                      drawW: {imageDrawInfo.drawWidth.toFixed(0)}, 
                      drawH: {imageDrawInfo.drawHeight.toFixed(0)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 搜索状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('search')}>
              <span>搜索状态</span>
              <span className="arrow">{expandedSections.has('search') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('search') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">拍照搜索中:</span>
                  <span className={`badge ${isSearching ? 'warning' : 'grey'}`}>
                    {isSearching ? '是' : '否'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">关键词搜索中:</span>
                  <span className={`badge ${isKeywordSearching ? 'warning' : 'grey'}`}>
                    {isKeywordSearching ? '是' : '否'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">关键词:</span>
                  <span className={`badge ${keywordText ? 'success' : 'grey'}`}>
                    {keywordText || '无'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">拍照题目数据:</span>
                  <span className={`badge ${photoQuestionData ? 'success' : 'grey'}`}>
                    {photoQuestionData ? '有' : '无'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">关键词题目数据:</span>
                  <span className={`badge ${keywordQuestionData ? 'success' : 'grey'}`}>
                    {keywordQuestionData ? '有' : '无'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 其他状态 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('other')}>
              <span>其他状态</span>
              <span className="arrow">{expandedSections.has('other') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('other') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">选中科目:</span>
                  <span className={`badge ${selectedSubject ? 'success' : 'grey'}`}>
                    {selectedSubject || '无'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">分屏比例:</span>
                  <span className="badge secondary">{splitterModel}%</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">ChatView引用:</span>
                  <span className={`badge ${chatViewRef ? 'success' : 'grey'}`}>
                    {chatViewRef ? '有' : '无'}
                  </span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">聊天加载中:</span>
                  <span className={`badge ${isChatLoading ? 'warning' : 'grey'}`}>
                    {isChatLoading ? '是' : '否'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotoSearchDebugPanel
