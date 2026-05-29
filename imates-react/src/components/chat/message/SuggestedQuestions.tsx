import React, { useState, useEffect, useMemo, useRef } from 'react'
import mascotExerciseIcon from '/icons/changwenwenti.svg'
import mascotHomeworkIcon from '/icons/zuoyehaita.png'
import titleExerciseIcon from '/icons/cainixiangwen.svg'
import titleHomeworkIcon from '/icons/zuye_cainixiangwen.svg'
import gridBgIcon from '/icons/zisewangge.svg'
import '@/components/chat/message/SuggestedQuestions.css'

export interface SuggestedQuestionsProps {
  size?: 'large' | 'small'
  type: 'ai-exercise' | 'ai-homework'
  onSelect?: (suggestion: string) => void
}

const DEFAULT_EXERCISE_SUGGESTIONS = [
  '能和我一起分析一下这道题的已知条件和想求的量之间的关系吗？',
  '这道题通常会用到哪些关键概念或公式？我应该先从哪里入手？',
  '有没有一个最关键的突破口？我应该关注哪个量的变化？',
  '能带我对比一下这题和我们最近学的知识点，看是哪里匹配的吗？',
  '点击编辑自定义问题...',
]

const DEFAULT_HOMEWORK_SUGGESTIONS = [
  '能讲讲这道题我的错因在哪吗？',
  '分析一下求解这道题的核心知识点需要掌握哪些？',
  '这道题的关键考点有哪些？',
  '作答此类题目需要掌握哪些技巧？',
  '点击编辑自定义问题...',
]

const SUGGESTIONS_STORAGE_PREFIX = 'suggested_questions_'

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  size = 'large',
  type,
  onSelect,
}) => {
  const mascotIcon = type === 'ai-homework' ? mascotHomeworkIcon : mascotExerciseIcon
  const titleIcon = type === 'ai-homework' ? titleHomeworkIcon : titleExerciseIcon

  const storageKey = `${SUGGESTIONS_STORAGE_PREFIX}${type}`
  const defaultSuggestions = type === 'ai-homework' ? DEFAULT_HOMEWORK_SUGGESTIONS : DEFAULT_EXERCISE_SUGGESTIONS

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(defaultSuggestions)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === defaultSuggestions.length) {
          setSuggestedQuestions(parsed)
        }
      } catch (e) {
        console.error('[SuggestedQuestions] 加载推荐问题失败:', e)
      }
    }
  }, [storageKey, defaultSuggestions.length])

  const saveSuggestions = (newSuggestions: string[]) => {
    setSuggestedQuestions(newSuggestions)
    localStorage.setItem(storageKey, JSON.stringify(newSuggestions))
  }

  const startEdit = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingIndex(index)
    setEditingText(suggestedQuestions[index] === '点击编辑自定义问题...' ? '' : suggestedQuestions[index])
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSaveEdit = (index: number) => {
    if (editingIndex !== index) return
    const trimmed = editingText.trim()
    const newSuggestions = [...suggestedQuestions]
    if (trimmed) {
      newSuggestions[index] = trimmed
      saveSuggestions(newSuggestions)
    } else if (newSuggestions[index] === '') {
      newSuggestions[index] = '点击编辑自定义问题...'
      setSuggestedQuestions(newSuggestions)
    }
    setEditingIndex(null)
    setEditingText('')
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingText('')
  }

  const handleSuggestionClick = (suggestion: string, index: number) => {
    if (editingIndex !== null) return
    if (suggestion === '点击编辑自定义问题...') {
      startEdit(index)
      return
    }
    onSelect?.(suggestion)
  }

  const layoutStyles = useMemo(() => {
    const config = type === 'ai-homework' ? {
      mascotWidth: 67,
      mascotTop: -16,
      mascotLeft: 3,
      cardPaddingLeft: 6,
      headerHeight: 40,
      headerPaddingLeft: 78,
      titleImgHeight: 45,
      listGap: 9,
      itemPadding: 8,
      textFontSize: 14
    } : {
      mascotWidth: 94,
      mascotTop: -16,
      mascotLeft: -24,
      cardPaddingLeft: 6,
      headerHeight: 40,
      headerPaddingLeft: 78,
      titleImgHeight: 45,
      listGap: 9,
      itemPadding: 8,
      textFontSize: 14
    }

    return {
      '--mascot-width': `${config.mascotWidth}px`,
      '--mascot-top': `${config.mascotTop}px`,
      '--mascot-left': `${config.mascotLeft}px`,
      '--card-padding-left': `${config.cardPaddingLeft}px`,
      '--header-height': `${config.headerHeight}px`,
      '--header-padding-left': `${config.headerPaddingLeft}px`,
      '--title-img-height': `${config.titleImgHeight}px`,
      '--list-gap': `${config.listGap}px`,
      '--item-padding': `${config.itemPadding}px`,
      '--text-font-size': `${config.textFontSize}px`,
      '--grid-bg-url': `url(${gridBgIcon})`,
    } as React.CSSProperties
  }, [type])

  return (
    <div
      className={`suggested-questions-wrapper ${size === 'small' ? 'wrapper--small' : 'wrapper--large'}`}
      style={layoutStyles}
    >
      <div style={{ height: '20px' }}></div>
      <div className="suggested-questions-card">
        <div className="suggestion-header">
          <img src={mascotIcon} className="mascot-icon" alt="吉祥物" />
          <img src={titleIcon} className="title-img" alt="猜你想问" />
        </div>

        <div className="suggestion-list">
          {suggestedQuestions.map((suggestion, idx) => (
            <div key={idx} className="suggestion-item">
              {editingIndex === idx ? (
                <input
                  ref={inputRef}
                  className="suggestion-input"
                  value={editingText}
                  placeholder="输入你的常用问题"
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(idx)
                    if (e.key === 'Escape') handleCancelEdit()
                  }}
                  onBlur={() => handleSaveEdit(idx)}
                />
              ) : (
                <>
                  <span className="suggestion-text" onClick={() => handleSuggestionClick(suggestion, idx)}>
                    {suggestion}
                  </span>
                  <div className="suggestion-actions">
                    <button
                      className="suggestion-edit-btn-inline"
                      onClick={(e) => startEdit(idx, e)}
                      title="编辑此问题"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <svg
                      className="suggestion-arrow"
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      onClick={() => handleSuggestionClick(suggestion, idx)}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SuggestedQuestions
