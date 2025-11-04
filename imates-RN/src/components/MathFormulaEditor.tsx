/**
 * MathFormulaEditor - 数学公式编辑器（React Native 版本）
 * 提供数学公式编辑功能，支持文本和数学公式混合输入
 * 
 * 注意：这是简化版本，完整实现可能需要使用 WebView 集成 MathLive
 */

import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { WebView } from 'react-native-webview'

export interface MathFormulaEditorProps {
  value?: string // 编辑器内容（Markdown 格式）
  placeholder?: string // 占位符文本
  disabled?: boolean // 是否禁用
  maxHeight?: string // 最大高度
  onChange?: (value: string) => void // 内容变化回调
  onFocus?: () => void // 获得焦点回调
  onBlur?: () => void // 失去焦点回调
  onKeyDown?: (event: any) => void // 键盘事件回调
}

export interface MathFormulaEditorHandle {
  getMarkdownContent: () => string
  clearContent: () => void
  insertMathFormula: () => void
  focus: () => void
}

// MathLive HTML 模板
const mathLiveHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/mathlive/dist/mathlive.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 8px;
      font-family: system-ui;
    }
    math-field {
      width: 100%;
      font-size: 16px;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      min-height: 40px;
    }
    #submit-btn {
      margin-top: 8px;
      padding: 8px 16px;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <math-field id="math-field"></math-field>
  <button id="submit-btn">完成</button>
  <script>
    const mathField = document.getElementById('math-field');
    const submitBtn = document.getElementById('submit-btn');
    
    mathField.setOptions({
      virtualKeyboardMode: 'onfocus',
      virtualKeyboards: 'roman numeric functions symbols greek',
      smartMode: true,
      smartFence: true,
      smartSuperscript: true,
    });
    
    // 监听值变化
    mathField.addEventListener('input', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'value-change',
        value: mathField.value
      }));
    });
    
    // 完成按钮
    submitBtn.addEventListener('click', () => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'submit',
        value: mathField.value
      }));
    });
    
    // 接收初始值
    window.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'set-value') {
        mathField.value = data.value || '';
      }
    });
  </script>
