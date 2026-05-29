import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/base/Modal'
import { Button } from '@/components/base/Button'
import { VirtualScroll } from '@/components/base/VirtualScroll'
import { resourceManager } from '@/services/storage/resource-storage'
import { apiService, getUserId, androidBridge } from '@/services'
import { thumbnailQueue } from '@/utils/thumbnail/thumbnail-queue'
import { isPdfFile } from '@/utils/thumbnail/pdf-thumbnail'
import { isImageFile } from '@/utils/thumbnail/image-thumbnail'
import { isHtmlFile } from '@/utils/thumbnail/html-thumbnail'
import { isVideoFile } from '@/utils/thumbnail/video-thumbnail'
import type { LearningPackage, ResourceFile, LocalFileInfo } from '@/types'
import '@/views/LearningView.css'

export interface LearningViewProps {
  isOpen?: boolean
  onClose?: () => void
  nodeId?: string
  sectionName?: string
  level?: number
  textbookId?: string
  chapterGrade?: string
  chapterSubject?: string
  chapterTextbook?: string
  chapterTitle?: string
}

export const LearningView: React.FC<LearningViewProps> = ({
  isOpen: propsIsOpen,
  onClose,
  nodeId: propsNodeId = '',
  sectionName: propsSectionName = '',
  level: propsLevel = 1,
  textbookId: propsTextbookId = '',
  chapterGrade = '',
  chapterSubject = '',
  chapterTextbook = '',
  chapterTitle = '',
}) => {
  const navigate = useNavigate()

  // 如果 propsIsOpen 为 undefined，说明是作为路由使用的，默认开启
  const isOpen = propsIsOpen === undefined ? true : propsIsOpen

  // 响应式数据
  const [sectionName, setSectionName] = useState(propsSectionName)
  const [sectionId, setSectionId] = useState(propsNodeId)
  const [textbookId, setTextbookId] = useState(propsTextbookId)
  const [selectedSchemeIndex, setSelectedSchemeIndex] = useState(-1)
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPackages, setLoadingPackages] = useState(false)

  // 学习方案数据
  const [learningPackages, setLearningPackages] = useState<LearningPackage[]>([])
  // 本地文件信息 - 用于获取缩略图
  const [localFiles, setLocalFiles] = useState<LocalFileInfo[]>([])
  // 当前教材的textbookId（用于更新缩略图）
  const [currentTextbookId, setCurrentTextbookId] = useState<string>('')

  // 根据章节ID筛选学习方案
  const filteredLearningPackages = useMemo(() => {
    if (!sectionId) {
      return learningPackages
    }

    return learningPackages.filter((pkg) => {
      const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
      return hasSectionId && pkg.sectionId.toLowerCase() === sectionId.toLowerCase()
    })
  }, [sectionId, learningPackages])

  // 当前选中的学习方案
  const currentScheme = useMemo(() => {
    if (
      selectedSchemeIndex >= 0 &&
      selectedSchemeIndex < filteredLearningPackages.length
    ) {
      return filteredLearningPackages[selectedSchemeIndex]
    }
    return null
  }, [selectedSchemeIndex, filteredLearningPackages])

  // 获取当前方案的所有资源文件（带缩略图信息）
  const currentResources = useMemo(() => {
    if (!currentScheme) return []

    const resources = currentScheme.resourceList || []

    return resources.map((resource) => {
      const localFile = localFiles.find((file) => file.id === resource.id)
      return {
        ...resource,
        thumbnail: localFile?.thumbnail,
      }
    })
  }, [currentScheme, localFiles])

  // 方法
  const selectScheme = (index: number) => {
    setSelectedSchemeIndex(index)
    setSelectedResourceIndex(-1)
  }

  const selectResource = (index: number) => {
    setSelectedResourceIndex(index)
  }

  const handleResourceFocus = (index: number) => {
    setSelectedResourceIndex(index)
  }

  const getDifficultyValue = useCallback((scheme: LearningPackage): number => {
    const DIFFICULTY_KEY = `learning_package_difficulty_${scheme.id}`
    const saved = localStorage.getItem(DIFFICULTY_KEY)
    if (saved) {
      const value = parseInt(saved, 10)
      if (!isNaN(value) && value >= 1 && value <= 5) {
        return value
      }
    }

    const schemeWithDifficulty = scheme as LearningPackage & { difficulty?: number }
    return schemeWithDifficulty.difficulty || 1
  }, [])

  const updateDifficulty = async (packageId: string, difficulty: number) => {
    try {
      if (isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
        return
      }

      const DIFFICULTY_KEY = `learning_package_difficulty_${packageId}`
      localStorage.setItem(DIFFICULTY_KEY, difficulty.toString())

      if (textbookId) {
        const textbook = await resourceManager.getTextbookInfoById(textbookId)
        if (textbook && textbook.learningPackages) {
          const packageIndex = textbook.learningPackages.findIndex((pkg) => pkg.id === packageId)
          if (packageIndex !== -1) {
            const updatedPackage = {
              ...textbook.learningPackages[packageIndex],
              difficulty: difficulty,
            } as LearningPackage & { difficulty: number }

            textbook.learningPackages[packageIndex] = updatedPackage
            await resourceManager.updateTextbookInfo(textbook, undefined)

            setLearningPackages(prev => {
              const newPackages = [...prev]
              const localIdx = newPackages.findIndex(pkg => pkg.id === packageId)
              if (localIdx !== -1) {
                newPackages[localIdx] = updatedPackage
              }
              return newPackages
            })
          }
        }
      }
    } catch (error) {
      console.error('保存难度失败:', error)
    }
  }

  const getResourceIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    const iconMap: Record<string, string> = {
      pdf: 'picture_as_pdf',
      doc: 'description',
      docx: 'description',
      txt: 'article',
      jpg: 'image',
      jpeg: 'image',
      png: 'image',
      gif: 'image',
      mp4: 'play_circle',
      avi: 'play_circle',
      mov: 'play_circle',
      mp3: 'audiotrack',
      wav: 'audiotrack',
      zip: 'folder_zip',
      rar: 'folder_zip',
      xls: 'table_view',
      xlsx: 'table_view',
    }
    return iconMap[extension || ''] || 'folder'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getViewerRouteName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    switch (extension) {
      case 'pdf': return 'pdfViewer'
      case 'html':
      case 'htm': return 'htmlViewer'
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm': return 'videoViewer'
      case 'xls':
      case 'xlsx':
      case 'doc':
      case 'docx':
      case 'ppt':
      case 'pptx': return 'htmlViewer'
      default: return 'pdfViewer'
    }
  }

  const isOfficeFile = (fileName: string): boolean => {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    return ['xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)
  }

  const markNodeAsLearned = (nodeId: string) => {
    try {
      const userId = getUserId()
      const LEARNED_NODES_KEY = `${userId}_LEARNED_NODES`
      const saved = localStorage.getItem(LEARNED_NODES_KEY)
      let learnedNodeIds: Set<string> = saved ? new Set(JSON.parse(saved)) : new Set()
      learnedNodeIds.add(nodeId)
      localStorage.setItem(LEARNED_NODES_KEY, JSON.stringify(Array.from(learnedNodeIds)))
    } catch (error) {
      console.error('标记节点为已学习失败:', error)
    }
  }

  const startLearning = async (resource: ResourceFile) => {
    if (!currentScheme) return
    setIsLoading(true)
    try {
      if (androidBridge.isAndroidBridgeAvailable() && isOfficeFile(resource.fileName)) {
        const localFile = localFiles.find(f => f.id === resource.id)
        if (localFile && localFile.isDownloaded) {
          try {
            const fileData = await resourceManager.getFileData(textbookId, resource.id)
            if (fileData) {
              const bytes = new Uint8Array(fileData)
              let binary = ''
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i])
              }
              androidBridge.openDocumentFromBase64(window.btoa(binary), resource.fileName)
              if (sectionId) markNodeAsLearned(sectionId)
              return
            }
          } catch (e) {
            console.error('获取并转换本地文件数据失败:', e)
          }
        }
        if (resource.fileUrl) {
          androidBridge.openDocument(resource.fileUrl, resource.fileName)
          if (sectionId) markNodeAsLearned(sectionId)
          return
        }
      }

      const routeName = getViewerRouteName(resource.fileName)
      // 修复路由路径：React 版本中业务路由统一在 /app 下
      // 同时增加 search 参数，因为 PdfViewerView 优先从 searchParams 中读取 ID
      const targetPath = `/app/${routeName.toLowerCase().replace('viewer', '-viewer')}`
      
      navigate({
        pathname: targetPath,
        search: `?id=${textbookId}&resourceId=${resource.id}&sectionName=${encodeURIComponent(sectionName)}`
      }, {
        state: {
          id: textbookId,
          textbookName: sectionName,
          sectionName: sectionName,
          resourceId: resource.id,
          fileName: resource.fileName,
          packageId: currentScheme.id,
          packageName: currentScheme.packageName,
          chapterGrade,
          chapterSubject,
          chapterTextbook,
          chapterTitle,
          fromLearning: 'true',
          learningNodeId: sectionId,
          learningLevel: propsLevel.toString(),
        }
      })
      if (sectionId) markNodeAsLearned(sectionId)
    } catch (error) {
      console.error('开始学习失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkAndGenerateThumbnails = useCallback(async () => {
    if (!currentScheme || !currentTextbookId || !textbookId) return

    try {
      const resources = currentScheme.resourceList || []
      for (const resource of resources) {
        if (!isPdfFile(resource.fileName) && !isImageFile(resource.fileName) && 
            !isHtmlFile(resource.fileName) && !isVideoFile(resource.fileName)) continue
        
        const localFile = localFiles.find(file => file.id === resource.id)
        if (localFile && localFile.isDownloaded && !localFile.thumbnail) {
          const fileData = await resourceManager.getFileData(textbookId, resource.id)
          if (fileData && fileData.length > 0) {
            thumbnailQueue.addTask({
              fileId: resource.id,
              textbookId: currentTextbookId,
              fileName: resource.fileName,
              fileData: fileData,
              onComplete: (fileId: string, thumbnail: string) => {
                setLocalFiles(prev => prev.map(f => f.id === fileId ? { ...f, thumbnail } : f))
              }
            })
          }
        }
      }
    } catch (error) {
      console.error('检查并生成缩略图失败:', error)
    }
  }, [currentScheme, currentTextbookId, textbookId, localFiles])

  const loadLearningPackages = useCallback(async () => {
    if (!textbookId) return
    setLoadingPackages(true)
    try {
      const textbook = await resourceManager.getTextbookInfoById(textbookId)
      if (textbook) {
        setCurrentTextbookId(textbook.textbookId)
        let packagesToUse = textbook.learningPackages
        if (!packagesToUse || packagesToUse.length === 0) {
          try {
            packagesToUse = await apiService.getLearningResources(textbook.id, true)
            if (packagesToUse && packagesToUse.length > 0) {
              textbook.learningPackages = packagesToUse
              await resourceManager.updateTextbookInfo(textbook)
            }
          } catch (error) {
            packagesToUse = []
          }
        }
        setLearningPackages(packagesToUse || [])
        setLocalFiles(textbook.localFiles || [])
        if (packagesToUse && packagesToUse.length > 0) setSelectedSchemeIndex(0)
      }
    } catch (error) {
      console.error('加载学习包失败:', error)
    } finally {
      setLoadingPackages(false)
    }
  }, [textbookId])

  useEffect(() => {
    setSectionId(propsNodeId)
    setSelectedSchemeIndex(-1)
    setSelectedResourceIndex(-1)
  }, [propsNodeId])

  useEffect(() => {
    setSectionName(propsSectionName)
  }, [propsSectionName])

  useEffect(() => {
    setTextbookId(propsTextbookId)
    setSelectedSchemeIndex(-1)
    setSelectedResourceIndex(-1)
  }, [propsTextbookId])

  useEffect(() => {
    if (isOpen) {
      loadLearningPackages()
    }
  }, [isOpen, loadLearningPackages])

  useEffect(() => {
    if (currentScheme) {
      const timer = setTimeout(checkAndGenerateThumbnails, 100)
      return () => clearTimeout(timer)
    }
  }, [currentScheme, checkAndGenerateThumbnails])

  if (!isOpen) return null

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={sectionName}
      initialWidth={700}
      initialHeight={500}
      minWidth={700}
      minHeight={500}
      titleAlign="left"
      headerBackgroundColor="#ffffff"
    >
      <div className="learning-content">
        <div className="main-content">
          <div className="left-panel">
            <div className="scheme-section">
              {loadingPackages ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">正在加载学习方案...</div>
                </div>
              ) : filteredLearningPackages.length > 0 ? (
                <VirtualScroll className="scheme-list">
                  <div className="scroll-content-schemeList">
                    {filteredLearningPackages.map((scheme, index) => (
                      <div
                        key={scheme.id}
                        className={`scheme-item ${selectedSchemeIndex === index ? 'scheme-selected' : ''}`}
                        onClick={() => selectScheme(index)}
                      >
                        <div className="scheme-header">
                          <span className="scheme-name">{scheme.packageName}</span>
                          <div className="difficulty-rating">
                            <span className="difficulty-label">难度</span>
                            <div className="rating-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={`star ${star <= getDifficultyValue(scheme) ? 'filled' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); updateDifficulty(scheme.id, star) }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </VirtualScroll>
              ) : (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="#ccc">
                    <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
                  </svg>
                  <div className="empty-text">该章节暂无学习方案</div>
                </div>
              )}
            </div>
          </div>

          <div className="right-panel">
            {selectedSchemeIndex < 0 ? (
              <div className="empty-resources">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="#ccc">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z"/>
                </svg>
                <div className="empty-text">请先选择学习方案</div>
              </div>
            ) : currentResources.length > 0 ? (
              <VirtualScroll className="resources-list">
                <div className="scroll-content">
                  {currentResources.map((resource, index) => (
                    <div
                      key={resource.id}
                      className="resource-item"
                      tabIndex={0}
                      onClick={() => selectResource(index)}
                      onFocus={() => handleResourceFocus(index)}
                    >
                      <div className="resource-thumbnail">
                        {resource.thumbnail ? (
                          <img
                            src={resource.thumbnail}
                            alt={resource.fileName}
                            className="thumbnail-image"
                          />
                        ) : (
                          <svg viewBox="0 0 24 24" width="32" height="32" fill="#999">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                          </svg>
                        )}
                      </div>
                      <div className="resource-info">
                        <div className="resource-title">{resource.fileName}</div>
                        <div className="resource-size">{formatFileSize(resource.size)}</div>
                      </div>
                      <Button
                        label="去学习"
                        size="mdCompact"
                        className="resource-action"
                        onClick={(e) => { e.stopPropagation(); startLearning(resource) }}
                      />
                    </div>
                  ))}
                </div>
              </VirtualScroll>
            ) : (
              <div className="empty-resources">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="#ccc">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z"/>
                </svg>
                <div className="empty-text">该方案暂无资源文件</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default LearningView
