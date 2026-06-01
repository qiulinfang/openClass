import React, { useState, useMemo } from 'react'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion'
import BaseQuestion from '@/components/exercise/BaseQuestion'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import Button from '@/components/base/Button'
import './TestExerciseView.css'

interface SubQuestion {
  id: string
  type: string
  stem?: string
  questionContent?: string
  structuredContent?: any
  options?: any[]
  material?: string
  subQuestions?: SubQuestion[]
  answer?: string
  analysis?: string
}

interface TestQuestion {
  id: string
  title: string
  question: {
    id: string
    type: string
    material?: string
    subQuestions?: SubQuestion[]
    answer?: string
    analysis?: string
    structuredContent?: any
  }
}

const testQuestions: TestQuestion[] = [
  {
    id: 'test_composite_nested',
    title: '嵌套复合材料题 (用户指定用例)',
    question: {
      "id": "q_1001",
      "type": "composite",
      "material": "这是主题干",
      "subQuestions": [
        {
          "id": "cq_1",
          "type": "composite",
          "material": "子题干，这题还带两个子题",
          "subQuestions": [
            {
              "id": "cq_2_1",
              "type": "subjective",
              "stem": "第一小题的第一小小题干",
              "answer": "答案for第一小题的第一小小题干",
              "analysis": "解析for第一小题的第一小小题干"
            },
            {
              "id": "cq_2_2",
              "type": "single_choice",
              "stem": "第一小题的第二小小题干",
              "options": [
                { "id": "A", "content": "a选项内容" },
                { "id": "B", "content": "b选项内容（设置为正确选项）" }
              ],
              "answer": "B"
            }
          ]
        }
      ]
    }
  },
  {
    id: 'test_choice',
    title: '单选题测试',
    question: {
      id: 'q_001',
      type: 'single_choice',
      structuredContent: {
        stem: '1+1 等于几？',
        options: [
          { id: 'A', content: '1' },
          { id: 'B', content: '2' },
          { id: 'C', content: '3' }
        ]
      },
      answer: 'B'
    }
  },
  {
    id: 'test_fill',
    title: '填空题测试',
    question: {
      id: 'q_002',
      type: 'fill_in_blank',
      structuredContent: {
        stem: '床前明月光，[blank_1]，举头望明月，[blank_2]。'
      },
      answer: '疑是地上霜, 低头思故乡'
    }
  }
]

