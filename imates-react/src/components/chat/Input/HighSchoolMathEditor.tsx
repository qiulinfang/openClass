import React, { useState, useRef, useEffect, useCallback } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import DrawingBoardNew from '@/components/drawing/DrawingBoardNew'
import { apiService } from '@/services/http/api-service'
import undoIcon from '/icons/undo.svg'
import redoIcon from '/icons/redo.svg'
import clearIcon from '/icons/delete.svg'
import '@/components/chat/Input/HighSchoolMathEditor.css'

export interface HighSchoolMathEditorProps {
  value?: string
  onConfirm?: (value: string) => void
  onCancel?: () => void
  onChange?: (value: string) => void
}

export const HighSchoolMathEditor: React.FC<HighSchoolMathEditorProps> = ({
  value = '',
  onConfirm,
  onCancel,
  onChange,
}) => {
  const [formula, setFormula] = useState(value)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [hasHandwriting, setHasHandwriting] = useState(false)
  const [canUndoHandwriting, setCanUndoHandwriting] = useState(false)
  const [canRedoHandwriting, setCanRedoHandwriting] = useState(false)
  
  const handwritingRef = useRef<any>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const updateToolbarStatus = useCallback(() => {
    if (handwritingRef.current) {
      setCanUndoHandwriting(handwritingRef.current.canUndo || false)
      setCanRedoHandwriting(handwritingRef.current.canRedo || false)
    }
  }, [])

  useEffect(() => {
    if (formula && previewRef.current) {
      try {
        katex.render(formula, previewRef.current, {
          throwOnError: false,
          displayMode: true,
        })
      } catch (e) {
        if (previewRef.current) previewRef.current.innerText = formula
      }
    }
  }, [formula])

  const handleHandwritingChange = async () => {
    if (!handwritingRef.current) return
    const base64 = await handwritingRef.current.getDataUrl()
    setHasHandwriting(!!base64)
    updateToolbarStatus()
  }

  const handleHandwritingClear = () => {
    setHasHandwriting(false)
    setFormula('')
    setError(null)
    updateToolbarStatus()
  }

  const clearHandwriting = () => {
    handwritingRef.current?.clearAll()
    handleHandwritingClear()
  }

  const undoHandwriting = () => {
    handwritingRef.current?.undo()
    updateToolbarStatus()
  }

  const redoHandwriting = () => {
    handwritingRef.current?.redo()
    updateToolbarStatus()
  }

  const recognizeFormula = async (base64: string) => {
    setIsRecognizing(true)
    setError(null)
    try {
      const result: any = await apiService.recognizeHandwrittenFormula(base64)
      const latex = result?.latex
      if (latex && latex.trim()) {
        setFormula(latex)
        onChange?.(latex)
      } else {
        setFormula('')
        setError('识别内容为空，请重新书写')
      }
    } catch (e) {
      console.error('[HighSchoolMathEditor] 识别公式失败:', e)
      setError('识别失败，请重试')
      setFormula('')
    } finally {
      setIsRecognizing(false)
    }
  }

  const handleManualRecognize = async () => {
    if (!handwritingRef.current || !hasHandwriting) return
    const base64 = await handwritingRef.current.getDataUrl()
    if (base64) {
      recognizeFormula(base64)
    }
  }

  const handleConfirm = () => {
    if (formula) {
      onConfirm?.(formula)
    }
  }

  return (
    <div className="hsm-container">
      <div className="hsm-body">
        <div className="hsm-col hsm-col--handwriting">
          <div className="hsm-canvas-container">
            <DrawingBoardNew
              ref={handwritingRef}
              showGrid={true}
              showToolbar={false}
              initialZoom={1}
              showZoomControls={false}
              onSave={handleHandwritingChange}
              onClear={handleHandwritingClear}
            />
            <div className="hsm-handwriting-toolbar">
              <button onClick={undoHandwriting} disabled={!canUndoHandwriting} className="toolbar-btn" title="撤销">
                <img src={undoIcon} alt="撤销" />
              </button>
              <button onClick={redoHandwriting} disabled={!canRedoHandwriting} className="toolbar-btn" title="重做">
                <img src={redoIcon} alt="重做" />
              </button>
              <button onClick={clearHandwriting} className="toolbar-btn toolbar-btn--danger" title="清空">
                <img src={clearIcon} alt="清空" />
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
