import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useNavigate } from 'react-router-dom'
import { showMessage, ThrottleUtils, throttle } from '@/utils'
import { useQuestionStore } from '@/stores/questionStore'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import type { ExerciseItem } from '@/types'
import { MathJaxUtils } from '@/utils/math/mathjax'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'

import MiniClass from '@/components/display/MiniClass'
import ImageViewer from '@/components/display/ImageViewer'
import VirtualScroll, { VirtualScrollRef } from '@/components/base/VirtualScroll'
import Dialog from '@/components/base/Dialog'
import Modal from '@/components/base/Modal'
import BubblePopup from '@/components/base/Popover'
import ActionList from '@/components/base/DropdownMenu'
import AnswerView from '@/components/exercise/AnswerView'
import SimilarQuestionList from '@/components/exercise/SimilarQuestionList'
import { toggleExerciseFavorite, getFavoriteExercises } from '@/utils/storage/favorites'
import { normalizeSubject } from '@/constants/subjects'
import { isMistake, getAllMistakes } from '@/services/storage/mistake-storage'

// 策略模式支持
import { QuestionListType, createQuestionListStrategy } from '@/components/question/strategies'

// 导入拍照搜题图标
import searchQuestionIcon from '/icons/search_question.svg'
// 导入功能图标
import zhidingIcon from '/icons/zhiding.svg'
import quxiaozhidingIcon from '/icons/quxiaozhiding.svg'
import shoucangIcon from '/icons/shoucang1.svg'
import xingxingLightIcon from '/icons/xingxing-light.svg'
import askXuebanIcon from '/icons/askXueban.svg'
import weikeIcon from '/icons/weike.svg'
import daanIcon from '/icons/daan.svg'
import juyifansanIcon from '/icons/juyifansan.svg'

import '@/components/question/QuestionList.css'

interface QuestionListProps {
  // 搜索查询字符串
  searchQuery?: string
  // 选中的学科过滤器
  selectedSubjectFilter?: string | null
  // 题目列表数据
  questions?: ExerciseItem[]
  // 当前选中的题目
  currentQuestion?: ExerciseItem | null
  // 是否显示拍照搜题功能
  showPhotoSearch?: boolean
  // 是否显示发送给AI功能
  showSendToAi?: boolean
  // 是否显示题目操作按钮
  showQuestionActions?: boolean
  // 是否显示错题标识
  showMistakeBadge?: boolean
  // 是否处于加载状态
  loading?: boolean
  // 题目列表类型
  type?: QuestionListType
  // 开始AI辅导的回调
  onStartAiGuidance?: (question: ExerciseItem) => void
  // 题目被选中的回调
  onQuestionSelected?: (question: ExerciseItem, index: number) => void
  // 打开微课的回调
  onOpenMiniClass?: (question: ExerciseItem) => void
  // 查看答案的回调
  onViewAnswer?: () => void
  // 查看相似题的回调
  onViewSimilar?: () => void
  // 更新搜索查询的回调
  'update:searchQuery'?: (value: string) => void
  // 题目删除的回调
  onQuestionDeleted?: (payload: { questionId: string; withDraft: boolean }) => void
  // 粘贴到草稿的回调
  onPasteToDraft?: (payload: { dataUrl: string; questionId: string }) => void
  // 刷新的回调
  onRefresh?: () => void
  // 移动到顶部的回调
  onMoveToTop?: (questionId: string) => void
  // 渲染题目编号额外内容的回调
  renderQuestionNumberExtra?: (question: ExerciseItem) => React.ReactNode
  // 渲染题目状态的回调
  renderQuestionStatus?: (question: ExerciseItem) => React.ReactNode
  // 渲染操作按钮额外内容的回调
  renderActionsAppend?: (question: ExerciseItem) => React.ReactNode
  // 渲染更多操作额外内容的回调
  renderMoreExtra?: (question: ExerciseItem, index: number, close: () => void) => React.ReactNode
}