const TestExerciseView: React.FC = () => {
  const { renderMessageContent } = useMessageRenderer()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [subAnswers, setSubAnswers] = useState<Record<string, any>>({})
  const [subSubAnswers, setSubSubAnswers] = useState<Record<string, any>>({})

  const currentQuestion = testQuestions[currentIndex]

  const currentAnswer = useMemo(() => {
    if (currentQuestion.question.type === 'composite') {
      return { subAnswers, subSubAnswers }
    }
    return answers[currentQuestion.id]
  }, [currentQuestion, answers, subAnswers, subSubAnswers])

  const getQuestionComponent = (type: string) => {
    switch (type) {
      case 'single_choice':
      case 'multiple_choice':
        return ChoiceQuestion
      case 'fill_in_blank':
        return FillBlankQuestion
      case 'true_false':
        return JudgmentQuestion
      default:
        return BaseQuestion
    }
  }

  const wrapQuestion = (sub: any) => {
    if (!sub) return sub
    const rawOptions = sub.options || sub.structuredContent?.options || []
    const wrappedOptions = rawOptions.map((opt: any) => ({
      label: opt.id || opt.label,
      text: opt.content || opt.text
    }))
    
    return {
      ...sub,
      questionContent: sub.stem || sub.questionContent || sub.structuredContent?.stem || '',
      structuredContent: {
        stem: sub.stem || sub.questionContent || sub.structuredContent?.stem || '',
        options: wrappedOptions
      }
    }
  }

  const renderQuestion = (q: any, value: any, onChange: (val: any) => void) => {
    const Component = getQuestionComponent(q.type)
    const wrapped = wrapQuestion(q)
    return (
      <Component 
        question={wrapped} 
        value={value} 
        onChange={onChange}
        showTitle={true}
      />
    )
  }

  return (
    <div className="test-exercise-view">
      <h1 className="title-h1">题目组件集成测试页面</h1>

      <div className="test-layout">
        {/* 左侧：测试用例列表 */}
        <div className="test-cases-sidebar">
          <div className="list-container">
            <div className="list-header">测试用例</div>
            {testQuestions.map((item, index) => (
              <div 
                key={item.id}
                className={`list-item ${currentIndex === index ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
              >
                <div>{index + 1}. {item.title}</div>
                <div className="item-caption">
                  类型: {item.question.type}
                </div>
              </div>
            ))}
          </div>

          <div className="real-time-data">
            <div className="data-title">当前实时数据:</div>
            <pre className="data-pre">{JSON.stringify(currentAnswer, null, 2)}</pre>
          </div>
        </div>

        {/* 右侧：预览与渲染 */}
        <div className="preview-main">
          <div className="card">
            <div className="card-toolbar">
              渲染预览: {currentQuestion.title}
            </div>

            <div className="card-content">
              {currentQuestion.question.type === 'composite' ? (
                <div className="composite-container">
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: 'bold' }}>【主题干/材料】</div>
                    <div 
                      className="markdown-content" 
                      dangerouslySetInnerHTML={{ __html: renderMessageContent(currentQuestion.question.material || '') }}
                    ></div>
                  </div>
                  
                  <div className="sub-questions-list">
                    {currentQuestion.question.subQuestions?.map((sub, sIdx) => (
                      <div key={sub.id || sIdx} className="sub-question-item" style={{ marginLeft: '16px' }}>
                         <div className="text-primary" style={{ fontWeight: 'bold' }}>子题 ({sIdx + 1}):</div>
                         
                         {sub.type === 'composite' ? (
                            <div style={{ marginLeft: '16px', marginTop: '8px' }}>
                               <div 
                                 className="markdown-content" 
                                 dangerouslySetInnerHTML={{ __html: renderMessageContent(sub.material || '') }}
                               ></div>
                               {sub.subQuestions?.map((subSub, ssIdx) => (
                                 <div key={subSub.id || ssIdx} style={{ marginLeft: '16px', marginTop: '16px' }}>
                                   <div className="text-secondary" style={{ fontWeight: 'bold' }}>({ssIdx + 1})</div>
                                   {renderQuestion(
                                      subSub, 
                                      subSubAnswers[subSub.id], 
                                      (val) => setSubSubAnswers(prev => ({ ...prev, [subSub.id]: val }))
                                   )}
                                 </div>
                               ))}
                            </div>
                         ) : (
                            renderQuestion(
                              sub, 
                              subAnswers[sub.id], 
                              (val) => setSubAnswers(prev => ({ ...prev, [sub.id]: val }))
                            )
                         )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                renderQuestion(
                  currentQuestion.question, 
                  answers[currentQuestion.id], 
                  (val) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }))
                )
              )}
            </div>

            <div className="card-actions">
              <Button label="查看解析" variant="ghost" onClick={() => setShowAnalysis(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* 解析对话框 */}
      {showAnalysis && (
        <div className="dialog-overlay" onClick={() => setShowAnalysis(false)}>
          <div className="dialog-content" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">题目解析</div>
            <div className="dialog-body">
              <div style={{ fontSize: '0.875rem', color: '#777', marginBottom: '4px' }}>参考答案:</div>
              <div 
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: renderMessageContent(currentQuestion.question.answer || '无') }}
              ></div>
              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #ddd' }} />
              <div style={{ fontSize: '0.875rem', color: '#777', marginBottom: '4px' }}>详细解析:</div>
              <div 
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: renderMessageContent(currentQuestion.question.analysis || '暂无解析') }}
              ></div>
            </div>
            <div className="dialog-footer">
              <Button label="关闭" onClick={() => setShowAnalysis(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestExerciseView
