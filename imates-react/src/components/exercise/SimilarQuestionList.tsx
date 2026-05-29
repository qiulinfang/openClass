import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuestionStore } from '@/stores/questionStore'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { showMessage } from '@/utils'
import VirtualScroll, { VirtualScrollRef } from '@/components/base/VirtualScroll'
import ImageViewer from '@/components/display/ImageViewer'
import Loading from '@/components/base/Loading'
import '@/components/exercise/SimilarQuestionList.css'

interface SimilarQuestionListProps {
  onQuestionAdded?: () => void
}

export const SimilarQuestionList: React.FC<SimilarQuestionListProps> = ({
  onQuestionAdded
}) => {
  const { 
    similarQuestions, 
    questions, 
    findSimilarQuestions, 
    addSimilarQuestionToList,
    getCurrentQuestion
  } = useQuestionStore()
  const currentQuestion = getCurrentQuestion()

  const [loading, setLoading] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const rubberBandRef = useRef<VirtualScrollRef>(null)

  const hasSelectedQuestion = !!currentQuestion

  const handleFindSimilar = useCallback(async () => {
    if (!hasSelectedQuestion) {
      showMessage('请先选择一道题目', 'warning')
      return
    }

    try {
      setLoading(true)
      await findSimilarQuestions(currentQuestion?.id || '')
    } catch (error) {
      console.error(error)
      showMessage('查找相似题目失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [hasSelectedQuestion, currentQuestion?.id, findSimilarQuestions])

  useEffect(() => {
    if (hasSelectedQuestion) {
      handleFindSimilar()
    }
  }, [hasSelectedQuestion, handleFindSimilar])

  const handleRefresh = async () => {
    await handleFindSimilar()
    rubberBandRef.current?.finishRefresh()
  }

  const addToMyList = async (question: any) => {
    if (!question) return
    try {
      const subject = currentQuestion?.subject || ''
      await addSimilarQuestionToList(question, subject)
      onQuestionAdded?.()
      showMessage('添加成功', 'success')
    } catch (error: any) {
      const errorMessage = error?.message?.includes('已存在') 
        ? '该题目已存在于题目列表中，无法重复添加'
        : '添加题目失败，请重试'
      showMessage(errorMessage, 'warning')
    }
  }

  const { renderMessageContent } = useMessageRenderer()

  const handleImagePreview = (url: string) => {
    setPreviewImageUrl(url)
    setShowImagePreview(true)
  }

  const isInUserList = useCallback((bmNo: string) => {
    return questions.some(q => q.bmNo === bmNo)
  }, [questions])

  const getQuestionContent = (question: any) => {
    return question.content || question.question || question.title || ''
  }

  if (!hasSelectedQuestion) {
    return (
      <div className="similar-question-list empty">
        <div className="native-empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">请先选择一道题目</div>
        </div>
      </div>
    )
  }

  return (
    <div className="similar-question-list">
      <VirtualScroll ref={rubberBandRef} enableRefresh onRefresh={handleRefresh}>
        <div className="scroll-content">
          <div className="padding-container">
            {loading ? (
              <div className="loading-container">
                <Loading text="查找相似题目中..." size={48} theme="dark" />
              </div>
            ) : similarQuestions.length === 0 ? (
              <div className="native-empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">未找到相似题目</div>
                <button className="re-find-btn" onClick={handleFindSimilar}>重新查找</button>
              </div>
            ) : (
              <div className="similar-questions-container">
                {similarQuestions.map((question, index) => {
                  const inUserList = isInUserList(question.bmNo)
                  return (
                    <div
                      key={question.bmNo || index}
                      className={`similar-question-item ${inUserList ? 'question-in-user-list' : ''}`}
                    >
                      <div className="question-block">
                        <div className="question-number">{index + 1}</div>
                        <div className="question-content">
                          <div
                            className="markdown-content"
                            dangerouslySetInnerHTML={{ __html: renderMessageContent(getQuestionContent(question)) }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement
                              if (target.tagName === 'IMG') {
                                handleImagePreview((target as HTMLImageElement).src)
                              }
                            }}
                          />
                        </div>
                        <button
                          className="add-btn"
                          disabled={inUserList}
                          onClick={() => !inUserList && addToMyList(question)}
                          title={inUserList ? '已在题库中' : '添加到第一题位置'}
                        >
                          {inUserList ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </VirtualScroll>
      <ImageViewer
        open={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        imageUrl={previewImageUrl}
      />
    </div>
  )
}

export default SimilarQuestionList
