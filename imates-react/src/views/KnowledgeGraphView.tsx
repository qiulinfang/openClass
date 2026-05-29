import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { KnowledgeGraph } from '@/components/knowledge-graph/KnowledgeGraph'
import VirtualScroll from '@/components/base/VirtualScroll'
import Select from '@/components/base/Select'
import LearningView from '@/views/LearningView'
import LearningStatusControlPanel from '@/components/debug/LearningStatusControlPanel'
import { useKnowledgeGraphStore } from '@/stores/KnowledgeGraphStore'
import { apiService } from '@/services/http/api-service'
import { resourceManager } from '@/services/storage/resource-storage'
import { getUserId, getScopedStorageValue, getScopedStorageKey } from '@/services'
import { showMessage } from '@/utils'
import { KNOWLEDGE_GRAPH_SUBJECT_OPTIONS, type ApiSubjectType } from '@/constants/subjects'
import {
  queryShijingshanKnowledgeId,
  queryShijingshanBmNoList,
} from '@/utils/business/shijingshan-knowledge-utils'
import { convertToChineseNumber } from '@/utils/business/chapter-utils'
import type { ChapterNode, TextbookOption } from '@/types'

// 导入图标资源
import bookIcon from '/images/book.png'
import notLearnedStarIcon from '/icons/notLearnedStar.svg'
import learnedStarIcon from '/icons/learnedStar.svg'
import lastLearnedStarIcon from '/icons/lastLearnedStar.svg'
import backgroundImage from '/icons/background.svg'
import chapterSearchIcon from '/icons/chapter_search.svg'

import '@/views/KnowledgeGraphView.css'

interface KnowledgeGraphChapterStructureRecord {
  id: string // 主键：`${userId}_${textbookId}`
  userId: string
  textbookId: string
  data: ChapterNode[]
  timestamp: number
}

const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'
// 缓存过期时间（24小时）
const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000

