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
  searchQuery?: string
  selectedSubjectFilter?: string | null
  externalQuestions?: ExerciseItem[]
  showPhotoSearch?: boolean
  showSendToAi?: boolean
  showQuestionActions?: boolean
  showMistakeBadge?: boolean
  type?: QuestionListType
  onStartAiGuidance?: (question: ExerciseItem) => void
  onQuestionSelected?: (question: ExerciseItem, index: number) => void
  onOpenMiniClass?: (question: ExerciseItem) => void
  onViewAnswer?: () => void
  onViewSimilar?: () => void
  'update:searchQuery'?: (value: string) => void
  onQuestionDeleted?: (payload: { questionId: string; withDraft: boolean }) => void
  onPasteToDraft?: (payload: { dataUrl: string; questionId: string }) => void
  onRefresh?: () => void
}

export const QuestionList = forwardRef<any, QuestionListProps>((props, ref) => {
  const {
    searchQuery: propsSearchQuery,
    selectedSubjectFilter: propsSelectedSubjectFilter,
    externalQuestions,
    showPhotoSearch = true,
    showSendToAi = true,
    showQuestionActions = true,
    showMistakeBadge = true,
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
  } = props

  const navigate = useNavigate()
  const PAGE_SIZE = 50
  
  // 响应式数据
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [renderingQuestions, setRenderingQuestions] = useState(false)
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

  const questions = strategy.getQuestions()
  const currentQuestion = strategy.getCurrentQuestion()

  const getQuestionUniqueId = (question: ExerciseItem | null | undefined): string => {
    if (!question) return ''
    return (question.bmNo || question.id || (question as any).questionId || question.title || '').toString()
  }

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

  const initFavoriteStatus = () => {
    const favorites = getFavoriteExercises()
    const statusMap = new Map<string, boolean>()
    favorites.forEach(f => statusMap.set(f.item.bmNo, true))
    setFavoriteStatus(statusMap)
  }

  useEffect(() => {
    initFavoriteStatus()
  }, [])

  const handleLinkClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null
    const linkElement = target?.closest?.('a[href]') as HTMLAnchorElement | null
    if (linkElement) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleSearchInput = (value: string) => {
    if (onUpdateSearchQuery) {
      onUpdateSearchQuery(value)
    } else {
      setInternalSearchQuery(value)
    }
    setCurrentPage(1)
  }

  const handlePhotoSearch = () => {
    const subject = currentQuestion?.subject ? normalizeSubject(currentQuestion.subject) : (selectedSubjectFilter ? normalizeSubject(selectedSubjectFilter) : 'math')
    navigate(`/photo-search?subject=${subject}`)
  }

  const selectQuestion = async (question: ExerciseItem, index: number) => {
    const realIndex = questionIndexMap.get(getQuestionUniqueId(question)) ?? index
    await strategy.selectQuestion(realIndex)
    onQuestionSelected?.(question, realIndex)
  }

  const sendToAi = useCallback(throttle(async (question: ExerciseItem) => {
    onStartAiGuidance?.(question)
  }, 3000), [onStartAiGuidance])

  const openMiniClass = (question: ExerciseItem) => {
    onOpenMiniClass?.(question)
  }

  const handleViewAnswer = () => {
    setShowAnswerDialog(true)
    onViewAnswer?.()
  }

  const handleViewSimilar = () => {
    setShowSimilarDialog(true)
    onViewSimilar?.()
  }

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
          (strategy as any).moveQuestionToTopById?.(id)
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

  const handleDeleteConfirm = async () => {
    if (!deleteTargetQuestion) return
    const id = getQuestionUniqueId(deleteTargetQuestion)
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      const index = questionIndexMap.get(id)
      if (index !== undefined) {
        await strategy.deleteQuestion(index, { subject: deleteTargetQuestion.subject, deleteChat: deleteWithChat })
        onQuestionDeleted?.({ questionId: id, withDraft: deleteWithDraft })
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

  const handlePullDownRefresh = async () => {
    setLoading(true)
    try {
      if (selectedSubjectFilter === null) {
        await strategy.fetchAllSubjectsQuestions(false)
      } else {
        await strategy.fetchQuestions({ subject: selectedSubjectFilter, useLocalFirst: false })
      }
      onRefresh?.()
    } finally {
      setLoading(false)
      scrollContainer.current?.finishRefresh()
    }
  }

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
      img.style.cursor = 'pointer'
      img.onclick = (e) => {
        e.stopPropagation()
        setPreviewImageUrl(img.src)
        setShowImagePreview(true)
      }
    })
  }

  const handleContentRef = (el: HTMLElement | null, id: string) => {
    if (el) {
      contentRefs.current.set(id, el)
      MathJaxUtils.renderMath(el, false)
      attachImageClickListeners(el)
    }
  }

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
  }))

  useEffect(() => {
    setCurrentPage(1)
  }, [externalQuestions])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (selectedSubjectFilter === null) {
          await strategy.fetchAllSubjectsQuestions(true)
        } else {
          await strategy.fetchQuestions({ subject: selectedSubjectFilter || 'math', useLocalFirst: true })
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedSubjectFilter, strategy])

  return (
    <div className="question-list" onClickCapture={handleLinkClick}>
      {(loading || renderingQuestions) && (
        <div className="question-list-loading-overlay">
          <div className="question-list-loading-spinner"></div>
          <div className="question-list-loading-text">题目加载中...</div>
        </div>
      )}

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

      <VirtualScroll
        ref={scrollContainer}
        className="question-cards-container"
        enableRefresh
        onRefresh={handlePullDownRefresh}
        loading={renderingQuestions}
      >
        {displayedQuestions.length === 0 && !loading ? (
          <div className="native-empty-state">
            <div className="empty-icon">❓</div>
            <div className="empty-text">
              {searchQuery || selectedSubjectFilter ? strategy.getNoResultText() : strategy.getEmptyText()}
            </div>
            {!searchQuery && (
              <button className="reload-btn" onClick={handlePullDownRefresh}>重新加载</button>
            )}
          </div>
        ) : (
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
                      <div className="question-header">
                        <div className="question-title-row">
                          <div className="question-number">题目{getQuestionDisplayIndex(id)}</div>
                          {showMistakeBadge && mistakeStatus.get(id) && (
                            <div className="mistake-badge">
                              <span className="badge-icon">⌛</span>
                              <span>往日错题</span>
                            </div>
                          )}
                        </div>
                        <div className="question-actions">
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
                                onClick={(e) => { e.stopPropagation(); handleViewAnswer(); }}
                              >
                                <img src={daanIcon} alt="答案" className="action-icon" />
                              </button>
                              <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleViewSimilar(); }}>
                                <img src={juyifansanIcon} alt="相似" className="action-icon" />
                              </button>
                              <BubblePopup
                                visible={showMoreMenu[id]}
                                onVisibleChange={(visible) => setShowMoreMenu(prev => ({ ...prev, [id]: visible }))}
                                content={<ActionList items={buildMoreActions(question, index)} />}
                              >
                                <button className="action-btn more-btn" onClick={(e) => e.stopPropagation()}>⋮</button>
                              </BubblePopup>
                            </>
                          )}
                        </div>
                      </div>
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

      <ImageViewer
        open={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        imageUrl={previewImageUrl}
      />

      <MiniClass
        open={showMiniClassDialog}
        onClose={() => setShowMiniClassDialog(false)}
        classUrl={miniClassUrl}
        questionTitle={miniClassQuestionTitle}
      />

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
            同时删除对话记录
          </label>
          <label>
            <input type="checkbox" checked={deleteWithDraft} onChange={e => setDeleteWithDraft(e.target.checked)} />
            同时删除草稿
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
