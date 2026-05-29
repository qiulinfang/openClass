import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/views/MyResourcesView.css'

// 导入组件
import Tag from '@/components/base/Tag'
import Select from '@/components/base/Select'
import VirtualScroll, { type VirtualScrollRef } from '@/components/base/VirtualScroll'
import Dialog from '@/components/base/Dialog'
import ResourceDebugPanel from '@/components/debug/ResourceDebugPanel'

// 导入服务与工具
import { resourceManager } from '@/services/storage/resource-storage'
import { apiService } from '@/services/http/api-service'
import { httpClient } from '@/services/http/http-client'
import { showMessage, getUserId } from '@/utils'
import { useResourceStore } from '@/stores/resourceStore'
import { useKnowledgeGraphStore } from '@/stores/KnowledgeGraphStore'

// 导入常量与类型
import { RESOURCE_SUBJECT_OPTIONS } from '@/constants/subjects'
import {
  RESOURCE_GRADE_OPTIONS,
  RESOURCE_VERSION_OPTIONS,
  RESOURCE_DOWNLOAD_STATUS_OPTIONS,
} from '@/constants/options'
import type { UserTextbookInfo, TextbookVersion, ChapterNode, ResourceFile } from '@/types'

// 导入图标资源
const bookIcon = '/images/book.png'