</body>
</html>
`

const MathFormulaEditor = forwardRef<MathFormulaEditorHandle, MathFormulaEditorProps>(
  (props, ref) => {
    const {
      value = '',
      placeholder = '可以先聊聊，或选择题目后开始讨论',
      disabled = false,
      maxHeight = '200px',
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
    } = props

    const textInputRef = useRef<TextInput>(null)
    const webViewRef = useRef<WebView>(null)
    const [textContent, setTextContent] = useState('')
    const [formulas, setFormulas] = useState<Array<{ id: string; latex: string }>>([])
    const [showMathModal, setShowMathModal] = useState(false)
    const [currentFormulaId, setCurrentFormulaId] = useState<string | null>(null)
    const [currentFormulaValue, setCurrentFormulaValue] = useState('')

    // 初始化：解析 value 中的文本和公式
    useEffect(() => {
      if (value) {
        parseMarkdownContent(value)
      }
    }, [])

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      getMarkdownContent: () => {
        return buildMarkdownContent()
      },
      clearContent: () => {
        setTextContent('')
        setFormulas([])
        onChange?.('')
      },
      insertMathFormula: () => {
        handleInsertMathFormula()
      },
      focus: () => {
        textInputRef.current?.focus()
      },
    }))

    // 解析 Markdown 内容
    const parseMarkdownContent = (content: string) => {
      // 简单解析：提取 $...$ 格式的公式
      const parts: Array<{ type: 'text' | 'formula'; content: string }> = []
      const regex = /\$([^$]+)\$/g
      let lastIndex = 0
      let match

      while ((match = regex.exec(content)) !== null) {
        // 添加公式前的文本
        if (match.index > lastIndex) {
          const text = content.substring(lastIndex, match.index)
          if (text) {
            parts.push({ type: 'text', content: text })
          }
        }

        // 添加公式
        parts.push({ type: 'formula', content: match[1] })
        lastIndex = match.index + match[0].length
      }

      // 添加剩余的文本
      if (lastIndex < content.length) {
        const text = content.substring(lastIndex)
        if (text) {
          parts.push({ type: 'text', content: text })
        }
      }

      // 分离文本和公式
      const texts: string[] = []
      const newFormulas: Array<{ id: string; latex: string }> = []

      parts.forEach((part) => {
        if (part.type === 'text') {
          texts.push(part.content)
        } else {
          const id = `formula-${Date.now()}-${Math.random()}`
          newFormulas.push({ id, latex: part.content })
        }
      })

      setTextContent(texts.join(''))
      setFormulas(newFormulas)
    }

    // 构建 Markdown 内容
    const buildMarkdownContent = (): string => {
      let markdown = textContent

      formulas.forEach((formula) => {
        markdown += `$${formula.latex}$`
      })

      return markdown
    }

    // 文本变化处理
    const handleTextChange = (text: string) => {
      setTextContent(text)
      const markdown = buildMarkdownContent()
      onChange?.(markdown)
    }

    // 插入数学公式
    const handleInsertMathFormula = () => {
      const id = `formula-${Date.now()}-${Math.random()}`
      setCurrentFormulaId(id)
      setCurrentFormulaValue('')
      setShowMathModal(true)
    }

    // 编辑公式
    const handleEditFormula = (formula: { id: string; latex: string }) => {
      setCurrentFormulaId(formula.id)
      setCurrentFormulaValue(formula.latex)
      setShowMathModal(true)
    }

    // 完成公式编辑
    const handleFormulaSubmit = (latex: string) => {
      if (!currentFormulaId) return

      if (currentFormulaId.startsWith('formula-')) {
        // 新增公式
        setFormulas((prev) => [...prev, { id: currentFormulaId, latex }])
      } else {
        // 更新现有公式
        setFormulas((prev) =>
          prev.map((f) => (f.id === currentFormulaId ? { ...f, latex } : f))
        )
      }

      setShowMathModal(false)
      setCurrentFormulaId(null)
      setCurrentFormulaValue('')

      const markdown = buildMarkdownContent()
      onChange?.(markdown)
    }

    // WebView 消息处理
    const handleWebViewMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data)

        if (data.type === 'submit') {
          handleFormulaSubmit(data.value || '')
        } else if (data.type === 'value-change') {
          setCurrentFormulaValue(data.value || '')
        }
      } catch (error) {
        console.error('[MathFormulaEditor] WebView 消息解析错误:', error)
      }
    }

    // 设置 WebView 中的值
    useEffect(() => {
      if (showMathModal && webViewRef.current) {
        setTimeout(() => {
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: 'set-value',
              value: currentFormulaValue,
            })
          )
        }, 100)
      }
    }, [showMathModal, currentFormulaValue])

    return (
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editorContainer}
        >
          {/* 文本输入区域 */}
          <TextInput
            ref={textInputRef}
            value={textContent}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            multiline
            editable={!disabled}
            style={[
              styles.textInput,
              {
                maxHeight: typeof maxHeight === 'string' ? parseInt(maxHeight) : maxHeight,
              },
            ]}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                onKeyDown?.(e)
              }
            }}
          />

          {/* 公式显示区域 */}
          {formulas.length > 0 && (
            <View style={styles.formulasContainer}>
              {formulas.map((formula) => (
                <TouchableOpacity
                  key={formula.id}
                  style={styles.formulaItem}
                  onPress={() => handleEditFormula(formula)}
                >
                  <Text style={styles.formulaText}>公式: {formula.latex.substring(0, 20)}...</Text>
                  <Text style={styles.editHint}>点击编辑</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 插入公式按钮 */}
          <TouchableOpacity
            style={styles.insertFormulaButton}
            onPress={handleInsertMathFormula}
            disabled={disabled}
          >
            <Text style={styles.insertFormulaButtonText}>+ 公式</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>

        {/* 数学公式编辑模态框 */}
        <Modal
          visible={showMathModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMathModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>编辑数学公式</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowMathModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <WebView
                ref={webViewRef}
                source={{ html: mathLiveHTML }}
                style={styles.webView}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            </View>
          </View>
        </Modal>
      </View>
    )
  }
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
  },
  textInput: {
    fontSize: 14,
    lineHeight: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    minHeight: 40,
  },
  formulasContainer: {
    marginTop: 8,
    gap: 8,
  },
  formulaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  formulaText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  editHint: {
    fontSize: 10,
    color: '#1976d2',
  },
  insertFormulaButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#1976d2',
    borderRadius: 4,
    alignItems: 'center',
  },
  insertFormulaButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 20,
    color: '#666',
  },
  webView: {
    flex: 1,
  },
})

export default MathFormulaEditor
