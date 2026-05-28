import React, { useState, useRef, useEffect } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './HighSchoolMathEditor.css'

export interface HighSchoolMathEditorProps {
  value?: string
  onConfirm?: (value: string) => void
  onCancel?: () => void
}

export const HighSchoolMathEditor: React.FC<HighSchoolMathEditorProps> = ({
  value = '',
  onConfirm,
  onCancel,
}) => {
  const [formula, setFormula] = useState(value)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [hasHandwriting, setHasHandwriting] = useState(false)
  const [canUndoHandwriting, setCanUndoHandwriting] = useState(false)
  const [canRedoHandwriting, setCanRedoHandwriting] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formula && previewRef.current) {
      try {
        katex.render(formula, previewRef.current, {
          throwOnError: false,
          displayMode: true,
        })
      } catch (e) {
        setError('公式渲染失败')
      }
    }
  }, [formula])

  const handleConfirm = () => {
    if (formula) {
      onConfirm?.(formula)
    }
  }

  const handleManualRecognize = async () => {
    setIsRecognizing(true)
    setError(null)
    // TODO: 调用手写识别 API
    setTimeout(() => {
      setIsRecognizing(false)
      setFormula('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')
    }, 1500)
  }

  const undoHandwriting = () => {
    console.log('[HighSchoolMathEditor] 撤销')
  }

  const redoHandwriting = () => {
    console.log('[HighSchoolMathEditor] 重做')
  }

  const clearHandwriting = () => {
    console.log('[HighSchoolMathEditor] 清空')
    setHasHandwriting(false)
  }

  return (
    <div className="hsm-container">
      <div className="hsm-body">
        <div className="hsm-col hsm-col--handwriting">
          <div className="hsm-canvas-container">
            <div className="drawing-board-placeholder">
              手写区域（待集成 DrawingBoard）
            </div>
            <div className="hsm-handwriting-toolbar">
              <button onClick={undoHandwriting} disabled={!canUndoHandwriting} className="toolbar-btn" title="撤销">
                <img src="/icons/undo.svg" alt="撤销" />
              </button>
              <button onClick={redoHandwriting} disabled={!canRedoHandwriting} className="toolbar-btn" title="重做">
                <img src="/icons/redo.svg" alt="重做" />
              </button>
              <button onClick={clearHandwriting} className="toolbar-btn toolbar-btn--danger" title="清空">
                <img src="/icons/delete.svg" alt="清空" />
              </button>
              <button 
                onClick={handleManualRecognize} 
                disabled={!hasHandwriting || isRecognizing} 
                className="recognize-btn"
              >
                {isRecognizing ? '识别中...' : '识别公式'}
              </button>
            </div>
          </div>
        </div>

        <div className="hsm-col hsm-col--recognition">
          <div className="hsm-recognition-container">
            {!formula && !isRecognizing && (
              <div className="hsm-placeholder">
                点击你想要的公式就可以啦
              </div>
            )}
            {isRecognizing && (
              <div className="hsm-loading-state">
                <div className="spinner"></div>
                <span>正在识别中...</span>
              </div>
            )}
            {formula && !isRecognizing && (
              <div className="hsm-recognition-content" onClick={handleConfirm}>
                <div ref={previewRef} className="formula-preview"></div>
              </div>
            )}
            {error && <div className="hsm-error-msg">{error}</div>}
          </div>
        </div>
      </div>

      {toast && <div className="hsm-toast">{toast}</div>}
    </div>
  )
}

export default HighSchoolMathEditor
