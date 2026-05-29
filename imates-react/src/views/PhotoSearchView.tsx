import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './PhotoSearchView.css'

// 导入组件
import { ImageCropper } from '@/components/base/ImageCropper'
import { ImagePicker } from '@/components/chat/Input/ImagePicker'
import { PhotoSearchDebugPanel } from '@/components/debug/PhotoSearchDebugPanel'
import { ChatView } from '@/components/ChatView'
import Textarea from '@/components/base/Textarea'

// 导入服务与工具
import { apiService } from '../services/http/api-service'
import { ImagePickerAdapterFactory } from '../adapters/ImagePickerAdapterFactory'
import { showMessage } from '../utils'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { toggleExerciseFavorite, getFavoriteExercises } from '../utils/storage/favorites'
import { useQuestionStore } from '../stores/questionStore'

// 导入图标
import goBackIcon from '/icons/goback.svg'
import searchMathIcon from '/icons/searchMath.svg'
import searchBioIcon from '/icons/searchBio.svg'
import albumIcon from '/icons/Album.svg'
import cameraIcon from '/icons/camera.svg'
import zaipaiyitiIcon from '/icons/zaipaiyiti.svg'
import jiarulianxiIcon from '/icons/jiarulianxi.svg'
import shoucangIcon from '/icons/shoucang1.svg'
import xingxingLightIcon from '/icons/xingxing-light.svg'
import jiarulianxiLightIcon from '/icons/jiarulianxi-light.svg'

import type { ExerciseItem } from '../types'