export const QuestionList = forwardRef<any, QuestionListProps>((props, ref) => {
  const {
    searchQuery: propsSearchQuery,
    selectedSubjectFilter: propsSelectedSubjectFilter,
    questions: propsQuestions = [],
    currentQuestion: propsCurrentQuestion,
    showPhotoSearch = true,
    showSendToAi = true,
    showQuestionActions = true,
    showMistakeBadge = true,
    loading = false,
    type = 'exercise',
    onStartAiGuidance,
    onQuestionSelected,
    onOpenMiniClass,
    onViewAnswer,
    onViewSimilar,
    'update:searchQuery': onUpdateSearchQuery,
    onQuestionDeleted,
    onPasteToDraft,
    onRefresh,
    onMoveToTop,
    renderQuestionNumberExtra,
    renderQuestionStatus,
    renderActionsAppend,
    renderMoreExtra,
  } = props

  const navigate = useNavigate()
  const PAGE_SIZE = 50

  // 响应式数据
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [renderingQuestions, setRenderingQuestions] = useState(false)
  // 题目渲染完成状态
  const [questionRenderedMap, setQuestionRenderedMap] = useState<Map<string, boolean>>(new Map())
  const [favoriteStatus, setFavoriteStatus] = useState<Map<string, boolean>>(new Map())
  const [mistakeStatus, setMistakeStatus] = useState<Map<string, boolean>>(new Map())
  const [deletingIds, setDeletingIds] = useState(new Set<string>())
  const [showMoreMenu, setShowMoreMenu] = useState<Record<string, boolean>>({})
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [showMiniClassDialog, setShowMiniClassDialog] = useState(false)
  const [miniClassUrl, setMiniClassUrl] = useState('')
  const [miniClassQuestionTitle, setMiniClassQuestionTitle] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTargetQuestion, setDeleteTargetQuestion] = useState<ExerciseItem | null>(null)
  const [deleteWithChat, setDeleteWithChat] = useState(false)
  const [deleteWithDraft, setDeleteWithDraft] = useState(false)
  const [showAnswerDialog, setShowAnswerDialog] = useState(false)
  const [showSimilarDialog, setShowSimilarDialog] = useState(false)

  const scrollContainer = useRef<VirtualScrollRef>(null)
  const contentRefs = useRef<Map<string, HTMLElement>>(new Map())
  const questionCardRefs = useRef<Map<string, HTMLElement>>(new Map())
  const resizeObservers = useRef<Map<string, ResizeObserver>>(new Map())
  const heightMeasurementTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const aiExerciseStore = useAiExerciseChatStore()
  const { renderMessageContent } = useMessageRenderer()

  // 策略实例
  const strategy = useMemo(() => createQuestionListStrategy(type), [type])

  const searchQuery = propsSearchQuery !== undefined ? propsSearchQuery || '' : internalSearchQuery
  const selectedSubjectFilter = propsSelectedSubjectFilter || null

  const questions = propsQuestions
  const currentQuestion = propsCurrentQuestion || strategy.getCurrentQuestion()

  // 拍照搜题处理
  const currentSubjectForPhotoSearch = useMemo(() => {
    if (currentQuestion?.subject) {
      return normalizeSubject(currentQuestion.subject)
    }
    if (selectedSubjectFilter) {
      return normalizeSubject(selectedSubjectFilter)
    }
    return 'math'
  }, [currentQuestion, selectedSubjectFilter])

  // 获取题目唯一标识 ID
  const getQuestionUniqueId = (question: ExerciseItem | null | undefined): string => {
    if (!question) return ''
    return (question.bmNo || question.id || (question as any).questionId || question.title || '').toString()
  }

  // 判断指定题目 ID 是否被选中
  const isQuestionSelected = (questionId: string): boolean => {
    if (!currentQuestion) return false
    return getQuestionUniqueId(currentQuestion) === questionId
  }

  const questionIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    questions.forEach((q, idx) => {
      const key = getQuestionUniqueId(q)
      if (key) map.set(key, idx)
    })
    return map
  }, [questions])

  // 获取题目在当前显示列表中的 1-indexed 序号
  const getQuestionDisplayIndex = (questionId: string): number => {
    const idx = questionIndexMap.get(questionId)
    return typeof idx === 'number' ? idx + 1 : 0
  }

  const filteredQuestions = useMemo(() => {
    let result = questions
    if (selectedSubjectFilter) {
      const filterSubject = normalizeSubject(selectedSubjectFilter)
      result = result.filter(q => normalizeSubject((q as any).subject) === filterSubject)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(q =>
        (q.title && q.title.toLowerCase().includes(query)) ||
        (q.question && q.question.toLowerCase().includes(query))
      )
    }
    return result
  }, [questions, selectedSubjectFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE))

  const displayedQuestions = useMemo(() => {
    const page = Math.min(currentPage, totalPages)
    const start = (page - 1) * PAGE_SIZE
    return filteredQuestions.slice(start, start + PAGE_SIZE)
  }, [filteredQuestions, currentPage, totalPages])

  const canViewAnswer = aiExerciseStore.canViewAnswer

  // 批量更新题目在本地存储中的错题状态标识
  const updateMistakeStatus = async () => {
    try {
      const allMistakes = await getAllMistakes()
      const mistakeIds = new Set(allMistakes.map(m => m.bmNo))
      const statusMap = new Map<string, boolean>()
      questions.forEach(q => {
        const id = getQuestionUniqueId(q)
        if (id) statusMap.set(id, mistakeIds.has(id))
      })
      setMistakeStatus(statusMap)
    } catch (error) {
      console.error('[QuestionList] ❌ 批量更新错题状态失败:', error)
    }
  }

  useEffect(() => {
    updateMistakeStatus()
  }, [questions])

  // 从本地存储初始化题目的收藏状态映射
  const initFavoriteStatus = () => {
    const favorites = getFavoriteExercises()
    const statusMap = new Map<string, boolean>()
    favorites.forEach(f => statusMap.set(f.item.bmNo, true))
    setFavoriteStatus(statusMap)
  }

  useEffect(() => {
    initFavoriteStatus()
  }, [])

  // 拦截并阻止 Markdown 内容中链接的默认点击行为
  const handleLinkClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null
    const linkElement = target?.closest?.('a[href]') as HTMLAnchorElement | null
    if (linkElement) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  // 处理搜索框输入变化，支持受控与非受控模式
  const handleSearchInput = (value: string | number | null) => {
    const next = (value || '').toString()
    if (onUpdateSearchQuery) {
      onUpdateSearchQuery(next)
    } else {
      setInternalSearchQuery(next)
    }
    setCurrentPage(1)
  }

  // 跳转至拍照搜题页面，并携带当前学科上下文
  const handlePhotoSearch = () => {
    const subject = currentSubjectForPhotoSearch
    navigate(`/photo-search?subject=${subject}`)
  }

  // 触发选中题目回调事件
  const selectQuestion = async (question: ExerciseItem, index: number) => {
    const realIndex = questionIndexMap.get(getQuestionUniqueId(question)) ?? index
    if (realIndex >= 0 && realIndex < questions.length) {
      onQuestionSelected?.(question, realIndex)
    }
  }

  // 选中指定索引题目并将其滚动至可视区域中央
  const scrollToQuestionAndSelect = async (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= filteredQuestions.length) return
    const question = filteredQuestions[targetIndex]
    await selectQuestion(question, targetIndex)
    setTimeout(() => scrollToCurrentQuestion(targetIndex), 100)
  }

  // 开启 AI 指导流程（已添加 3 秒节流）
  const sendToAi = useCallback(throttle(async (question: ExerciseItem) => {
    onStartAiGuidance?.(question)
  }, 3000), [onStartAiGuidance])

  // 动态拼接微课链接并打开微课弹窗
  const openMiniClass = (question: ExerciseItem) => {
    const bmNo = (question.bmNo || '').trim()
    if (!bmNo) {
      showMessage('题目编号缺失，无法打开微课', 'warning')
      return
    }
    const subjectPrefix = (question.subject || 'math').toLowerCase()
    const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`

    setMiniClassUrl(classUrl)
    setMiniClassQuestionTitle(question.title || question.question || '')
    setShowMiniClassDialog(true)
    onOpenMiniClass?.(question)
  }

  // 弹出查看答案对话框
  const handleViewAnswer = () => {
    setShowAnswerDialog(true)
    onViewAnswer?.()
  }

  // 弹出举一反三（相似题）对话框
  const handleViewSimilar = () => {
    setShowSimilarDialog(true)
    onViewSimilar?.()
  }

  // 切换题目的收藏状态并同步至本地存储
  const toggleFavorite = (item: ExerciseItem) => {
    const id = getQuestionUniqueId(item)
    const isFav = favoriteStatus.get(id) ?? false
    const success = toggleExerciseFavorite(item)
    if (success) {
      const nextMap = new Map(favoriteStatus)
      nextMap.set(id, !isFav)
      setFavoriteStatus(nextMap)
      showMessage(!isFav ? '已收藏' : '已取消收藏', 'success')
    } else {
      showMessage('操作失败，请重试', 'error')
    }
  }

  // 根据当前策略能力构造更多操作菜单列表
  const buildMoreActions = (question: ExerciseItem, index: number) => {
    const id = getQuestionUniqueId(question)
    const isFav = favoriteStatus.get(id) ?? false

    return [
      {
        key: 'pin',
        label: index === 0 ? '取消置顶' : '置顶',
        icon: index === 0 ? quxiaozhidingIcon : zhidingIcon,
        visible: strategy.canMoveToTop(),
        onClick: () => {
          if (onMoveToTop) {
            onMoveToTop(id)
          } else {
            (strategy as any).moveQuestionToTopById?.(id)
          }
          setShowMoreMenu(prev => ({ ...prev, [id]: false }))
        }
      },
      {
        key: 'favorite',
        label: isFav ? '取消收藏' : '收藏题目',
        icon: isFav ? xingxingLightIcon : shoucangIcon,
        visible: strategy.canFavorite(),
        onClick: () => {
          toggleFavorite(question)
          setShowMoreMenu(prev => ({ ...prev, [id]: false }))
        }
      },
      {
        key: 'delete',
        label: deletingIds.has(id) ? '删除中...' : '删除题目',
        icon: '/icons/delete.svg',
        visible: strategy.canDelete(),
        onClick: () => {
          setDeleteTargetQuestion(question)
          setShowDeleteDialog(true)
          setShowMoreMenu(prev => ({ ...prev, [id]: false }))
        }
      }
    ]
  }

  // 执行题目删除逻辑，包括聊天记录和草稿的联动清理
  const handleDeleteConfirm = async () => {
    if (!deleteTargetQuestion) return
    const id = getQuestionUniqueId(deleteTargetQuestion)
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      const index = questionIndexMap.get(id)
      if (index !== undefined) {
        // 如果删除的是当前选中的题目
        const deletedWasCurrent = getQuestionUniqueId(currentQuestion) === id

        await strategy.deleteQuestion(index, { subject: deleteTargetQuestion.subject, deleteChat: deleteWithChat })

        if (deleteWithChat) {
          await aiExerciseStore.clearChatHistory(id)
        }

        onQuestionDeleted?.({ questionId: id, withDraft: deleteWithDraft })

        // 如果删除的是当前题目且列表还有题目，自动选择第一个题目
        const remainingQuestions = strategy.getQuestions()
        if (deletedWasCurrent && remainingQuestions.length > 0) {
          const newQuestion = remainingQuestions[0]
          await strategy.selectQuestion(0)
          onQuestionSelected?.(newQuestion, 0)
        }

        showMessage('删除成功', 'success')
      }
    } catch (err) {
      showMessage('删除失败', 'error')
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setShowDeleteDialog(false)
      setDeleteTargetQuestion(null)
    }
  }

  // 处理下拉刷新事件，通知父组件更新数据
  const handlePullDownRefresh = async () => {
    onRefresh?.()
    scrollContainer.current?.finishRefresh()
  }

  // 绑定题目卡片 Ref 并监听其高度动态变化
  const setQuestionCardRef = (el: HTMLElement | null, id: string, index: number) => {
    if (!el || questionCardRefs.current.has(id)) return
    questionCardRefs.current.set(id, el)

    const observer = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const height = entry.target.getBoundingClientRect().height
        clearTimeout(heightMeasurementTimers.current.get(id))
        const timer = setTimeout(() => {
          if (height > 0) {
            // 这里可以记录高度，如果后续 VirtualScroll 需要的话
          }
        }, 200)
        heightMeasurementTimers.current.set(id, timer)
      })
    })
    observer.observe(el)
    resizeObservers.current.set(id, observer)

    // 立即测量
    setTimeout(() => {
      const height = el.getBoundingClientRect().height
      if (height > 0) {
        // 记录初始高度
      }
    }, 300)
  }

  // 为 Markdown 容器内的所有图片注入点击预览监听器
  const attachImageClickListeners = (container: HTMLElement) => {
    const images = container.querySelectorAll('img')
    images.forEach((img) => {
      if (!img.parentElement?.classList.contains('question-img-wrap')) {
        const wrapper = document.createElement('span')
        wrapper.className = 'question-img-wrap'
        wrapper.style.display = 'inline-block'
        wrapper.style.position = 'relative'
        wrapper.style.lineHeight = '0'
        img.parentNode?.insertBefore(wrapper, img)
        wrapper.appendChild(img)
      }
      img.style.cursor = 'default'
      // React 版本保留点击预览功能，但将 cursor 设为 default 以对齐 Vue 的样式代码
      img.onclick = (e) => {
        e.stopPropagation()
        setPreviewImageUrl(img.src)
        setShowImagePreview(true)
      }
    })
  }

  // 题目内容挂载回调：执行 MathJax 渲染、图片监听注入及渲染状态记录
  const handleContentRef = useCallback((el: HTMLElement | null, id: string) => {
    if (el) {
      if (contentRefs.current.get(id) === el && questionRenderedMap.get(id)) return

      contentRefs.current.set(id, el)
      MathJaxUtils.renderMath(el, false).then(() => {
        setQuestionRenderedMap(prev => {
          if (prev.get(id)) return prev
          return new Map(prev).set(id, true)
        })
      })
      attachImageClickListeners(el)
    }
  }, [questionRenderedMap, renderMessageContent])

  // 监听题目内容区域的粘贴事件，支持将图片粘贴至草稿本
  const handlePaste = (e: React.ClipboardEvent, questionId: string) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string
            onPasteToDraft?.({ dataUrl, questionId })
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  // 将当前选中题目（或指定索引题目）平滑滚动至列表中央
  const scrollToCurrentQuestion = (targetIndex?: number) => {
    const indexToScroll = targetIndex !== undefined ? targetIndex : questionIndexMap.get(getQuestionUniqueId(currentQuestion)) ?? -1
    if (indexToScroll < 0 || !scrollContainer.current) return

    const actualContainer = scrollContainer.current.scrollContainerRef.current
    if (!actualContainer) return

    const targetElement = actualContainer.querySelector(`[data-index="${indexToScroll}"]`)
    if (targetElement) {
      const containerHeight = actualContainer.clientHeight
      const elementTop = (targetElement as HTMLElement).offsetTop
      const elementHeight = (targetElement as HTMLElement).offsetHeight
      const targetScrollTop = Math.max(0, elementTop - (containerHeight - elementHeight) / 2)

      actualContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })
    }
  }

  useImperativeHandle(ref, () => ({
    scrollToCurrentQuestion,
    handlePullDownRefresh,
    selectQuestion,
    scrollToQuestionAndSelect,
    refreshQuestions: handlePullDownRefresh,
    getSelectedQuestion: () => currentQuestion,
  }))

  return (
    /* 1. 主容器：拦截点击冒泡 */
    <div className="question-list" onClickCapture={handleLinkClick} onClick={(e) => e.stopPropagation()}>
      
      {/* 2. 全局加载遮罩 */}
      {(loading || renderingQuestions) && (
        <div className="question-list-loading-overlay">
          <div className="question-list-loading-spinner"></div>
          <div className="question-list-loading-text">题目加载中...</div>
        </div>
      )}

      {/* 3. 搜索与功能顶栏 */}
      <div className="search-container">
        {showPhotoSearch && strategy.canPhotoSearch() && (
          <button className="photo-search-btn" onClick={handlePhotoSearch}>
            <img src={searchQuestionIcon} alt="拍照搜题" className="photo-search-icon" />
          </button>
        )}
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="搜索题目..."
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* 4. 虚拟滚动题目列表 */}
      <VirtualScroll
        ref={scrollContainer}
        className="question-cards-container"
        enableRefresh
        onRefresh={handlePullDownRefresh}
        loading={renderingQuestions}
      >
        {/* 4.1 空状态展示 */}
        {displayedQuestions.length === 0 && !loading ? (
          <div className="native-empty-state">
            <div className="empty-icon">quiz</div>
            <div className="empty-text">
              {searchQuery || selectedSubjectFilter ? strategy.getNoResultText() : strategy.getEmptyText()}
            </div>
            {!searchQuery && (
              <button className="reload-btn" onClick={handlePullDownRefresh}>重新加载</button>
            )}
          </div>
        ) : (
          /* 4.2 题目卡片列表 */
          <div className="question-cards-list">
            {displayedQuestions.map((question, index) => {
              const id = getQuestionUniqueId(question)
              const isSelected = isQuestionSelected(id)
              return (
                <div key={id} className="question-item-wrapper" data-index={index}>
                  <div
                    ref={(el) => setQuestionCardRef(el, id, index)}
                    className={`question-card ${isSelected ? 'question-selected' : ''} ${deletingIds.has(id) ? 'question-deleting' : ''}`}
                    onClick={() => selectQuestion(question, index)}
                  >
                    <div className="question-block">
                      {/* 题目头部：序号、标签、操作按钮 */}
                      <div className="question-header">
                        <div className="question-title-row">
                          <div className="question-number">题目{getQuestionDisplayIndex(id)}</div>
                          {renderQuestionNumberExtra?.(question)}
                          {showMistakeBadge && mistakeStatus.get(id) && (
                            <div className="mistake-badge">
                              <span className="badge-icon">history</span>
                              <span>往日错题</span>
                            </div>
                          )}
                        </div>
                        {/* 选中时的功能按钮区 */}
                        <div className="question-actions">
                          {renderQuestionStatus?.(question)}
                          {isSelected && showQuestionActions && (
                            <>
                              {strategy.canSendToAi() && showSendToAi && (
                                <button className="action-btn" onClick={(e) => { e.stopPropagation(); sendToAi(question); }}>
                                  <img src={askXuebanIcon} alt="问问学伴" className="action-icon" />
                                </button>
                              )}
                              {strategy.canOpenMiniClass() && (
                                <button className="action-btn" onClick={(e) => { e.stopPropagation(); openMiniClass(question); }}>
                                  <img src={weikeIcon} alt="微课" className="action-icon" />
                                </button>
                              )}
                              <button
                                className={`action-btn ${!canViewAnswer ? 'disabled' : ''}`}
                                disabled={!canViewAnswer}
                                title={canViewAnswer ? '查看答案' : `需与AI交互${(aiExerciseStore as any).VIEW_ANSWER_CHAT_TIMES || 3}次后可查看`}
                                onClick={(e) => { e.stopPropagation(); handleViewAnswer(); }}
                              >
                                <img src={daanIcon} alt="答案" className={`action-icon ${!canViewAnswer ? 'icon-disabled' : ''}`} />
                              </button>
                              <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleViewSimilar(); }}>
                                <img src={juyifansanIcon} alt="相似" className="action-icon" />
                              </button>
                              {/* 更多菜单：置顶、收藏、删除 */}
                              <BubblePopup
                                visible={showMoreMenu[id]}
                                onVisibleChange={(visible) => setShowMoreMenu(prev => ({ ...prev, [id]: visible }))}
                                content={
                                  <div className="action-list-wrapper">
                                    <ActionList items={buildMoreActions(question, index)} />
                                    {renderMoreExtra?.(question, index, () => setShowMoreMenu(prev => ({ ...prev, [id]: false })))}
                                  </div>
                                }
                              >
                                <button className="action-btn more-btn" onClick={(e) => e.stopPropagation()}>⋮</button>
                              </BubblePopup>
                              {renderActionsAppend?.(question)}
                            </>
                          )}
                        </div>
                      </div>
                      {/* 题目正文：Markdown 解析 + 公式渲染 */}
                      <div className="question-content-area">
                        <div
                          ref={(el) => handleContentRef(el, id)}
                          className="markdown-content question-content"
                          dangerouslySetInnerHTML={{ __html: renderMessageContent(question.question || question.title || '暂无内容') }}
                          onPaste={(e) => handlePaste(e, id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 4.3 底部分页器 */}
        {totalPages > 1 && (
          <div className="question-pagination">
            <div className="pagination-controls">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>上一页</button>
              <span>第 {currentPage} / {totalPages} 页</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>下一页</button>
            </div>
            <div className="pagination-info">第 {currentPage} / {totalPages} 页，共 {filteredQuestions.length} 题</div>
          </div>
        )}
      </VirtualScroll>

      {/* 图片全屏预览 */}
      <ImageViewer
        open={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        imageUrl={previewImageUrl}
      />

      {/* 微课视频播放器 */}
      <MiniClass
        open={showMiniClassDialog}
        onClose={() => setShowMiniClassDialog(false)}
        classUrl={miniClassUrl}
        questionTitle={miniClassQuestionTitle}
      />

      {/* 题目删除确认 */}
      <Dialog
        open={showDeleteDialog}
        title="确定要删除这道题目吗？"
        confirmButtonText="删除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
      >
        <div className="delete-options">
          <label>
            <input type="checkbox" checked={deleteWithChat} onChange={e => setDeleteWithChat(e.target.checked)} />
            同时删除该题目的对话记录
          </label>
          <label>
            <input type="checkbox" checked={deleteWithDraft} onChange={e => setDeleteWithDraft(e.target.checked)} />
            同时删除该题目的草稿
          </label>
        </div>
      </Dialog>

      <Modal
        open={showAnswerDialog}
        onClose={() => setShowAnswerDialog(false)}
        title="查看答案"
        width={800}
        height={600}
      >
        <AnswerView />
      </Modal>

      <Modal
        open={showSimilarDialog}
        onClose={() => setShowSimilarDialog(false)}
        title="举一反三"
        width={900}
        height={700}
      >
        <SimilarQuestionList onQuestionAdded={handlePullDownRefresh} />
      </Modal>
    </div>
  )
})

QuestionList.displayName = 'QuestionList'

export default QuestionList