export const KnowledgeGraphView: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const {
    setCurrentChapter,
    setCurrentTextbook,
    getCurrentTextbook,
    setCurrentChapterExpandedGraph,
    initializeChapterStates,
    getCurrentChapter,
    savePageState,
    restorePageState,
    getCurrentSubject,
  } = useKnowledgeGraphStore()

  // 响应式状态
  const [selectedSubject, setSelectedSubject] = useState<ApiSubjectType | ''>('')
  const [selectedTextbook, setSelectedTextbook] = useState('')
  const [textbookOptions, setTextbookOptions] = useState<TextbookOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showNodeSearch, setShowNodeSearch] = useState(false)
  const [chapters, setChapters] = useState<string[]>([])
  const [chapterStructure, setChapterStructure] = useState<ChapterNode[]>([])
  const [selectedChapterDetails, setSelectedChapterDetails] = useState<ChapterNode | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 学习状态相关
  const [lastLearnedNodeId, setLastLearnedNodeId] = useState<string | null>(null)
  const [learnedNodeIds, setLearnedNodeIds] = useState<Set<string>>(new Set())
  
  // 对话框相关
  const [learningDialogVisible, setLearningDialogVisible] = useState(false)
  const [learningDialogData, setLearningDialogData] = useState<{
    nodeId: string
    sectionName: string
    level: number
    textbookId: string
    chapterGrade?: string
    chapterSubject?: string
    chapterTextbook?: string
    chapterTitle?: string
  } | null>(null)
  
  // 调试相关
  const [learningStatusPanelVisible, setLearningStatusPanelVisible] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knowledgeGraphRef = useRef<any>(null)

  // 工具函数
  const normalizeApiSubject = useCallback((raw?: string): ApiSubjectType => {
    const candidate = (raw || 'math') as string
    const isValid = KNOWLEDGE_GRAPH_SUBJECT_OPTIONS.some((opt) => opt.value === candidate)
    return (isValid ? candidate : 'math') as ApiSubjectType
  }, [])

  const getSubjectLabelByValue = (subjectValue: string): string => {
    const subjectMap: Record<string, string> = {
      math: '数学',
      chinese: '语文',
      english: '英语',
      physics: '物理',
      chemistry: '化学',
      biology: '生物',
      geography: '地理',
      history: '历史',
      politics: '政治',
    }
    return subjectMap[subjectValue] || '数学'
  }

  const buildKGRecordId = (userId: string, textbookId: string): string => `${userId}_${textbookId}`

  const isCacheExpired = (timestamp: number): boolean => Date.now() - timestamp > CACHE_EXPIRE_TIME

  const getLearningStatus = useCallback((childId: string): 'notLearned' | 'learned' | 'lastLearned' => {
    if (lastLearnedNodeId === childId) return 'lastLearned'
    if (learnedNodeIds.has(childId)) return 'learned'
    return 'notLearned'
  }, [lastLearnedNodeId, learnedNodeIds])

  const mapToNewGrapChapter = useCallback((root: ChapterNode | null) => {
    if (!root) return null

    const chapter: any = {
      id: root.id,
      name: root.name || root.label || '',
      label: root.label,
      level: root.level ?? 0,
      children: [],
    }

    const sections: any[] = (root.children || []).map((sec, secIndex) => {
      const section: any = {
        id: sec.id,
        name: sec.name || sec.label || `小节 ${secIndex + 1}`,
        label: sec.label,
        level: sec.level ?? 1,
        children: [],
      }

      const hasChildren = sec.children && sec.children.length > 0

      if (hasChildren) {
        const kpList: any[] = (sec.children || []).map((kp, kpIndex) => ({
          id: kp.id,
          name: kp.name || kp.label || `知识点 ${kpIndex + 1}`,
          label: kp.label,
          level: kp.level ?? 2,
          learningStatus: getLearningStatus(kp.id),
        }))

        section.children = kpList

        if (kpList.some((kp) => kp.learningStatus === 'lastLearned')) {
          section.learningStatus = 'lastLearned'
        } else if (kpList.some((kp) => kp.learningStatus === 'learned')) {
          section.learningStatus = 'learned'
        } else {
          section.learningStatus = 'notLearned'
        }
      } else {
        section.learningStatus = getLearningStatus(sec.id)
      }

      return section
    })

    chapter.children = sections
    return chapter
  }, [getLearningStatus])

  const graphData = useMemo(() => {
    return mapToNewGrapChapter(selectedChapterDetails)
  }, [selectedChapterDetails, mapToNewGrapChapter])

  // 清理过期的缓存数据
  const cleanupExpiredCache = () => {
    try {
      const keys = Object.keys(localStorage)
      const knowledgeGraphKeys = keys.filter((key) => key.startsWith('knowledge_graph_'))

      knowledgeGraphKeys.forEach((key) => {
        const cached = localStorage.getItem(key)
        if (cached) {
          try {
            const data = JSON.parse(cached)
            if (data.timestamp && isCacheExpired(data.timestamp)) {
              localStorage.removeItem(key)
            }
          } catch {
            localStorage.removeItem(key)
          }
        }
      })
    } catch {
      // ignore
    }
  }

  // 获取当前教材的真实ID
  const getCurrentTextbookId = useCallback(() => {
    const option = textbookOptions.find((opt) => opt.value === selectedTextbook)
    if (option) {
      // 假设 value 格式为 `${subject}-${grade}-${semester}-${id}`
      const parts = option.value.split('-')
      return parts[parts.length - 1]
    }
    return ''
  }, [selectedTextbook, textbookOptions])

  // 计算属性：当前教材标签
  const selectedTextbookLabel = useMemo(() => {
    const option = textbookOptions.find((opt) => opt.value === selectedTextbook)
    if (!option) return ''

    const parts: string[] = [option.textbookPublisher || '']
    const labelParts = option.label.split(' ')
    const subjectIndex = labelParts.findIndex((part) => part === option.textbookSubjectLabel)
    
    if (subjectIndex !== -1) {
      const filteredParts = [
        ...labelParts.slice(0, subjectIndex),
        ...labelParts.slice(subjectIndex + 1),
      ]
      filteredParts.forEach((part) => {
        if (part.includes('/')) parts.push(...part.split('/'))
        else parts.push(part)
      })
    } else if (labelParts.length > 2) {
      const filteredParts = labelParts.slice(2)
      filteredParts.forEach((part) => {
        if (part.includes('/')) parts.push(...part.split('/'))
        else parts.push(part)
      })
    }
    return parts.join('/')
  }, [selectedTextbook, textbookOptions])

  // 搜索相关计算
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || chapterStructure.length === 0) return []

    const allNodes: Array<{ node: ChapterNode; chapterIndex: number; chapterName: string }> = []
    
    const collectAllNodes = (node: ChapterNode, chapterIndex: number, chapterName: string) => {
      allNodes.push({ node, chapterIndex, chapterName })
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => collectAllNodes(child, chapterIndex, chapterName))
      }
    }

    chapterStructure.forEach((chapter, index) => {
      collectAllNodes(chapter, index, chapters[index] || chapter.name)
    })

    const query = searchQuery.trim().toLowerCase()
    return allNodes.filter((item) => {
      const name = (item.node.name || '').toLowerCase()
      const label = (item.node.label || '').toLowerCase()
      return name.includes(query) || label.includes(query)
    })
  }, [searchQuery, chapterStructure, chapters])

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) {
      return chapters.map((chapter, index) => ({ chapter, index }))
    }
    return []
  }, [searchQuery, chapters])

  // 方法实现
  const loadAllDownloadedTextbooks = async (): Promise<TextbookOption[]> => {
    try {
      await resourceManager.forceFlushPendingUpdates()
      const textbooks = await resourceManager.getUserLocalTextbooks()
      if (textbooks && textbooks.length > 0) {
        const downloadedTextbooks = textbooks.filter((textbook) => {
          const hasLocalFiles = Boolean(textbook.localFiles && textbook.localFiles.length > 0)
          const isCompleted = textbook.downloadStatus === 2
          return Boolean(textbook.isDownloaded) || isCompleted || hasLocalFiles
        })
        if (downloadedTextbooks.length === 0) return []
        return downloadedTextbooks.map((textbook) => ({
          value: `${textbook.textbookSubjectLabel}-${textbook.textbookGradeLabel}-${textbook.textbookSemesterLabel}-${textbook.id}`,
          label: `${textbook.textbookGradeLabel} ${textbook.textbookSemesterLabel} ${textbook.textbookSubjectLabel} ${textbook.textbookName}`,
          textbookId: textbook.textbookId,
          subject: textbook.textbookSubjectLabel,
          grade: textbook.textbookGradeLabel,
          semester: textbook.textbookSemesterLabel,
          publisher: textbook.textbookPublisher,
          cover: textbook.textbookCover,
        }))
      }
      return []
    } catch {
      return []
    }
  }

  const getSubChapters = useCallback((chapterDetails: ChapterNode | null) => {
    if (!chapterDetails) return []
    const subChapters = chapterDetails.children?.filter((child) => child.level === 1) || []
    const exerciseNode: ChapterNode = {
      id: chapterDetails.id,
      name: chapterDetails.name,
      parentId: chapterDetails.id,
      label: chapterDetails.name,
      level: 1,
      isRoot: false,
      updateTime: new Date().toISOString(),
      children: [],
    }
    return [...subChapters, exerciseNode].reverse()
  }, [])

  const loadChaptersForTextbook = async (textbookId: string) => {
    try {
      const db = resourceManager.indexedDB
      if (!db.isInitialized) await db.init()
      const userId = getUserId() || ''
      const record = await db.get<KnowledgeGraphChapterStructureRecord>(
        'knowledge_graph_chapter_structure',
        buildKGRecordId(userId, textbookId)
      )

      let chapterData: ChapterNode[] | null = null
      if (record && !isCacheExpired(record.timestamp)) {
        chapterData = record.data
      } else {
        chapterData = await apiService.getTextbookStructure(textbookId)
        if (chapterData && chapterData.length > 0) {
          await db.put<KnowledgeGraphChapterStructureRecord>('knowledge_graph_chapter_structure', {
            id: buildKGRecordId(userId, textbookId),
            userId,
            textbookId,
            data: chapterData,
            timestamp: Date.now(),
          })
        }
      }

      if (chapterData && chapterData.length > 0) {
        setChapterStructure(chapterData)
        setChapters(chapterData.map((c) => convertToChineseNumber(c.name)))
        initializeChapterStates(textbookId, chapterData, getSubChapters)
      } else {
        setChapterStructure([])
        setChapters([])
      }
    } catch (error) {
      console.error('[KnowledgeGraph] 加载章节结构出错:', error)
      setChapterStructure([])
      setChapters([])
    }
  }

  const pickSelectedChapterIndex = (
    structure: ChapterNode[],
    preferredIndex?: number,
    preferredChapterId?: string
  ): number => {
    if (!structure.length) return -1
    if (
      typeof preferredIndex === 'number' &&
      preferredIndex >= 0 &&
      preferredIndex < structure.length
    ) {
      return preferredIndex
    }
    if (preferredChapterId) {
      const foundIndex = structure.findIndex((node) => node.id === preferredChapterId)
      if (foundIndex >= 0) return foundIndex
    }
    return 0
  }

  const syncSubjectTextbookChapter = async (params?: {
    subjectValue?: string
    preferredTextbookId?: string
    preferredTextbookValue?: string
    preferredChapterIndex?: number
    preferredChapterId?: string
  }) => {
    const rawSubject = params?.subjectValue ?? selectedSubject ?? 'math'
    const normalizedSubject = normalizeApiSubject(rawSubject)
    setSelectedSubject(normalizedSubject)

    const localOptions = await loadAllDownloadedTextbooks()
    const subjectLabel = getSubjectLabelByValue(normalizedSubject)
    const filteredOptions = localOptions.filter((option) => option.subject === subjectLabel)
    setTextbookOptions(filteredOptions)

    let targetTextbookValue = ''
    if (params?.preferredTextbookId) {
      const picked = filteredOptions.find(opt => opt.textbookId === params.preferredTextbookId || opt.value.includes(params.preferredTextbookId))
      targetTextbookValue = picked?.value || ''
    } else {
      const keepable = filteredOptions.find(opt => opt.value === (params?.preferredTextbookValue ?? selectedTextbook))
      targetTextbookValue = keepable?.value || filteredOptions[0]?.value || ''
    }

    setSelectedTextbook(targetTextbookValue)
    
    if (!targetTextbookValue) {
      setChapterStructure([])
      setChapters([])
      setSelectedChapterDetails(null)
      return
    }

    const selectedOption = filteredOptions.find((opt) => opt.value === targetTextbookValue)
    if (selectedOption?.textbookId) {
      setCurrentTextbook(selectedOption.textbookId)
      try {
        const db = resourceManager.indexedDB
        if (!db.isInitialized) await db.init()
        const userId = getUserId() || ''
        const record = await db.get<KnowledgeGraphChapterStructureRecord>(
          'knowledge_graph_chapter_structure',
          buildKGRecordId(userId, selectedOption.textbookId)
        )
        let structure: ChapterNode[] = []
        if (record && !isCacheExpired(record.timestamp)) {
          structure = record.data
        } else {
          structure = await apiService.getTextbookStructure(selectedOption.textbookId)
          if (structure?.length > 0) {
            await db.put('knowledge_graph_chapter_structure', {
              id: buildKGRecordId(userId, selectedOption.textbookId),
              userId,
              textbookId: selectedOption.textbookId,
              data: structure,
              timestamp: Date.now(),
            })
          }
        }
        
        if (structure && structure.length > 0) {
          setChapterStructure(structure)
          setChapters(structure.map((c) => convertToChineseNumber(c.name)))
          initializeChapterStates(selectedOption.textbookId, structure, getSubChapters)
          
          const storedIndex = getCurrentChapter()
          const targetIndex = pickSelectedChapterIndex(
            structure,
            params?.preferredChapterIndex ?? storedIndex,
            params?.preferredChapterId ?? selectedChapterDetails?.id
          )
          
          setCurrentChapter(targetIndex)
          setSelectedChapterDetails(structure[targetIndex])
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  const checkAndOpenLearningDialog = () => {
    const initOpenLearning = searchParams.get('openLearning') === 'true'
    if (initOpenLearning) {
      const learningNodeId = searchParams.get('learningNodeId')
      const learningSectionName = searchParams.get('learningSectionName')
      const learningLevel = searchParams.get('learningLevel')
      const textbookId = searchParams.get('textbookId')

      if (learningNodeId && learningSectionName && textbookId) {
        setLearningDialogData({
          nodeId: learningNodeId,
          sectionName: learningSectionName,
          level: parseInt(learningLevel || '1'),
          textbookId: textbookId,
          chapterGrade: searchParams.get('learningChapterGrade') || '',
          chapterSubject: searchParams.get('learningChapterSubject') || '',
          chapterTextbook: searchParams.get('learningChapterTextbook') || '',
          chapterTitle: searchParams.get('learningChapterTitle') || '',
        })
        setLearningDialogVisible(true)
        
        // 清理路由参数
        setSearchParams({}, { replace: true })
      }
    }
  }

  // 业务动作
  const actionLearn = async (node: { id: string; name: string; level?: number }) => {
    const textbookRecordId = getCurrentTextbookId()
    if (!textbookRecordId) {
      showMessage(`《${node.name}》暂无学习方案，请选择其他知识点进行学习`, 'warning')
      return
    }

    try {
      const textbooks = await resourceManager.getUserLocalTextbooks()
      const textbook = textbooks.find((t) => t.id === textbookRecordId)
      
      if (!textbook) {
        showMessage(`《${node.name}》学习资源未下载，请先下载教材资源`, 'warning')
        return
      }

      const hasLocalFiles = Boolean(textbook.localFiles && textbook.localFiles.length > 0)
      if (!hasLocalFiles) {
        showMessage(`《${node.name}》学习资源未下载，请先下载教材资源`, 'warning')
        return
      }

      // 检查本地文件是否真正存在
      const sampleFiles = textbook.localFiles.slice(0, Math.min(3, textbook.localFiles.length))
      let hasActualFileData = false
      for (const file of sampleFiles) {
        const fileExists = await resourceManager.hasFileData(textbook.id, file.id)
        if (fileExists) {
          hasActualFileData = true
          break
        }
      }

      if (!hasActualFileData && textbook.localFiles.length > 0) {
        showMessage(`《${node.name}》学习资源未下载，请先下载教材资源`, 'warning')
        return
      }

      if (!textbook.learningPackages?.length) {
        showMessage(`《${node.name}》暂无学习方案，请选择其他知识点进行学习`, 'warning')
        return
      }

      setLastLearnedNodeId(node.id)
      const key = getScopedStorageKey('LAST_LEARNED_NODE_ID')
      localStorage.setItem(key, node.id)

      const currentOption = textbookOptions.find(opt => opt.value === selectedTextbook)
      setLearningDialogData({
        nodeId: node.id,
        sectionName: node.name,
        level: node.level ?? 0,
        textbookId: textbookRecordId,
        chapterGrade: currentOption?.grade || '',
        chapterSubject: currentOption?.subject || '',
        chapterTextbook: currentOption ? currentOption.label.split(' ').slice(3).join(' ') : '',
        chapterTitle: node.name,
      })
      setLearningDialogVisible(true)
    } catch (error) {
      console.error('检查学习方案失败:', error)
    }
  }

  const actionPractice = async (node: { id: string; name: string }) => {
    const currentOption = textbookOptions.find(opt => opt.value === selectedTextbook)
    const textbookId = currentOption?.textbookId
    const subjectLabel = getSubjectLabelByValue(selectedSubject)

    if (!textbookId || !subjectLabel) {
      showMessage('缺少教材信息，无法查询习题', 'warning')
      return
    }

    try {
      const subjectForApi = (selectedSubject || 'math') as ApiSubjectType
      const shijingshanBmNoList = await queryShijingshanBmNoList(textbookId, node.id, node.name, subjectForApi)

      if (shijingshanBmNoList?.trim()) {
        navigate({
          pathname: '/find-exercise',
          search: `?bmNoList=${shijingshanBmNoList.trim()}&subject=${subjectForApi}&token=${getScopedStorageValue('token') || ''}`
        })
        return
      }

      const shijingshanKnowledgeId = await queryShijingshanKnowledgeId(textbookId, node.id, node.name, subjectForApi)
      let knowledgeList = shijingshanKnowledgeId || await apiService.queryKnowledgeIdsByNodeId({
        subject: subjectForApi,
        param: [{ textbook_id: textbookId, section_id: node.id }]
      })

      navigate({
        pathname: '/find-exercise',
        search: `?knowledgeList=${knowledgeList}&subject=${subjectForApi}&token=${getScopedStorageValue('token') || ''}`
      })
    } catch (error: any) {
      if (error?.code === 'NO_QUESTIONS') {
        showMessage(error.message, 'warning')
      } else {
        showMessage('查询知识点失败，请重试', 'error')
      }
    }
  }

  const handleSearchResultClick = async (result: { node: ChapterNode; chapterIndex: number }) => {
    const currentIdx = getCurrentChapter()
    if (currentIdx !== result.chapterIndex) {
      setCurrentChapter(result.chapterIndex)
      setSelectedChapterDetails(chapterStructure[result.chapterIndex])
      await new Promise(r => setTimeout(r, 0))
    }

    const chapter = chapterStructure[result.chapterIndex]
    if (!chapter) return

    const subChapters = getSubChapters(chapter)
    let targetNodeId: string | null = null

    if (result.node.level === 0) {
      setSearchQuery('')
      return
    }

    if (result.node.level === 1) {
      targetNodeId = result.node.id
    } else if (result.node.level && result.node.level > 1) {
      let current: ChapterNode | null = result.node
      while (current && current.level !== 1) {
        if (!current.parentId) break
        const findParent = (nodes: ChapterNode[]): ChapterNode | null => {
          for (const n of nodes) {
            if (n.id === current?.parentId) return n
            if (n.children) {
              const f = findParent(n.children)
              if (f) return f
            }
          }
          return null
        }
        current = findParent(chapter.children || [])
      }
      if (current?.level === 1) targetNodeId = current.id
    }

    if (targetNodeId) {
      const exists = subChapters.some(s => s.id === targetNodeId)
      if (exists) {
        setCurrentChapterExpandedGraph(targetNodeId)
        if (knowledgeGraphRef.current?.focusOnNodeId) {
          knowledgeGraphRef.current.focusOnNodeId(targetNodeId, true)
        }
        setSearchQuery('')
      }
    }
  }

  // 初始化 useEffect
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      cleanupExpiredCache()
      
      const initSubject = searchParams.get('initSubject')
      const initTextbookId = searchParams.get('initTextbookId')
      
      const savedState = restorePageState()
      
      if (initSubject || initTextbookId) {
        await syncSubjectTextbookChapter({
          subjectValue: initSubject || undefined,
          preferredTextbookId: initTextbookId || undefined,
          preferredTextbookValue: selectedTextbook,
          preferredChapterIndex: getCurrentChapter(),
          preferredChapterId: selectedChapterDetails?.id,
        })
      } else if (savedState) {
        setSelectedSubject(normalizeApiSubject(savedState.selectedSubject))
        setChapters(savedState.chapters)
        setChapterStructure(savedState.chapterStructure)
        setTextbookOptions(savedState.textbookOptions || [])
        setSelectedTextbook(savedState.selectedTextbook)
        
        await syncSubjectTextbookChapter({
          subjectValue: savedState.selectedSubject || 'math',
          preferredTextbookValue: savedState.selectedTextbook,
          preferredChapterIndex: savedState.selectedChapterIndex,
          preferredChapterId: savedState.selectedChapterDetails?.id,
        })
      } else {
        await syncSubjectTextbookChapter({
          subjectValue: getCurrentSubject() || 'math',
          preferredTextbookId: getCurrentTextbook() || undefined,
          preferredTextbookValue: selectedTextbook,
          preferredChapterIndex: getCurrentChapter(),
          preferredChapterId: selectedChapterDetails?.id,
        })
      }
      
      checkAndOpenLearningDialog()
      setLoading(false)
    }
    init()
    
    const userId = getUserId()
    const lastNodeKey = getScopedStorageKey('LAST_LEARNED_NODE_ID')
    const lastNode = localStorage.getItem(lastNodeKey)
    setLastLearnedNodeId(lastNode)
    const learnedNodesKey = getScopedStorageKey('LEARNED_NODES')
    const learnedNodes = localStorage.getItem(learnedNodesKey)
    if (learnedNodes) setLearnedNodeIds(new Set(JSON.parse(learnedNodes)))

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // 状态自动保存
  useEffect(() => {
    if (!loading) {
      savePageState({
        selectedSubject,
        selectedTextbook,
        selectedChapterIndex: getCurrentChapter(),
        selectedChapterDetails,
        chapters,
        chapterStructure,
        textbookOptions,
      })
    }
  }, [selectedSubject, selectedTextbook, selectedChapterDetails, chapters, chapterStructure, textbookOptions, loading, getCurrentChapter, savePageState])

  const convertBrackets = (text: string): string => {
    return text.replace(/【/g, '[').replace(/】/g, ']')
  }

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text
    const query = searchQuery.trim()
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
    )
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  const toggleNodeSearch = () => {
    setShowNodeSearch(!showNodeSearch)
    if (showNodeSearch) {
      setSearchQuery('')
    }
  }

  return (
    <div className="knowledge-graph-content" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="chapter-sidebar">
        <div className="subject-header">
          <img src={bookIcon} className="subject-icon" alt="book" />
          <Select
            value={selectedSubject}
            options={KNOWLEDGE_GRAPH_SUBJECT_OPTIONS}
            className="subject-select"
            placeholder="请选择学科"
            onChange={(val) => {
              const subject = String(val)
              setSelectedSubject(subject as ApiSubjectType)
              syncSubjectTextbookChapter({ subjectValue: subject, preferredTextbookValue: '' })
            }}
          />
        </div>

        {textbookOptions.length > 0 && (
          <div className="textbook-info">
            <Select
              value={selectedTextbook}
              options={textbookOptions.map(opt => ({ label: opt.label, value: opt.value }))}
              className="textbook-select"
              placeholder="请选择教材"
              renderLabel={() => selectedTextbookLabel}
              onChange={(val) => {
                const value = String(val)
                setSelectedTextbook(value)
                const opt = textbookOptions.find(o => o.value === value)
                if (opt) {
                  setCurrentTextbook(opt.textbookId)
                  loadChaptersForTextbook(opt.textbookId)
                }
              }}
            />
          </div>
        )}

        <div className="chapter-search" style={{ display: showNodeSearch ? 'block' : 'none' }}>
          <div className="search-input-wrapper">
            <span className="search-icon-prepend">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="搜索节点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-btn" onClick={clearSearch}>×</button>
            )}
          </div>
        </div>

        <VirtualScroll className="chapter-list">
          {searchQuery && searchResults.length > 0 ? (
            searchResults.map((result, i) => (
              <div
                key={`${result.chapterIndex}-${result.node.id}-${i}`}
                className="chapter-item touch-target search-result-item"
                onClick={() => handleSearchResultClick(result)}
              >
                <div className="search-result-content">
                  <div className="search-result-node">{highlightText(result.node.name || result.node.label || '')}</div>
                  <div className="search-result-chapter">{result.chapterName}</div>
                </div>
              </div>
            ))
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="empty-chapters">
              <div className="empty-text">未找到匹配的节点</div>
            </div>
          ) : filteredChapters.length === 0 ? (
            <div className="empty-chapters">
              <div className="empty-text">未下载任何教材</div>
            </div>
          ) : (
            filteredChapters.map((item) => (
              <div
                key={item.index}
                className={`chapter-item touch-target ${getCurrentChapter() === item.index ? 'active' : ''}`}
                onClick={() => {
                  if (getCurrentChapter() === item.index) return
                  setCurrentChapter(item.index)
                  setSelectedChapterDetails(chapterStructure[item.index])
                }}
              >
                <span className="chapter-text">{highlightText(convertBrackets(item.chapter))}</span>
              </div>
            ))
          )}
        </VirtualScroll>
      </div>

      <div className="main-content">
        <div className="top-right-toolbar">
          <button className="toolbar-icon-btn" onClick={() => setShowNodeSearch(!showNodeSearch)}>
            <img src={chapterSearchIcon} alt="搜索节点" className="toolbar-icon" />
          </button>
        </div>

        <div className="circular-graphs-container">
          <KnowledgeGraph 
            ref={knowledgeGraphRef}
            data={graphData || undefined}
            onAction={(type: any, data: any) => {
              if (type === 'learn') actionLearn(data)
              else if (type === 'practice') actionPractice(data)
            }}
          />
        </div>

        {selectedChapterDetails && (
          <div className="status-indicators">
            <div className="status-item">
              <img src={notLearnedStarIcon} alt="未学习" className="status-icon" />
              <span className="status-label">未学习</span>
            </div>
            <div className="status-item">
              <img src={learnedStarIcon} alt="已学习" className="status-icon" />
              <span className="status-label">已学习</span>
            </div>
            <div className="status-item">
              <img src={lastLearnedStarIcon} alt="上次学到" className="status-icon" />
              <span className="status-label">上次学到</span>
            </div>
          </div>
        )}
      </div>

      {learningDialogVisible && learningDialogData && (
        <LearningView
          isOpen={learningDialogVisible}
          onClose={() => setLearningDialogVisible(false)}
          {...learningDialogData}
        />
      )}

      {isDev && (
        <LearningStatusControlPanel
          isOpen={learningStatusPanelVisible}
          onClose={() => setLearningStatusPanelVisible(false)}
          chapterStructure={chapterStructure}
          onRefresh={() => setSelectedChapterDetails(prev => prev ? { ...prev } : null)}
        />
      )}
    </div>
  )
}

export default KnowledgeGraphView