export const PhotoSearchView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { renderMessageContent } = useMessageRenderer()
  const { questions, fetchQuestions, clearCurrentQuestion } = useQuestionStore()

  // 状态管理 (完全对齐 Vue)
  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    const subject = searchParams.get('subject')
    return (subject === 'math' || subject === 'biology') ? subject : 'math'
  })
  const [showCameraPreview, setShowCameraPreview] = useState(true)
  const [showCropView, setShowCropView] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [photoQuestionData, setPhotoQuestionData] = useState<ExerciseItem | null>(null)
  const [keywordQuestionData, setKeywordQuestionData] = useState<ExerciseItem | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [croppedImageBase64, setCroppedImageBase64] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'photo' | 'keyword'>('photo')
  const [keywordText, setKeywordText] = useState<string>('')
  const [isKeywordSearching, setIsKeywordSearching] = useState(false)
  const [showAddToPracticeDialog, setShowAddToPracticeDialog] = useState(false)
  const [favoriteStatusMap, setFavoriteStatusMap] = useState<Map<string, boolean>>(new Map())
  
  // 框选与缩放相关状态 (复刻 Vue)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null>(null)
  const [currentCursor, setCurrentCursor] = useState('crosshair')
  const [imageScale, setImageScale] = useState(1)
  const [imageOffsetX, setImageOffsetX] = useState(0)
  const [imageOffsetY, setImageOffsetY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [isPinching, setIsPinching] = useState(false)
  const [imageDrawInfo, setImageDrawInfo] = useState<{
    drawX: number
    drawY: number
    drawWidth: number
    drawHeight: number
    originalWidth: number
    originalHeight: number
  } | null>(null)
  
  const [splitterModel, setSplitterModel] = useState(50)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [showCropPreviewPanel, setShowCropPreviewPanel] = useState(true)
  const [cropPreviewImage, setCropPreviewImage] = useState<string>('')

  const isFromGallery = useRef(false)
  const cameraPromise = useRef<Promise<MediaStream | null> | null>(null)
  const isComponentMounted = useRef(true)
  const videoElement = useRef<HTMLVideoElement | null>(null)
  const cameraStream = useRef<MediaStream | null>(null)
  const chatViewRef = useRef<any>(null)

  // 环境判断
  const isDev = useMemo(() => import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV, [])
  const isAndroid = useMemo(() => ImagePickerAdapterFactory.getEnvironment() === 'android', [])
  const hasAndroidBridge = useMemo(() => typeof window !== 'undefined' && typeof (window as any).AndroidBridge !== 'undefined', [])
  const adapter = useMemo(() => ImagePickerAdapterFactory.getAdapter(), [])

  // 监听 searchParams 中的 subject 变化 (完全对齐 Vue)
  useEffect(() => {
    const subject = searchParams.get('subject')
    if (subject === 'math' || subject === 'biology') {
      setSelectedSubject(subject)
    }
  }, [searchParams])

  // 收藏状态初始化
  const initFavoriteStatus = useCallback(() => {
    const favorites = getFavoriteExercises()
    const map = new Map<string, boolean>()
    favorites.forEach((f) => {
      map.set(f.item.id, true)
    })
    setFavoriteStatusMap(map)
  }, [])

  useEffect(() => {
    initFavoriteStatus()
  }, [initFavoriteStatus])

  // 等待视频尺寸就绪 (移植自 Vue)
  const waitForVideoSize = useCallback(async (el: HTMLVideoElement) => {
    if (el.videoWidth > 0 && el.videoHeight > 0) return true
    return await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 1200)
      const done = () => {
        window.clearTimeout(timeout)
        resolve(true)
      }
      el.addEventListener('loadedmetadata', done, { once: true })
      el.addEventListener('canplay', done, { once: true })
    })
  }, [])

  // 相机控制
  const startCamera = useCallback(async () => {
    if (cameraPromise.current) return cameraPromise.current

    cameraPromise.current = (async () => {
      if (isAndroid) {
        try {
          if (!(window as any).AndroidBridge) throw new Error('Android Bridge not available')
          ;(window as any).AndroidBridge.startNativeCameraPreview()
          if (isComponentMounted.current) setShowCameraPreview(true)
          return null
        } catch (error) {
          console.error('启动Android原生相机预览失败:', error)
          showMessage('无法启动相机预览，请检查权限设置', 'warning')
          if (isComponentMounted.current) setShowCameraPreview(false)
          throw error
        }
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          })
          
          if (!isComponentMounted.current) {
            stream.getTracks().forEach(t => t.stop())
            return null
          }

          cameraStream.current = stream
          if (isComponentMounted.current) setShowCameraPreview(true)
          
          await new Promise(resolve => setTimeout(resolve, 50))

          if (videoElement.current) {
            videoElement.current.srcObject = stream
          }
          return stream
        } catch (error) {
          console.error('启动相机失败:', error)
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('相机启动被中止，通常是由于并发请求或硬件占用')
          } else {
            showMessage('无法访问相机，请检查权限设置', 'warning')
            if (isComponentMounted.current) setShowCameraPreview(false)
          }
          throw error
        } finally {
          cameraPromise.current = null
        }
      }
    })()

    return cameraPromise.current
  }, [isAndroid])

  const stopCamera = useCallback(() => {
    if (isAndroid) {
      try {
        if ((window as any).AndroidBridge) {
          ;(window as any).AndroidBridge.stopNativeCameraPreview()
        }
      } catch (error) {
        console.error('停止Android原生相机预览失败:', error)
      }
    } else {
      if (cameraStream.current) {
        cameraStream.current.getTracks().forEach((track) => track.stop())
        cameraStream.current = null
      }
      if (videoElement.current) {
        videoElement.current.srcObject = null
      }
    }
  }, [isAndroid])

  const bindStreamToVideoElement = useCallback(async () => {
    if (isAndroid || !cameraStream.current) return
    
    // 等待一小会儿，确保 React 把 <video> 元素渲染出来并挂载到 ref (避免异步渲染造成的绑定黑屏)
    if (!videoElement.current) {
      await new Promise((resolve) => setTimeout(resolve, 80))
    }

    const el = videoElement.current
    if (!el) return

    if (el.srcObject !== cameraStream.current) {
      el.srcObject = cameraStream.current
    }
    try {
      await el.play()
    } catch { /* ignore */ }
  }, [isAndroid])

  const ensureWebCameraReady = useCallback(async () => {
    if (isAndroid) return
    if (!cameraStream.current) {
      await startCamera()
    }
    await bindStreamToVideoElement()
    const el = videoElement.current
    if (!el) return
    const ok = await waitForVideoSize(el)
    if (ok) return
    stopCamera()
    setShowCameraPreview(true)
    try {
      await startCamera()
      await bindStreamToVideoElement()
    } catch (e) {
      console.error('[Camera] 重启恢复失败:', e)
    }
  }, [isAndroid, startCamera, bindStreamToVideoElement, stopCamera, waitForVideoSize])

  const captureFromCamera = useCallback(async (): Promise<string | null> => {
    if (isAndroid) {
      return new Promise((resolve, reject) => {
        if (!(window as any).AndroidBridge) {
          reject(new Error('Android Bridge not available'))
          return
        }
        const callbackId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        let timeoutId: any = null

        const successHandler = (id: string, base64Data: string) => {
          if (id === callbackId) {
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            if ((window as any).onNativeCameraCaptureSuccess === successHandler) {
              delete (window as any).onNativeCameraCaptureSuccess
            }
            if ((window as any).onNativeCameraCaptureFailed === errorHandler) {
              delete (window as any).onNativeCameraCaptureFailed
            }
            resolve(base64Data)
          }
        }
        const errorHandler = (id: string, error: string) => {
          if (id === callbackId) {
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            if ((window as any).onNativeCameraCaptureSuccess === successHandler) {
              delete (window as any).onNativeCameraCaptureSuccess
            }
            if ((window as any).onNativeCameraCaptureFailed === errorHandler) {
              delete (window as any).onNativeCameraCaptureFailed
            }
            reject(new Error(error))
          }
        }
        ;(window as any).onNativeCameraCaptureSuccess = successHandler
        ;(window as any).onNativeCameraCaptureFailed = errorHandler

        // 设置10秒超时 (对齐 Vue)
        timeoutId = setTimeout(() => {
          if ((window as any).onNativeCameraCaptureSuccess === successHandler) {
            delete (window as any).onNativeCameraCaptureSuccess
          }
          if ((window as any).onNativeCameraCaptureFailed === errorHandler) {
            delete (window as any).onNativeCameraCaptureFailed
          }
          reject(new Error('拍照超时'))
        }, 10000)

        try {
          ;(window as any).AndroidBridge.capturePhotoFromNative(callbackId)
        } catch (error) {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          if ((window as any).onNativeCameraCaptureSuccess === successHandler) {
            delete (window as any).onNativeCameraCaptureSuccess
          }
          if ((window as any).onNativeCameraCaptureFailed === errorHandler) {
            delete (window as any).onNativeCameraCaptureFailed
          }
          reject(error)
        }
      })
    } else {
      await ensureWebCameraReady()
      if (!videoElement.current) return null
      const el = videoElement.current
      if (!el.videoWidth || !el.videoHeight) return null
      const canvas = document.createElement('canvas')
      canvas.width = el.videoWidth
      canvas.height = el.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(el, 0, 0)
      return canvas.toDataURL('image/jpeg', 0.9)
    }
  }, [isAndroid, ensureWebCameraReady])

  const [currentImage, setCurrentImage] = useState<{
    file: File
    preview: string
    base64DataUrl?: string
  } | null>(null)

  const handleCapturePhoto = useCallback(async () => {
    if (!selectedSubject) {
      showMessage('请先选择学科', 'warning')
      return
    }
    try {
      const base64DataUrl = await captureFromCamera()
      if (!base64DataUrl) {
        showMessage('拍照失败', 'error')
        return
      }
      const file = await base64ToFile(base64DataUrl, 'photo.jpg')
      setCurrentImage({ file, preview: base64DataUrl, base64DataUrl })
      setImagePreview(base64DataUrl)
      isFromGallery.current = false
      setShowCameraPreview(false)
      setShowCropView(true)
    } catch (error) {
      console.error('拍照处理失败:', error)
      showMessage('拍照处理失败', 'error')
    }
  }, [selectedSubject, captureFromCamera])

  const handleSelectFromGallery = useCallback(async () => {
    if (!selectedSubject) {
      showMessage('请先选择学科', 'warning')
      return
    }
    try {
      const imageInfo = await adapter.selectFromGallery()
      if (imageInfo && imageInfo.base64DataUrl) {
        stopCamera()
        setShowCameraPreview(false)
        const file = await base64ToFile(imageInfo.base64DataUrl, 'photo.jpg')
        setCurrentImage({ file, preview: imageInfo.base64DataUrl, base64DataUrl: imageInfo.base64DataUrl })
        setImagePreview(imageInfo.base64DataUrl)
        isFromGallery.current = true
        setShowCropView(true)
      }
    } catch (error) {
      console.error('选择图片失败:', error)
      showMessage('选择图片失败', 'error')
    }
  }, [selectedSubject, adapter, stopCamera])

  const handleCropConfirm = useCallback(async (croppedDataUrl: string) => {
    if (!selectedSubject) {
      showMessage('请先选择学科', 'warning')
      return
    }
    try {
      setIsSearching(true)
      setShowCropView(false)
      setCroppedImageBase64(croppedDataUrl)
      const croppedFile = await base64ToFile(croppedDataUrl, 'cropped.jpg')
      if (!selectedSubject) return
      const question = await apiService.recognizeImage(croppedFile, selectedSubject)
      if (question) {
        setPhotoQuestionData(question)
        setShowDrawer(true)
        setActiveTab('photo')
      } else {
        showMessage('未识别到题目', 'warning')
      }
    } catch (error) {
      console.error('图片识别失败:', error)
      showMessage('图片识别失败', 'error')
    } finally {
      setIsSearching(false)
    }
  }, [selectedSubject])

  // 渲染题目内容 (对齐 Vue)
  const renderQuestionContent = useCallback((question: ExerciseItem) => {
    const content = question.question || question.title || ''
    return renderMessageContent(content)
  }, [renderMessageContent])

  const handleRetake = useCallback(async () => {
    setCurrentImage(null)
    setImagePreview('')
    setShowCropView(false)
    setShowDrawer(false)
    setPhotoQuestionData(null)
    setCropRect(null)
    setCropPreviewImage('')
    
    // 重置缩放与绘制相关状态 (完全对齐 Vue)
    setImageScale(1)
    setImageOffsetX(0)
    setImageOffsetY(0)
    setIsPanning(false)
    setIsPinching(false)
    setImageDrawInfo(null)
    setShowCropPreviewPanel(true)
    
    setShowCameraPreview(true)
    await startCamera()
  }, [startCamera])

  const handleKeywordSearch = useCallback(async () => {
    if (!keywordText.trim()) {
      showMessage('请输入题目关键字再搜索', 'warning')
      return
    }
    try {
      setIsKeywordSearching(true)
      if (!selectedSubject) return
      const question = await apiService.searchQuestionByText(keywordText.trim(), selectedSubject)
      if (question) {
        setKeywordQuestionData(question)
        if (!showDrawer) setShowDrawer(true)
      } else {
        showMessage('未搜索到相关题目', 'warning')
      }
    } catch (error) {
      console.error('关键词搜索失败:', error)
      showMessage('关键词搜索失败', 'error')
    } finally {
      setIsKeywordSearching(false)
    }
  }, [keywordText, selectedSubject, showDrawer])

  const currentQuestionData = useMemo(() => {
    return activeTab === 'photo' ? photoQuestionData : keywordQuestionData
  }, [activeTab, photoQuestionData, keywordQuestionData])

  const isFavoriteInChat = useMemo(() => {
    if (currentQuestionData) {
      return favoriteStatusMap.get(currentQuestionData.id) ?? false
    }
    return false
  }, [currentQuestionData, favoriteStatusMap])

  const isInPracticeList = useMemo(() => {
    if (!currentQuestionData) return false
    const currentId = currentQuestionData.bmNo || currentQuestionData.id
    return questions.some((q) => (q.bmNo || q.id) === currentId)
  }, [currentQuestionData, questions])

  const handleFavoriteInChat = useCallback(() => {
    if (!currentQuestionData) {
      showMessage('没有可收藏的题目', 'warning')
      return
    }
    const wasFavorite = isFavoriteInChat
    const success = toggleExerciseFavorite(currentQuestionData)
    if (success) {
      setFavoriteStatusMap(prev => {
        const next = new Map(prev)
        next.set(currentQuestionData.id, !wasFavorite)
        return next
      })
      showMessage(!wasFavorite ? '已收藏' : '已取消收藏', 'success')
    } else {
      showMessage('操作失败，请重试', 'error')
    }
  }, [currentQuestionData, isFavoriteInChat])

  const handleAddToPracticeInChat = useCallback(async () => {
    if (!currentQuestionData) {
      showMessage('没有可操作的题目', 'warning')
      return
    }
    const currentId = currentQuestionData.bmNo || currentQuestionData.id
    if (!currentId) return

    try {
      if (isInPracticeList) {
        const matched = questions.find((q) => (q.bmNo || q.id) === currentId)
        const deleteId = matched?.id || matched?.bmNo || currentId
        if (!selectedSubject) return
        const success = await apiService.deleteExercise(deleteId, selectedSubject)
        if (success) {
          showMessage('已从练习列表中移除', 'success')
          // 立即从本地列表中移除该题目（Immutable 方式），确保 isInPracticeList 立即更新 (对齐 Vue 零延迟反馈)
          const updatedQuestions = questions.filter((q) => (q.bmNo || q.id) !== currentId)
          useQuestionStore.setState({ questions: updatedQuestions, hasQuestions: updatedQuestions.length > 0 })
          await fetchQuestions(selectedSubject, false)
        }
      } else {
        const existingIds = questions.map((q) => q.bmNo || q.id)
        if (!existingIds.includes(currentId)) existingIds.push(currentId)
        const exercisesId = existingIds.join(',')
        if (!selectedSubject) return
        const response = await apiService.addQuestionToList({ ...currentQuestionData, exercisesId }, selectedSubject)
        if (response.success) {
          showMessage('题目已添加到练习列表', 'success')
          await fetchQuestions(selectedSubject, false)
          setShowAddToPracticeDialog(true)
        }
      }
    } catch (error) {
      console.error('操作题目失败:', error)
      showMessage('操作失败', 'error')
    }
  }, [currentQuestionData, isInPracticeList, questions, fetchQuestions, selectedSubject])

  const handleCloseDrawer = useCallback(async () => {
    const wasFromGallery = isFromGallery.current
    setShowDrawer(false)
    setActiveTab('photo')
    setKeywordText('')
    
    // 重置相关状态 (完全对齐 Vue)
    setShowCropView(false)
    setCurrentImage(null)
    setImagePreview('')
    setPhotoQuestionData(null)
    setKeywordQuestionData(null)
    setCropRect(null)
    setCropPreviewImage('')
    setCroppedImageBase64('')
    setImageDrawInfo(null)
    setShowCameraPreview(true)

    if (wasFromGallery || (!isAndroid && !cameraStream.current)) {
      await startCamera()
      isFromGallery.current = false
    } else {
      await bindStreamToVideoElement()
    }
  }, [isAndroid, startCamera, bindStreamToVideoElement])

  const handleClose = useCallback(() => {
    stopCamera()
    navigate(-1)
  }, [stopCamera, navigate])

  const handleSendSuggestionInPhotoSearch = useCallback((message: string) => {
    if (chatViewRef.current?.sendMessage) {
      chatViewRef.current.sendMessage(message)
    }
  }, [])

  useEffect(() => {
    isComponentMounted.current = true
    startCamera().catch(() => {})
    return () => {
      isComponentMounted.current = false
      stopCamera()
      clearCurrentQuestion()
    }
  }, [startCamera, stopCamera, clearCurrentQuestion])

  return (
    <div className="photo-search-fullscreen">
      {/* 左上角返回按钮 */}
      <button className="back-btn" onClick={handleClose}>
        <img src={goBackIcon} alt="返回" className="back-icon" />
      </button>

      {/* 调试面板切换按钮 */}
      {isDev && (
        <button 
          className="debug-toggle-btn"
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          style={{ background: showDebugPanel ? '#7a55ff' : 'rgba(0,0,0,0.5)' }}
        >
          🐞 调试
        </button>
      )}

      {/* 调试面板 */}
      {showDebugPanel && (
        <PhotoSearchDebugPanel
          visible={showDebugPanel}
          onClose={() => setShowDebugPanel(false)}
          isAndroid={isAndroid}
          hasAndroidBridge={hasAndroidBridge}
          showCameraPreview={showCameraPreview}
          showCropView={showCropView}
          showDrawer={showDrawer}
          activeTab={activeTab}
          cameraStream={cameraStream.current}
          videoElement={videoElement.current}
          currentImage={currentImage}
          imagePreview={imagePreview}
          croppedImageBase64={croppedImageBase64}
          isFromGallery={isFromGallery.current}
          cropRect={cropRect}
          isCropping={isCropping}
          isDragging={isDragging}
          isResizing={isResizing}
          resizeHandle={resizeHandle}
          currentCursor={currentCursor}
          imageScale={imageScale}
          imageOffsetX={imageOffsetX}
          imageOffsetY={imageOffsetY}
          isPanning={isPanning}
          isPinching={isPinching}
          imageDrawInfo={imageDrawInfo}
          isSearching={isSearching}
          isKeywordSearching={isKeywordSearching}
          keywordText={keywordText}
          photoQuestionData={photoQuestionData}
          keywordQuestionData={keywordQuestionData}
          selectedSubject={selectedSubject}
          splitterModel={splitterModel}
          chatViewRef={chatViewRef.current}
          isChatLoading={isChatLoading}
        />
      )}

      <div className="camera-preview-area">
        {showCameraPreview && !isAndroid && (
          <video
            ref={videoElement}
            autoPlay
            playsInline
            className="camera-video"
          />
        )}

        <ImageCropper
          open={showCropView}
          src={currentImage?.preview || ''}
          onConfirm={handleCropConfirm}
          onRetake={handleRetake}
          onCancel={handleRetake}
          onRectChange={(rect, preview) => {
            setCropRect(rect)
            if (preview) setCropPreviewImage(preview)
          }}
          onClose={() => setShowCropView(false)}
        />
      </div>

      {/* 左侧学科选择面板 */}
      {!showCropView && (
        <div className="subject-selector-panel">
          <div className="subject-selector">
            <div
              className={`subject-option ${selectedSubject === 'math' ? 'active' : ''}`}
              onClick={() => setSelectedSubject('math')}
            >
              <img src={searchMathIcon} alt="搜数学" className="subject-icon" />
              <span>搜数学</span>
            </div>
            <div
              className={`subject-option ${selectedSubject === 'biology' ? 'active' : ''}`}
              onClick={() => setSelectedSubject('biology')}
            >
              <img src={searchBioIcon} alt="搜生物" className="subject-icon" />
              <span>搜生物</span>
            </div>
          </div>
        </div>
      )}

      {/* 右侧操作按钮 */}
      {!showCropView && (
        <div className="action-buttons-panel">
          <div
            className={`action-btn gallery-btn ${!selectedSubject ? 'disabled' : ''}`}
            onClick={handleSelectFromGallery}
          >
            <img src={albumIcon} alt="从相册选择" className="action-icon" />
          </div>
          <div
            className={`action-btn camera-btn ${showCameraPreview ? 'active' : ''} ${!selectedSubject ? 'disabled' : ''}`}
            onClick={handleCapturePhoto}
          >
            <img src={cameraIcon} alt="拍照" className="action-icon" />
          </div>
        </div>
      )}

      {/* 框选内容临时面板 (仅开发环境显示) */}
      {isDev && showCropView && cropRect && showCropPreviewPanel && (
        <div className="crop-preview-panel">
          <div className="crop-preview-header">
            <span className="crop-preview-title">框选预览</span>
            <button className="crop-preview-close-btn" onClick={() => setShowCropPreviewPanel(false)}>
              ×
            </button>
          </div>
          <div className="crop-preview-content">
            {cropPreviewImage && (
              <div className="crop-preview-image-wrapper">
                <img src={cropPreviewImage} alt="框选预览" className="crop-preview-image" />
              </div>
            )}
            <div className="crop-preview-info">
              <div className="info-item">
                <span className="info-label">位置:</span>
                <span className="info-value">({Math.round(cropRect.x)}, {Math.round(cropRect.y)})</span>
              </div>
              <div className="info-item">
                <span className="info-label">尺寸:</span>
                <span className="info-value">{Math.round(cropRect.width)} × {Math.round(cropRect.height)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">面积:</span>
                <span className="info-value">{Math.round(cropRect.width * cropRect.height)} px²</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {!showCropView && !selectedSubject && (
        <div className="hint-overlay">
          <div className="hint-text">拍照搜题前，记得先选对应学科啦！</div>
        </div>
      )}

      <ImagePicker />

      {/* 抽屉: 拍照问答结果 */}
      {showDrawer && (
        <div className="photo-qa-drawer">
          <button className="drawer-back-btn" onClick={handleCloseDrawer}>
            <img src={goBackIcon} alt="返回" className="drawer-back-icon" />
          </button>
          <div className="drawer-content">
            <div className="image-tabs">
              <div
                className={`tab-item ${activeTab === 'photo' ? 'active' : ''}`}
                onClick={() => setActiveTab('photo')}
              >
                拍照搜题
              </div>
              <div
                className={`tab-item ${activeTab === 'keyword' ? 'active' : ''}`}
                onClick={() => setActiveTab('keyword')}
              >
                关键词搜题
              </div>
            </div>

            {activeTab === 'photo' && photoQuestionData && (
              <div className="photo-result-wrapper">
                <div className="recognized-problem">
                  <div 
                    className="problem-text"
                    dangerouslySetInnerHTML={{ __html: renderQuestionContent(photoQuestionData) }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'keyword' && (
              <div className="keyword-search-container">
                <Textarea
                  value={keywordText}
                  onChange={(val) => setKeywordText(val)}
                  placeholder="可输入关键字进行精确搜题"
                  showActionButton={true}
                  actionButtonIcon="search"
                  onActionClick={handleKeywordSearch}
                  isLoading={isKeywordSearching}
                />
                {keywordQuestionData && (
                  <div className="keyword-result-wrapper">
                    <div className="keyword-search-result">
                      <div 
                        className="problem-text"
                        dangerouslySetInnerHTML={{ __html: renderQuestionContent(keywordQuestionData) }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentQuestionData && (
              <div className="drawer-chat-section">
                <ChatView
                  ref={chatViewRef}
                  type="ai-exercise"
                  inputMode="simple"
                  compressedHeight={97}
                  question={currentQuestionData}
                  onResponse={() => setIsChatLoading(false)}
                  onSendMessage={handleSendSuggestionInPhotoSearch}
                  size="small"
                >
                  <div className="chat-action-group">
                    <div className="chat-action-item" onClick={handleRetake}>
                      <img src={zaipaiyitiIcon} style={{ width: 20, height: 20 }} alt="" />
                      <span className="chat-action-text">再拍一题</span>
                    </div>
                    <div className="chat-action-item" onClick={handleFavoriteInChat}>
                      <img
                        src={isFavoriteInChat ? xingxingLightIcon : shoucangIcon}
                        className={isFavoriteInChat ? 'favorited' : ''}
                        style={{ width: 20, height: 20 }}
                        alt=""
                      />
                      <span className="chat-action-text">收藏</span>
                    </div>
                    <div className="chat-action-item" onClick={handleAddToPracticeInChat}>
                      <img
                        src={isInPracticeList ? jiarulianxiLightIcon : jiarulianxiIcon}
                        className={isInPracticeList ? 'in-practice' : ''}
                        style={{ width: 20, height: 20 }}
                        alt=""
                      />
                      <span className="chat-action-text">加入练习</span>
                    </div>
                  </div>
                </ChatView>
              </div>
            )}
          </div>

          {showAddToPracticeDialog && (
            <div className="practice-dialog-overlay">
              <div className="practice-dialog-card">
                <div className="practice-dialog-header">
                  <div className="practice-dialog-title">题目已加入练习</div>
                  <button className="practice-dialog-close" onClick={() => setShowAddToPracticeDialog(false)}>
                    <span className="close-icon">×</span>
                  </button>
                </div>
                <div className="practice-dialog-body">
                  题目已添加到“我的习题”，现在前往查看吗？
                </div>
                <div className="practice-dialog-actions">
                  <div className="practice-dialog-btn" onClick={() => setShowAddToPracticeDialog(false)}>
                    先留在本页
                  </div>
                  <div className="practice-dialog-btn primary" onClick={() => {
                    setShowAddToPracticeDialog(false)
                    navigate(`/exercise-solve?subject=${selectedSubject || 'math'}`)
                  }}>
                    前往我的习题
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Utility to convert base64 to File (完全对齐 Vue 的健壮版本)
async function base64ToFile(base64: string, filename: string): Promise<File> {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Base64 字符串无效')
  }

  const arr = base64.split(',')
  let mime = 'image/jpeg'
  let base64Data = base64

  if (arr.length >= 2) {
    mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    base64Data = arr[1]
  }

  // 清理 base64 字符串
  base64Data = base64Data.trim().replace(/\s/g, '')

  try {
    const bstr = atob(base64Data)
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  } catch (error) {
    throw new Error(`Base64 转 File 失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export default PhotoSearchView

