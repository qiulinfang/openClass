import React, { useEffect, useRef, useMemo } from 'react'
import { useQuestionStore } from '@/stores/questionStore'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import VirtualScroll from '@/components/base/VirtualScroll'
import '@/components/exercise/AnswerView.css'

export const AnswerView: React.FC = () => {
  const currentQuestion = useQuestionStore(state => state.getCurrentQuestion())
  const { renderMessageContent } = useMessageRenderer()

  const answer = currentQuestion?.answer || ''
  const explanation = currentQuestion?.explanation || ''

  const formattedAnswer = useMemo(() => {
    if (!answer) return ''
    return renderMessageContent(answer)
  }, [answer, renderMessageContent])

  const formattedExplanation = useMemo(() => {
    if (!explanation) return ''
    return renderMessageContent(explanation)
  }, [explanation, renderMessageContent])

  const answerRef = useRef<HTMLDivElement>(null)
  const explanationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (answerRef.current && formattedAnswer) {
      MathJaxUtils.renderMath(answerRef.current, true).catch(err => {
        console.warn('[AnswerView] MathJax 渲染失败:', err)
      })
    }
  }, [formattedAnswer])

  useEffect(() => {
    if (explanationRef.current && formattedExplanation) {
      MathJaxUtils.renderMath(explanationRef.current, true).catch(err => {
        console.warn('[AnswerView] MathJax 渲染失败:', err)
      })
    }
  }, [formattedExplanation])

  if (!answer && !explanation) {
    return (
      <div className="answer-view empty">
        <div className="native-empty-state">
          <div className="empty-icon">?</div>
          <div className="empty-text">暂无答案内容</div>
          <div className="empty-subtext">请先选择一道题目</div>
        </div>
      </div>
    )
  }

  return (
    <div className="base-question">
      <VirtualScroll>
        <div className="question-footer" style={{ borderTop: 'none', marginTop: 0 }}>
          {answer && (
            <div className="analysis-section">
              <div className="section-title">参考答案</div>
              <div
                ref={answerRef}
                className="section-content answer"
                dangerouslySetInnerHTML={{ __html: formattedAnswer }}
              />
            </div>
          )}

          {explanation && (
            <div className="analysis-section">
              <div className="section-title">题目解析</div>
              <div
                ref={explanationRef}
                className="section-content"
                dangerouslySetInnerHTML={{ __html: formattedExplanation }}
              />
            </div>
          )}
        </div>
      </VirtualScroll>
    </div>
  )
}

export default AnswerView