export const MyResourcesView: React.FC = () => {
  const navigate = useNavigate()
  
  // Store
  const resourceStore = useResourceStore()
  const knowledgeGraphStore = useKnowledgeGraphStore()
  
  // 响应式状态
  const virtualScrollRef = useRef<VirtualScrollRef>(null)
  const [loading, setLoading] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [textbooks, setTextbooks] = useState<UserTextbookInfo[]>([])
  const [updateCount, setUpdateCount] = useState(0)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false)
  const [hasLocalData, setHasLocalData] = useState(false)
  
  // 筛选器状态
  const [selectedGrade, setSelectedGrade] = useState<string>('')
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  
  // 删除教材相关状态
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTextbookId, setDeleteTextbookId] = useState<string | null>(null)
  const [deleteTextbookName, setDeleteTextbookName] = useState('')

  const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

  // 辅助函数
  const getDownloadStatusText = (textbook: UserTextbookInfo): string => {
    if (textbook.downloadStatus === 0) return '未下载'
    if (textbook.downloadStatus === 1) return '正在下载'
    if (textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded)
      return '有更新'
    if (textbook.downloadStatus === 2 && textbook.isDownloaded) return '下载完成'
    if (textbook.downloadStatus === 3) return '已暂停'
    return '未下载'
  }

  const getDownloadStatusType = (textbook: UserTextbookInfo): 'red' | 'blue' | 'green' | 'orange' | 'gray' => {
    if (textbook.downloadStatus === 0) return 'red'
    if (textbook.downloadStatus === 1) return 'blue'
    if (textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded)
      return 'orange'
    if (textbook.downloadStatus === 2 && textbook.isDownloaded) return 'green'
    if (textbook.downloadStatus === 3) return 'gray'
    return 'red'
  }

  const getDownloadProgress = (downloadedFiles: number, totalFiles: number): number => {
    if (!totalFiles || totalFiles === 0) return 0
    return Math.round((downloadedFiles / totalFiles) * 100)
  }

  const getCoverImageUrl = (coverUrl: string | undefined): string => {
    if (!coverUrl) return bookIcon
    return httpClient.buildFullUrl(coverUrl)
  }

  // 状态排序权重
  const getStatusRank = (textbook: UserTextbookInfo): number => {
    if (textbook.isDownloaded && textbook.hasUpdatesAvailable) return 0
    if (!textbook.isDownloaded || textbook.downloadStatus === 0) return 1
    if (textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable) return 2
    return 3
  }

  // 过滤与排序后的列表
  const filteredTextbooks = useMemo(() => {
    if (!textbooks) return []
    let result = textbooks.filter(t => t !== null && t !== undefined)

    if (selectedGrade) {
      result = result.filter(t => t.textbookGradeLabel === selectedGrade)
    }
    if (selectedVersion) {
      result = result.filter(t => t.textbookPublisher === selectedVersion)
    }
    if (selectedSubject) {
      result = result.filter(t => t.textbookSubjectLabel === selectedSubject)
    }

    if (selectedStatus === 'notDownloaded') {
      result = result.filter(t => !t.isDownloaded || t.downloadStatus === 0)
    } else if (selectedStatus === 'downloaded') {
      result = result.filter(t => t.isDownloaded && t.downloadStatus === 2 && !t.hasUpdatesAvailable)
    } else if (selectedStatus === 'pendingUpdate') {
      result = result.filter(t => t.isDownloaded && t.hasUpdatesAvailable)
    }

    return result.sort((a, b) => {
      const rankA = getStatusRank(a)
      const rankB = getStatusRank(b)
      if (rankA !== rankB) return rankA - rankB

      const getSafeLabel = (val: any) => (val === null || val === undefined ? '' : String(val))
      
      const subjectA = getSafeLabel(a.textbookSubjectLabel)
      const subjectB = getSafeLabel(b.textbookSubjectLabel)
      if (subjectA !== subjectB) return subjectA.localeCompare(subjectB)

      const gradeA = getSafeLabel(a.textbookGradeLabel)
      const gradeB = getSafeLabel(b.textbookGradeLabel)
      if (gradeA !== gradeB) return gradeA.localeCompare(gradeB)

      const nameA = getSafeLabel(a.textbookName)
      const nameB = getSafeLabel(b.textbookName)
      return nameA.localeCompare(nameB)
    })
  }, [textbooks, selectedGrade, selectedVersion, selectedSubject, selectedStatus])

  // 业务逻辑方法
  const markUpdatesFromCheckResult = useCallback(async (updatedTextbooks: TextbookVersion[], showNotification = true) => {
    const updatedTextbookIds = new Set(updatedTextbooks.map(t => t.id))
    
    setTextbooks(prevTextbooks => {
      const newTextbooks = [...prevTextbooks]
      
      // 使用 Promise.all 处理持久化，但在状态更新函数内不能 await
      // 所以我们先同步更新状态，然后再异步处理持久化
      newTextbooks.forEach(textbook => {
        const hasUpdate = updatedTextbookIds.has(textbook.id)
        if (textbook.hasUpdatesAvailable !== hasUpdate) {
          textbook.hasUpdatesAvailable = hasUpdate
          // 异步更新数据库
          resourceManager.updateTextbookInfo(textbook, { hasUpdatesAvailable: hasUpdate })
        }
      })
      
      return newTextbooks
    })

    setUpdateCount(updatedTextbooks.length)
    resourceStore.setHasResourceNotification(updatedTextbooks.length > 0)
    
    if (showNotification) {
      if (updatedTextbooks.length > 0) {
        showMessage(`发现 ${updatedTextbooks.length} 个教材有更新`, 'success')
      } else {
        setUpdateCount(0)
        showMessage('所有教材都是最新版本', 'info')
      }
      resourceStore.markUpdateCheckCompleted()
    }
  }, [resourceStore])

  // 处理筛选变化：目前所有筛选逻辑都在 filteredTextbooks 的 useMemo 中，这里留作扩展占位
  const handleFilterChange = () => {
    // 预留：如果需要在筛选变化时触发额外行为，可以在此处添加
  }

  // 辅助函数：确保数据库已初始化
  const ensureKGStoreInitialized = async () => {
    const db = resourceManager.indexedDB
    if (!db.isInitialized) {
      await db.init()
    }
  }

  // 将章节结构保存到知识图谱缓存表
  const saveChapterStructureToKnowledgeGraphCache = async (
    textbookId: string,
    chapterData: ChapterNode[]
  ): Promise<boolean> => {
    try {
      await ensureKGStoreInitialized()
      const db = resourceManager.indexedDB
      const userId = getUserId()
      if (!userId) {
        console.warn('[MyResourcesView] 用户ID为空，无法保存章节结构到缓存')
        return false
      }
      const record = {
        id: `${userId}_${textbookId}`,
        userId,
        textbookId,
        data: chapterData,
        timestamp: Date.now(),
      }
      await db.put('knowledge_graph_chapter_structure', record)
      return true
    } catch (error) {
      console.warn('[MyResourcesView] 保存章节结构到知识图谱缓存失败:', error)
      return false
    }
  }

  // 合并服务器数据和本地数据 - 优化版本：先解构本地数据，再解构服务器数据
  const mergeServerAndLocalData = (
    serverTextbooks: UserTextbookInfo[],
    localTextbooks: UserTextbookInfo[]
  ): UserTextbookInfo[] => {
    const mergedTextbooks: UserTextbookInfo[] = []

    // 0. 先对服务器数据进行去重处理（基于id）
    const uniqueServerTextbooks = serverTextbooks.reduce((acc: UserTextbookInfo[], current) => {
      const existingIndex = acc.findIndex((item) => item.id === current.id)
      if (existingIndex === -1) {
        // 不存在，直接添加
        acc.push(current)
      } else {
        // 存在重复，保留最新的（使用更大的id值）
        const existing = acc[existingIndex]
        if (current.id && existing.id && current.id > existing.id) {
          acc[existingIndex] = current
        }
      }
      return acc
    }, [])

    // 1. 先添加所有去重后的服务器教材
    uniqueServerTextbooks.forEach((serverTextbook) => {
      // 查找对应的本地教材
      const localTextbook = localTextbooks.find(
        (local) => local.id === serverTextbook.id
      )

      if (localTextbook) {
        // 优化：先解构本地数据，再解构服务器数据，避免属性丢失
        const mergedTextbook: UserTextbookInfo = {
          // 先解构本地数据，保留本地状态和进度信息
          ...localTextbook,
          // 再解构服务器数据，更新服务器的最新信息（会覆盖本地的旧信息）
          ...serverTextbook,
          // 显式保留本地下载相关字段，避免下拉刷新时被服务端空字段覆盖并写回数据库
          localFiles: localTextbook.localFiles || [],
          learningPackages: localTextbook.learningPackages || [],
          totalFiles: localTextbook.totalFiles || 0,
          downloadStatus: localTextbook.downloadStatus,
          downloadedFiles: localTextbook.downloadedFiles,
          isDownloaded: localTextbook.isDownloaded,
          downloadPath: localTextbook.downloadPath,
          lastDownloadTime: localTextbook.lastDownloadTime,
          hasUpdatesAvailable: localTextbook.hasUpdatesAvailable,
          // 保留方法（如果存在）
          updatePackages: localTextbook.updatePackages || (() => {}),
          getLocalResourceFileName: localTextbook.getLocalResourceFileName || (() => ''),
        }
        mergedTextbooks.push(mergedTextbook)
      } else {
        const mergedId = serverTextbook.id || serverTextbook.textbookId

        // 服务器新教材，添加到列表
        mergedTextbooks.push({
          ...serverTextbook,
          id: mergedId, // 🔥 确保有id字段作为主键
          isDownloaded: false,
          downloadStatus: 0,
          downloadedFiles: 0,
          totalFiles: 0,
          downloadPath: '',
          lastDownloadTime: '',
          learningPackages: [],
          hasUpdatesAvailable: false, // 🔥 初始化更新状态
          localFiles: [], // 🔥 初始化空本地文件列表
          // 初始化方法
          updatePackages: () => {},
          getLocalResourceFileName: () => '',
        })
      }
    })

    return mergedTextbooks
  }

  // 检测和修复不一致的下载状态 - 优化版本，批量处理
  const fixInconsistentDownloadStatus = useCallback(async (currentTextbooks: UserTextbookInfo[]) => {
    const updatesToSave: Array<{
      textbook: UserTextbookInfo
      updates: {
        downloadStatus: number
        isDownloaded: boolean
        downloadedFiles: number
      }
    }> = []

    // 快速检查需要修复的教材
    for (const textbook of currentTextbooks) {
      if (textbook.downloadStatus === 1) {
        const hasActiveDownload = apiService.hasActiveDownload(textbook.textbookId)

        if (!hasActiveDownload) {
          // 根据下载进度判断状态
          let newStatus: number
          let isDownloaded: boolean
          let downloadedFiles: number

          if (textbook.downloadedFiles > 0 && textbook.downloadedFiles < (textbook.totalFiles || 0)) {
            newStatus = 3
            isDownloaded = false
            downloadedFiles = textbook.downloadedFiles
          } else if (textbook.downloadedFiles === (textbook.totalFiles || 0) && (textbook.totalFiles || 0) > 0) {
            newStatus = 2
            isDownloaded = true
            downloadedFiles = textbook.downloadedFiles
          } else {
            newStatus = 0
            isDownloaded = false
            downloadedFiles = 0
          }

          // 更新内存中的状态
          textbook.downloadStatus = newStatus
          textbook.isDownloaded = isDownloaded
          textbook.downloadedFiles = downloadedFiles

          // 收集需要保存的更新
          updatesToSave.push({
            textbook,
            updates: {
              downloadStatus: newStatus,
              isDownloaded,
              downloadedFiles,
            },
          })
        }
      }
    }

    // 批量保存更新（如果有需要修复的）
    if (updatesToSave.length > 0) {
      const savePromises = updatesToSave.map(({ textbook, updates }) =>
        resourceManager.updateTextbookInfo(textbook, updates)
      )
      await Promise.all(savePromises)
      setTextbooks([...currentTextbooks])
    }
  }, [])

  const cleanupDeletedLocalTextbooks = useCallback(async (
    serverTextbooks: UserTextbookInfo[],
    localTextbooks: UserTextbookInfo[]
  ) => {
    if (serverTextbooks.length === 0 || localTextbooks.length === 0) return

    const serverTextbookIdSet = new Set(serverTextbooks.map((t) => t.textbookId))
    const deletedLocalTextbooks = localTextbooks.filter(
      (local) => !serverTextbookIdSet.has(local.textbookId)
    )

    if (deletedLocalTextbooks.length === 0) return

    await Promise.all(
      deletedLocalTextbooks.map(async (textbook) => {
        if (textbook.downloadStatus === 1 || textbook.downloadStatus === 3) {
          try {
            await apiService.cancelDownload(textbook.textbookId)
          } catch {}
        }

        await resourceManager.deleteTextbook(textbook.id)
      })
    )
  }, [])

  const mergeAndPersistTextbooks = useCallback(async (
    serverTextbooks: UserTextbookInfo[],
    localTextbooks: UserTextbookInfo[]
  ): Promise<UserTextbookInfo[]> => {
    const mergedTextbooks = mergeServerAndLocalData(serverTextbooks, localTextbooks)
    for (const textbook of mergedTextbooks) {
      await resourceManager.updateTextbookInfo(textbook)
    }
    return mergedTextbooks
  }, [])

  const loadResourcesLocalFastPath = useCallback(async (localTextbooks: UserTextbookInfo[]) => {
    setTextbooks(localTextbooks)
    setInitialLoadCompleted(true)
    await fixInconsistentDownloadStatus(localTextbooks)
  }, [fixInconsistentDownloadStatus])

  const loadResourcesServerRefreshPath = useCallback(async (localTextbooks: UserTextbookInfo[]) => {
    setLoading(true)
    try {
      const serverTextbooks = await apiService.fetchUserAllOnlineTextbooks()

      await cleanupDeletedLocalTextbooks(serverTextbooks, localTextbooks)

      const mergedTextbooks = await mergeAndPersistTextbooks(serverTextbooks, localTextbooks)

      setTextbooks(mergedTextbooks)

      setTimeout(async () => {
        try {
          // 执行三级对比检查
          const updatedTextbooks = await apiService.checkForUpdates()
          console.log('需要更新的教材', updatedTextbooks)
          // 标记更新状态
          if (updatedTextbooks.length > 0) {
            await markUpdatesFromCheckResult(updatedTextbooks, false)
          }
        } catch (error) {
          console.warn('延迟更新检查失败:', error)
        }
      }, 3000)
    } catch {
      showMessage('加载资源失败，请稍后重试', 'error')
      setTextbooks([])
    } finally {
      setLoading(false)
      setInitialLoadCompleted(true)
    }
  }, [cleanupDeletedLocalTextbooks, mergeAndPersistTextbooks, markUpdatesFromCheckResult])

  const loadResources = useCallback(async (isPullDownRefresh = false) => {
    setInitialLoadCompleted(false)

    let localTextbooks: UserTextbookInfo[] = []
    try {
      const result = await resourceManager.getUserLocalTextbooks()
      if (result && result.length > 0) {
        setHasLocalData(true)
        localTextbooks = result
      } else {
        setHasLocalData(false)
        localTextbooks = []
      }
    } catch {
      setHasLocalData(false)
      localTextbooks = []
    }

    const canUseLocalFastPath = localTextbooks.length > 0 && !isPullDownRefresh
    if (canUseLocalFastPath) {
      await loadResourcesLocalFastPath(localTextbooks)
    } else {
      await loadResourcesServerRefreshPath(localTextbooks)
    }
  }, [loadResourcesLocalFastPath, loadResourcesServerRefreshPath])

  const pauseAllDownloadingTasks = useCallback(async () => {
    const downloadingTextbooks = textbooks.filter(t => t.downloadStatus === 1)
    if (downloadingTextbooks.length === 0) return

    const pausePromises = downloadingTextbooks.map(async (textbook) => {
      try {
        const success = await apiService.pauseDownload(textbook.textbookId)
        if (success) {
          textbook.downloadStatus = 3
          textbook.isDownloaded = false
          await resourceManager.updateTextbookInfo(textbook, {
            downloadStatus: 3,
            isDownloaded: false,
            downloadedFiles: textbook.downloadedFiles,
          })
        }
      } catch {}
    })
    await Promise.all(pausePromises)
    setTextbooks([...textbooks])
  }, [textbooks])

  const handlePullDownRefresh = async () => {
    try {
      await pauseAllDownloadingTasks()
      await loadResources(true)
    } catch {
      showMessage('刷新失败，请稍后重试', 'error')
    } finally {
      virtualScrollRef.current?.finishRefresh()
    }
  }

  const finalizeRecord = async (record: UserTextbookInfo) => {
    record.isDownloaded = true
    record.downloadStatus = 2
    record.downloadedFiles = record.totalFiles
    record.lastDownloadTime = new Date().toISOString()
    record.hasUpdatesAvailable = false
    await resourceManager.updateTextbookInfo(record, {
      isDownloaded: true,
      downloadStatus: 2,
      downloadedFiles: record.totalFiles,
      lastDownloadTime: record.lastDownloadTime,
      hasUpdatesAvailable: false,
    })
  }

  const ensurePackages = async (textbook: UserTextbookInfo, forceRefreshPackages: boolean): Promise<boolean> => {
    if (!forceRefreshPackages && textbook.learningPackages && textbook.learningPackages.length > 0) {
      return true
    }
    try {
      const packages = await apiService.getLearningResources(textbook.id, false)
      if (packages && packages.length > 0) {
        textbook.learningPackages = packages
        await resourceManager.updateTextbookInfo(textbook, { learningPackages: packages })
        return true
      }
      showMessage(`《${textbook.textbookName}》暂无可用的学习资源`, 'warning')
      return false
    } catch {
      showMessage(`获取《${textbook.textbookName}》学习资源失败，请重试`, 'error')
      return false
    }
  }

  const cacheChapterStructure = useCallback(async (textbook: UserTextbookInfo, fullTextbook: UserTextbookInfo) => {
    try {
      const chapterData = await apiService.getTextbookStructure(textbook.textbookId)
      if (chapterData && chapterData.length > 0) {
        await saveChapterStructureToKnowledgeGraphCache(textbook.textbookId, chapterData)
        console.log(`[MyResourcesView] 成功获取《${textbook.textbookName}》章节结构并缓存:`, chapterData.length, '章')
      }
    } catch (error) {
      console.warn(`[MyResourcesView] 获取《${textbook.textbookName}》章节结构失败:`, error)
    }
  }, [saveChapterStructureToKnowledgeGraphCache])

  const getFullTextbook = async (
    textbook: UserTextbookInfo
  ): Promise<UserTextbookInfo | null> => {
    return resourceManager.getTextbookByIdOrTextbookIdWithFallback(textbook.id, undefined, '下载')
  }

  const findByGetAll = async (textbook: UserTextbookInfo): Promise<UserTextbookInfo | null> => {
    const allTextbooks = await resourceManager.indexedDB.getAll<UserTextbookInfo>('textbooks')
    let foundTextbook = allTextbooks.find((t: UserTextbookInfo) => t.id === textbook.id) || null
    if (foundTextbook) return foundTextbook

    const byTextbookId = allTextbooks.filter((t: UserTextbookInfo) => t.textbookId === textbook.textbookId)
    if (byTextbookId.length === 0) return null

    foundTextbook = byTextbookId.reduce((latest, current) => {
      return current.id > latest.id ? current : latest
    })
    return foundTextbook
  }

  const downloadTextbook = async (textbook: UserTextbookInfo, forceRefreshPackages = false) => {
    if (textbook.downloadStatus === 1) {
      showMessage(`《${textbook.textbookName}》正在下载中，请勿重复操作`, 'warning')
      return
    }
    if (textbook.downloadStatus === 2 && textbook.isDownloaded && !textbook.hasUpdatesAvailable) {
      return
    }

    const packagesOk = await ensurePackages(textbook, forceRefreshPackages)
    if (!packagesOk) return

    const currentTextbooks = [...textbooks]
    const tb = currentTextbooks.find(t => t.id === textbook.id)
    if (!tb) return
    
    tb.downloadStatus = 1
    tb.isDownloaded = false
    setTextbooks([...currentTextbooks])

    try {
      const success = await apiService.downloadTextbook(tb, async (_, downloadedCount) => {
        tb.downloadedFiles = downloadedCount
        setTextbooks([...currentTextbooks])
      })

      if (!success) {
        tb.downloadStatus = 0
        tb.isDownloaded = false
        setTextbooks([...currentTextbooks])
        showMessage(`《${tb.textbookName}》下载失败`, 'error')
        return
      }

      const fullTextbook = await getFullTextbook(tb)
      if (fullTextbook) {
        await finalizeRecord(fullTextbook)
        Object.assign(tb, fullTextbook)
        
        await cacheChapterStructure(tb, fullTextbook)

        resourceStore.markTextbookUpdated()
        resourceStore.setHasResourceNotification(currentTextbooks.some(t => t.hasUpdatesAvailable))
        setTextbooks([...currentTextbooks])
        showMessage(`《${tb.textbookName}》下载完成`, 'success')
        return
      }

      const foundTextbook = await findByGetAll(tb)
      if (foundTextbook) {
        await finalizeRecord(foundTextbook)
        Object.assign(tb, foundTextbook)
        resourceStore.setHasResourceNotification(currentTextbooks.some(t => t.hasUpdatesAvailable))
        setTextbooks([...currentTextbooks])
        showMessage(`《${tb.textbookName}》下载完成`, 'success')
        return
      }

      tb.isDownloaded = true
      tb.downloadStatus = 2
      tb.downloadedFiles = tb.totalFiles
      tb.lastDownloadTime = new Date().toISOString()
      tb.hasUpdatesAvailable = false

      await resourceManager.updateTextbookInfo(tb, {
        isDownloaded: true,
        downloadStatus: 2,
        downloadedFiles: tb.totalFiles,
        lastDownloadTime: tb.lastDownloadTime,
        hasUpdatesAvailable: false,
      })

      window.dispatchEvent(new CustomEvent('textbook-updated'))
      resourceStore.setHasResourceNotification(currentTextbooks.some(t => t.hasUpdatesAvailable))
      setTextbooks([...currentTextbooks])
      showMessage(`《${tb.textbookName}》下载完成`, 'success')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        tb.downloadStatus = 3
        tb.isDownloaded = false
        await resourceManager.updateTextbookInfo(tb, {
          downloadStatus: 3,
          isDownloaded: false,
          downloadedFiles: tb.downloadedFiles,
        })
      } else if (error instanceof Error && error.name === 'EmptyLearningPackages') {
        tb.downloadStatus = 0
        tb.isDownloaded = false
        await resourceManager.updateTextbookInfo(tb, {
          downloadStatus: 0,
          isDownloaded: false,
        })
        showMessage(`《${tb.textbookName}》暂无可用的学习资源`, 'warning')
      } else {
        tb.downloadStatus = 0
        tb.isDownloaded = false
        showMessage(`《${tb.textbookName}》下载失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
      }
      setTextbooks([...currentTextbooks])
    }
  }

  const handlePauseDownload = async (textbook: UserTextbookInfo) => {
    try {
      const success = await apiService.pauseDownload(textbook.textbookId)
      if (success) {
        textbook.downloadStatus = 3
        textbook.isDownloaded = false
        await resourceManager.updateTextbookInfo(textbook, {
          downloadStatus: 3,
          isDownloaded: false,
          downloadedFiles: textbook.downloadedFiles,
        })
        setTextbooks([...textbooks])
        showMessage(`《${textbook.textbookName}》已暂停`, 'info')
      } else {
        showMessage(`《${textbook.textbookName}》暂停失败`, 'error')
      }
    } catch (error) {
      console.error('暂停下载失败:', error)
      showMessage(
        `《${textbook.textbookName}》暂停失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`,
        'error'
      )
    }
  }

  const handleDeleteTextbook = (textbook: UserTextbookInfo) => {
    if (textbook.downloadStatus === 1 || textbook.downloadStatus === 3) {
      apiService.cancelDownload(textbook.textbookId).catch(() => {})
    }
    setDeleteTextbookId(textbook.id)
    setDeleteTextbookName(textbook.textbookName)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteTextbook = async () => {
    if (!deleteTextbookId) return
    setDeleting(true)
    try {
      const tb = textbooks.find(t => t.id === deleteTextbookId)
      if (tb && (tb.downloadStatus === 1 || tb.downloadStatus === 3)) {
        await apiService.cancelDownload(tb.textbookId).catch(() => {})
      }
      await resourceManager.clearTextbookFiles(deleteTextbookId)
      if (tb) {
        tb.isDownloaded = false
        tb.downloadStatus = 0
        tb.downloadedFiles = 0
        tb.localFiles = []
        tb.learningPackages = []
        tb.lastDownloadTime = ''
        await resourceManager.updateTextbookInfo(tb)
        resourceStore.markTextbookUpdated()
      }
      setTextbooks([...textbooks])
      showMessage(`《${deleteTextbookName}》本地资料已清除`, 'success')
      setIsDeleteDialogOpen(false)
    } catch (error) {
      showMessage(
        `删除《${deleteTextbookName}》失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`,
        'error'
      )
    } finally {
      setDeleting(false)
      setDeleteTextbookId(null)
      setDeleteTextbookName('')
    }
  }

  // 跳转到知识图谱学习当前教材
  const handleLearnTextbook = (textbook: UserTextbookInfo) => {
    if (!textbook.textbookId) {
      showMessage('当前教材缺少 textbookId，无法打开知识图谱', 'warning')
      return
    }

    const subjectMap: Record<string, string> = {
      数学: 'math',
      语文: 'chinese',
      英语: 'english',
      物理: 'physics',
      化学: 'chemistry',
      生物: 'biology',
      地理: 'geography',
      历史: 'history',
      政治: 'politics',
    }

    const subjectLabel = textbook.textbookSubjectLabel || '数学'
    const subject = subjectMap[subjectLabel] || 'math'
    
    // 通过路由跳转到知识图谱页面，同时携带用于初始化的 query 参数（使用 initSubject/initTextbookId 区分入口）
    navigate({
      pathname: '/knowledge-graph',
      search: `?initSubject=${subject}&initTextbookId=${textbook.textbookId}`
    })
  }

  // 生命周期
  useEffect(() => {
    loadResources(true)
    return () => {
      pauseAllDownloadingTasks()
    }
  }, [])

  return (
    <div className="my-resources-view">
      <div className="filter-section">
        <div className="filter-title">资源下载</div>
        <div className="filter-content">
          <div className="filter-dropdown-item">
            <label className="filter-label">年级:</label>
            <Select
              className="filter-select"
              options={RESOURCE_GRADE_OPTIONS}
              value={selectedGrade}
              onChange={(val) => {
                setSelectedGrade(val as string)
                handleFilterChange()
              }}
              placeholder="全部"
            />
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">教材版本:</label>
            <Select
              className="filter-select"
              options={RESOURCE_VERSION_OPTIONS}
              value={selectedVersion}
              onChange={(val) => {
                setSelectedVersion(val as string)
                handleFilterChange()
              }}
              placeholder="全部"
            />
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">学科:</label>
            <Select
              className="filter-select"
              options={RESOURCE_SUBJECT_OPTIONS}
              value={selectedSubject}
              onChange={(val) => {
                setSelectedSubject(val as string)
                handleFilterChange()
              }}
              placeholder="全部"
            />
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">下载状态:</label>
            <Select
              className="filter-select"
              options={RESOURCE_DOWNLOAD_STATUS_OPTIONS}
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val as string)
                handleFilterChange()
              }}
              placeholder="全部"
            />
          </div>
        </div>
        {isDev && (
          <div className="filter-actions">
            <button onClick={() => setShowDebugPanel(true)} className="debug-btn">
              <span className="material-icons">bug_report</span>
              <span>调试面板</span>
            </button>
          </div>
        )}
      </div>

      {textbooks.length > 0 && (
        <VirtualScroll
          ref={virtualScrollRef}
          enableRefresh={true}
          onRefresh={handlePullDownRefresh}
        >
          <div className="scroll-content">
            {/* 教材列表 */}
            <div className="textbooks-container q-pa-md">
              <div className="textbooks-scroll-container">
                <div className="textbooks-grid">
                  {filteredTextbooks.map((textbook) => (
                    <div
                      key={textbook.id}
                      className={`textbook-card ${textbook.downloadStatus === 1 ? 'downloading' : ''} ${textbook.downloadStatus === 3 ? 'paused' : ''}`}
                    >
                      {/* 删除按钮（右上角） */}
                      {(textbook.isDownloaded || textbook.downloadStatus !== 0 || textbook.downloadedFiles > 0) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTextbook(textbook) }}
                          className="textbook-delete-btn"
                          title="清除本地资料"
                        >
                          <span className="material-icons">close</span>
                        </button>
                      )}

                      {/* 左侧：封面图片 */}
                      <div className="textbook-cover">
                        <img src={getCoverImageUrl(textbook.textbookCover)} alt={textbook.textbookName} loading="lazy" />
                      </div>

                      {/* 右侧：信息区域 */}
                      <div className="textbook-content">
                        {/* 左侧：标题、版本和状态指示器 */}
                        <div className="textbook-info">
                          {/* 标题和版本 */}
                          <div className="textbook-header">
                            <div className="textbook-title">{textbook.textbookName}</div>
                            <div className="textbook-version">
                              {textbook.textbookPublisher || '人教版'}
                              {textbook.textbookSemesterLabel && (
                                <span className="textbook-semester">{textbook.textbookSemesterLabel}</span>
                              )}
                            </div>
                          </div>

                          {/* 状态指示器 */}
                          <Tag
                            text={getDownloadStatusText(textbook)}
                            type={getDownloadStatusType(textbook)}
                            size="sm"
                            dot
                          />
                        </div>

                        {/* 右侧：操作按钮或进度条 */}
                        <div className="textbook-actions">
                          <div className="action-buttons-group">
                            {/* 下载中状态：显示进度条，点击进度条可暂停（包括更新时的下载） */}
                            {textbook.downloadStatus === 1 ? (
                              <div
                                className="download-progress-bar clickable"
                                onClick={() => handlePauseDownload(textbook)}
                                title="点击暂停下载"
                              >
                                <div className="progress-bar-container">
                                  <div
                                    className="progress-bar-fill"
                                    style={{
                                      width: `${getDownloadProgress(textbook.downloadedFiles, textbook.totalFiles || 0)}%`,
                                    }}
                                  ></div>
                                  <span className="progress-text">
                                    {getDownloadProgress(textbook.downloadedFiles, textbook.totalFiles || 0)}%
                                  </span>
                                </div>
                              </div>
                            ) : textbook.downloadStatus === 3 ? (
                              <button
                                onClick={() => downloadTextbook(textbook)}
                                className="action-btn action-btn-continue"
                              >
                                继续
                              </button>
                            ) : textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable ? (
                              <button
                                onClick={() => handleLearnTextbook(textbook)}
                                className="action-btn action-btn-learn"
                              >
                                学习
                              </button>
                            ) : textbook.isDownloaded && textbook.downloadStatus === 2 && textbook.hasUpdatesAvailable ? (
                              <button
                                onClick={() => downloadTextbook(textbook, true)}
                                className="action-btn action-btn-update"
                              >
                                更新
                              </button>
                            ) : (
                              <button
                                onClick={() => downloadTextbook(textbook)}
                                className="action-btn action-btn-download"
                              >
                                下载
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </VirtualScroll>
      )}

      {/* 空状态 (固定) */}
      {initialLoadCompleted && textbooks.length === 0 && (
        <div className="empty-state q-pa-xl text-center">
          <span className="material-icons empty-icon">book</span>
          <div className="empty-title">暂无教材数据</div>
          <div className="empty-description">请检查网络连接或重新登录</div>
          <button onClick={() => loadResources()} className="reload-btn">
            <span className="material-icons">refresh</span>
            <span>重新加载</span>
          </button>
        </div>
      )}

      <Dialog
        open={isDeleteDialogOpen}
        title="清除本地资料"
        confirmButtonText={'确认清除'}
        onConfirm={confirmDeleteTextbook}
        onCancel={() => {
          setIsDeleteDialogOpen(false)
          setDeleteTextbookId(null)
          setDeleteTextbookName('')
        }}
      >
        确定要清除《{deleteTextbookName}》的本地下载资料吗？清除后，该教材的所有相关文件将从本地移除，需要重新下载后才能学习。
      </Dialog>

      {isDev && (
        <ResourceDebugPanel
          visible={showDebugPanel}
          onClose={() => setShowDebugPanel(false)}
        />
      )}
    </div>
  )
}

export default MyResourcesView
