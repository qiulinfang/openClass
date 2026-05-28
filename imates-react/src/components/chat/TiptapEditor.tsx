import React, { useEffect, useRef, useState } from 'react'
import './TiptapEditor.css'

export interface TiptapEditorProps {
  value?: string
  placeholder?: string
  editable?: boolean
  onChange?: (value: string) => void
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value = '',
  placeholder = '请输入内容...',
  editable = true,
  onChange,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<any>(null)
  const [isDev] = useState(import.meta.env.VITE_ENABLE_DEBUG === 'true')
  const [showDebugControls, setShowDebugControls] = useState(false)

  useEffect(() => {
    // Tiptap 在 React 中的使用需要额外配置
    // 这里先创建基础框架，实际集成需要安装 @tiptap/react
    console.log('[TiptapEditor] 初始化')
    
    return () => {
      console.log('[TiptapEditor] 清理')
    }
  }, [])

  const shouldShowPlaceholder = !value && editorRef.current?.innerText === ''

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  const handleEditorClick = () => {
    focusEditor()
  }

  const handleKeydown = (e: React.KeyboardEvent) => {
    console.log('[TiptapEditor] Keydown', e.key)
  }

  const debugShowKeyboard = () => {
    console.log('[TiptapEditor] 显示键盘')
  }

  const debugHideKeyboard = () => {
    console.log('[TiptapEditor] 隐藏键盘')
  }

  const debugCreateFormula = () => {
    console.log('[TiptapEditor] 创建公式')
  }

  const debugClearAll = () => {
    console.log('[TiptapEditor] 清理所有')
  }

  const toggleDebugMode = () => {
    setShowDebugControls(!showDebugControls)
  }

  return (
    <div className="tiptap-editor-container">
      {isDev && showDebugControls && (
        <div className="debug-controls">
          <button onClick={debugShowKeyboard} className="debug-btn">显示键盘</button>
          <button onClick={debugHideKeyboard} className="debug-btn">隐藏键盘</button>
          <button onClick={debugCreateFormula} className="debug-btn">创建公式</button>
          <button onClick={debugClearAll} className="debug-btn">清理所有</button>
          <button onClick={toggleDebugMode} className="debug-btn debug-toggle">关闭调试</button>
        </div>
      )}

      <div className="editor-wrapper">
        <div
          ref={editorRef}
          className="editor-content"
          contentEditable={editable}
          onClick={handleEditorClick}
          onKeyDown={handleKeydown}
          suppressContentEditableWarning
        >
          {value}
        </div>

        {shouldShowPlaceholder && (
          <div className="editor-placeholder" onClick={focusEditor}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}

export default TiptapEditor
