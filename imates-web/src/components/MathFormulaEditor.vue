<template>
  <div class="math-formula-editor">
    <!-- 完整模式 -->
    <div class="container">
      <div class="main-content">
        <!-- 编辑器区域 -->
        <div class="editor-section">
          <!-- Quill编辑器 -->
          <div ref="editorRef" :id="editorId"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import Quill from 'quill'

// Props 定义
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '可以先聊聊，或选择题目后开始讨论'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  maxHeight: {
    type: String,
    default: '200px'
  }
})

// Emits 定义
const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'keydown'])

// 响应式数据
const editorRef = ref(null)

// 生成唯一的编辑器ID
const editorId = computed(() => `math-editor-${Math.random().toString(36).substr(2, 9)}`)

// 全局变量
let quill: Quill | null = null

// 自定义MathLive Blot for Quill
const Embed = Quill.import("blots/embed") as any

class MathBlot extends Embed {
  static create(value: any) {
    const node = super.create()
    node.setAttribute("contenteditable", true)
    node.setAttribute("tabindex", "-1")
    node.classList.add("ql-math-embed", "ql-math-readonly")
    node.style.display = "inline-block"
    node.style.verticalAlign = "baseline"

    // 创建MathLive元素
    const mathField = document.createElement("math-field") as any
    mathField.value = value || ""

    // 配置MathLive选项
    try {
      mathField.setOptions({
        virtualKeyboardMode: "onfocus",
        virtualKeyboards: "roman numeric functions symbols greek",
        smartMode: true,
        smartFence: true,
        smartSuperscript: true,
        removeExtraneousParentheses: true,
        mathModeSpace: "\\:",
        plonkSound: null,
        keypressSound: null,
      })
    } catch (e) {
      console.warn("MathLive options setting failed:", e)
    }

    // 监听输入事件
    mathField.addEventListener("input", () => {
      const currentValue = mathField.value
      node.setAttribute("data-value", currentValue)
      mathField.setAttribute("data-value", currentValue)
    })

    // 监听焦点事件
    mathField.addEventListener("focus", () => {
      // 焦点获得时不需要提示
      // 触发虚拟键盘事件，确保滚动到底部
      if (typeof window !== 'undefined') {
        const customEvent = new CustomEvent('formula-keyboard-toggle', {
          detail: { visible: true }
        })
        window.dispatchEvent(customEvent)
      }
    })

    mathField.addEventListener("blur", () => {
      const currentValue = mathField.value
      node.setAttribute("data-value", currentValue)
      mathField.setAttribute("data-value", currentValue)
      
      // 失焦时清理HTML结构，确保没有多余的br和p标签
      if (quill) {
        setTimeout(() => {
          cleanInitialHTMLStructure()
        }, 10)
      }
      
      // 修复：失焦时同步更新全局公式键盘状态
      if (typeof window !== 'undefined') {
        const customEvent = new CustomEvent('formula-keyboard-toggle', {
          detail: { visible: false }
        })
        window.dispatchEvent(customEvent)
      }
    })

    // 监听虚拟键盘事件
    mathField.addEventListener("virtual-keyboard-toggle", (event: any) => {
      const { visible } = event.detail || {}
      
      // 触发全局公式键盘事件，让 ChatView 处理滚动
      if (typeof window !== 'undefined') {
        const customEvent = new CustomEvent('formula-keyboard-toggle', {
          detail: { visible }
        })
        window.dispatchEvent(customEvent)
      }
    })

    // 点击编辑
    mathField.addEventListener("dblclick", () => {
      mathField.focus()
    })

    node.appendChild(mathField)
    node.setAttribute("data-value", value || "")

    if (value) {
      mathField.value = value
      mathField.setAttribute("data-value", value)
    }

    return node
  }

  static value(node: any) {
    const mathField = node.querySelector("math-field")
    if (mathField) {
      const value = mathField.value ||
        mathField.getAttribute("value") ||
        mathField.getAttribute("data-value") ||
        node.getAttribute("data-value") ||
        ""
      // 关键修复：返回对象格式而不是字符串
      return { math: value }  
    }
    const dataValue = node.getAttribute("data-value") || ""
    return { math: dataValue }
  }

  static formats(node: any) {
    return this.value(node)
  }

  value() {
    const mathField = (this as any).domNode.querySelector("math-field")
    if (mathField) {
      const value = mathField.value ||
        mathField.getAttribute("value") ||
        mathField.getAttribute("data-value") ||
        (this as any).domNode.getAttribute("data-value") ||
        ""
      // 关键修复：返回对象格式而不是字符串
      return { math: value }
    }
    const dataValue = (this as any).domNode.getAttribute("data-value") || ""
    return { math: dataValue }
  }
}

MathBlot.blotName = "math"
MathBlot.tagName = "span"
MathBlot.className = "ql-math-embed"

// 注册自定义Blot
Quill.register(MathBlot)

// 初始化编辑器
const initializeEditor = async () => {
  try {
    // 动态导入MathLive
    await import("mathlive")
    
    // 配置Quill编辑器
    const editorConfig = {
      theme: "snow",
      modules: {
        toolbar: false,
      },
      placeholder: props.placeholder,
    }
    
    quill = new Quill(`#${editorId.value}`, editorConfig)

    // 立即设置初始内容为空，避免自动插入 br
    quill.setContents([])
    
    // 立即清理初始HTML结构，移除不必要的br和p标签
    cleanInitialHTMLStructure()
    
    // 再次确保清理，防止异步问题
    setTimeout(() => {
      cleanInitialHTMLStructure()
    }, 50)

    // 监听内容变化
    quill?.on("text-change", (delta: any, oldDelta: any, source: any) => {
      // 只在用户操作时清理HTML结构，避免API操作时的过度清理
      if (source === 'user') {
        cleanInitialHTMLStructure()
      }
      
      const content = getMarkdownContent()
      emit('update:modelValue', content)
    })

    // 监听焦点事件
    quill?.on("selection-change", (range: any) => {
      if (range) {
        emit('focus')
      } else {
        emit('blur')
      }
    })

    // 监听键盘事件
    const editorContainer = document.getElementById(editorId.value)
    if (editorContainer) {
      editorContainer.addEventListener("keydown", (e) => {
        emit('keydown', e)
      })
      
      // 兼容Android WebView虚拟键盘Backspace删除公式块
      editorContainer.addEventListener("beforeinput", function (e: any) {
        if (e.inputType === "deleteContentBackward") {
          const selection = quill?.getSelection()
          if (selection && selection.length === 0 && selection.index > 0) {
            const [prevBlot] = quill?.getLeaf(selection.index - 1) || []
            if (prevBlot && prevBlot.statics && prevBlot.statics.blotName === "math") {
              quill?.deleteText(selection.index - 1, 1, 'user')
              e.preventDefault()
            }
          }
        }
      })
      
      editorContainer.addEventListener("input", function (e: any) {
        if (e.inputType === "deleteContentBackward") {
          const selection = quill?.getSelection()
          if (selection && selection.length === 0 && selection.index > 0) {
            const [prevBlot] = quill?.getLeaf(selection.index - 1) || []
            if (prevBlot && prevBlot.statics && prevBlot.statics.blotName === "math") {
              setTimeout(() => {
                quill?.deleteText(selection.index - 1, 1, 'user')
              }, 0)
            }
          }
        }
      })
    }

    // 设置初始内容
    if (props.modelValue) {
      setContent(props.modelValue)
    }

    // 编辑器初始化完成
    
  } catch (error) {
    console.error("Failed to initialize editor:", error)
  }
}

// 插入数学公式字段
const insertMathField = (latex = "") => {
  if (!quill) {
    return
  }

  // 获取当前内容
  const currentContent = quill.getContents()
  const hasContent = currentContent.ops && currentContent.ops.some((op: any) => {
    if (typeof op.insert === 'string') {
      return op.insert.trim() !== ''
    }
    return op.insert && op.insert.math
  })

  // 如果没有实际内容，确保编辑器完全清空
  if (!hasContent) {
    quill.setContents([])
  }

  // 获取当前光标位置，如果没有选择则插入到末尾
  const range = quill.getSelection() || { index: quill.getLength() }
  
  // 确保光标位置有效
  const editorLength = quill.getLength()
  if (range.index > editorLength) {
    range.index = editorLength
  }
  
  // 直接插入数学公式，Quill会自动处理位置
  quill.insertEmbed(range.index, "math", { math: latex })
  
  // 插入后延迟清理HTML结构，确保数学公式已经正确插入
  setTimeout(() => {
    // 只清理多余的br和p标签，保留数学公式
    const editorElement = document.getElementById(editorId.value)
    if (editorElement) {
      const quillEditor = editorElement.querySelector('.ql-editor')
      if (quillEditor) {
        // 移除空的p标签和只包含br的p标签
        const emptyParagraphs = quillEditor.querySelectorAll('p:empty, p:has(br:only-child)')
        emptyParagraphs.forEach(p => p.remove())
        
        // 移除所有br标签
        const brTags = quillEditor.querySelectorAll('br')
        brTags.forEach(br => {
          const parentP = br.parentElement
          if (parentP && parentP.tagName === 'P' && parentP.children.length === 1) {
            parentP.remove()
          } else {
            br.remove()
          }
        })
      }
    }
  }, 50)
  
  // 聚焦到新插入的公式编辑器
  const focusNewMathField = (attempt = 1) => {
    const [blot] = quill?.getLeaf(range.index) || []
    if (blot && (blot as any).domNode && typeof (blot as any).domNode.querySelector === 'function') {
      const mathField = (blot as any).domNode.querySelector("math-field")
      if (mathField) {
        mathField.focus()
        return
      }
    }
    if (attempt < 3) {
      setTimeout(() => focusNewMathField(attempt + 1), 100)
    }
  }
  setTimeout(() => focusNewMathField(), 120)
}

// 获取 Markdown 内容
const getMarkdownContent = () => {
  if (!quill) {
    return ''
  }
  
  // 从Quill的Delta获取完整内容，包括文本和公式
  const delta = quill.getContents()
  // 获取完整的编辑器内容，包括所有历史内容
  const fullContent = quill.getContents()
  let markdown = ''
  
  // 使用完整内容而不是当前delta
  const contentToProcess = fullContent || delta
  
  if (contentToProcess.ops) {
    contentToProcess.ops.forEach((op: any) => {
      if (op.insert) {
        if (typeof op.insert === 'string') {
          // 检查是否有attributes，如果有且看起来像数学公式，则处理为公式
          if (op.attributes && Object.keys(op.attributes).length > 0) {
            // 从attributes中重构完整的数学公式
            const attributes = op.attributes
            const latexParts = []
            
            // 按索引顺序重新组合公式
            for (let i = 0; i < Object.keys(attributes).length; i++) {
              if (attributes[i]) {
                latexParts.push(attributes[i])
              }
            }
            
            const reconstructedLatex = latexParts.join('')
            
            if (reconstructedLatex.trim()) {
              markdown += `$${reconstructedLatex}$`
            }
          } else {
            // 处理普通文本
            markdown += op.insert
          }
        } else if (op.insert.math) {
          // 处理数学公式
          const latex = op.insert.math
          markdown += `$${latex}$`
        }
      }
      
      // 处理其他格式属性（如粗体、斜体等）
      if (op.attributes && !Object.keys(op.attributes).some(key => !isNaN(Number(key)))) {
        if (op.attributes.bold) {
          markdown = markdown.replace(/(.+)/, '**$1**')
        }
        if (op.attributes.italic) {
          markdown = markdown.replace(/(.+)/, '*$1*')
        }
      }
    })
  }
  
  // 如果从Delta没有获取到内容，尝试从DOM获取数学公式
  if (!markdown || markdown.trim() === '') {
    const editorElement = document.getElementById(editorId.value)
    const mathFields = editorElement?.querySelectorAll('math-field') || []
    
    mathFields.forEach((mathField: any) => {
      const latex = mathField.value || ''
      if (latex.trim()) {
        markdown += `$${latex}$`
      }
    })
  }
  
  return markdown.trim()
}

// 设置内容
const setContent = (content: any) => {
  if (!quill) return
  
  // 清空现有内容
  quill.setContents([])
  
  if (!content) return
  
  // 简单的 Markdown 解析
  const lines = content.split('\n')
  const ops: any[] = []
  
  lines.forEach((line: any) => {
    // 处理数学公式
    const mathRegex = /\$([^$]+)\$/g
    let lastIndex = 0
    let match
    
    while ((match = mathRegex.exec(line)) !== null) {
      // 添加公式前的文本
      if (match.index > lastIndex) {
        const text = line.substring(lastIndex, match.index)
        if (text) {
          ops.push({ insert: text })
        }
      }
      
      // 添加数学公式
      ops.push({ insert: { math: match[1] } })
      lastIndex = match.index + match[0].length
    }
    
    // 添加剩余的文本
    if (lastIndex < line.length) {
      const text = line.substring(lastIndex)
      if (text) {
        ops.push({ insert: text })
      }
    }
    
    // 添加换行
    ops.push({ insert: '\n' })
  })
  
  quill.setContents(ops as any)
}

// 清空内容
const clearContent = () => {
  if (quill) {
    quill.setContents([])
  }
}

// 清理初始HTML结构，移除不必要的br和p标签
const cleanInitialHTMLStructure = () => {
  if (!quill) return
  
  const editorElement = document.getElementById(editorId.value)
  if (!editorElement) return
  
  // 获取Quill编辑器的DOM元素
  const quillEditor = editorElement.querySelector('.ql-editor')
  if (!quillEditor) return
  
  // 获取当前内容
  const currentContent = quill.getContents()
  
  // 检查是否有实际内容（非空的数学公式或文本）
  const hasRealContent = currentContent.ops && currentContent.ops.some((op: any) => {
    if (typeof op.insert === 'string') {
      return op.insert.trim() !== '' && op.insert !== '\n'
    }
    return op.insert && op.insert.math
  })
  
  // 检查DOM中是否有数学公式字段
  const hasMathFields = quillEditor.querySelectorAll('math-field').length > 0
  
  // 如果没有实际内容且没有数学公式字段，完全清空
  if (!hasRealContent && !hasMathFields) {
    quillEditor.innerHTML = ''
    quill.setContents([])
    return
  }
  
  // 移除空的p标签和只包含br的p标签
  const emptyParagraphs = quillEditor.querySelectorAll('p:empty, p:has(br:only-child)')
  emptyParagraphs.forEach(p => p.remove())
  
  // 移除所有br标签
  const brTags = quillEditor.querySelectorAll('br')
  brTags.forEach(br => {
    const parentP = br.parentElement
    if (parentP && parentP.tagName === 'P' && parentP.children.length === 1) {
      // 如果p标签只包含br，移除整个p标签
      parentP.remove()
    } else {
      // 否则只移除br标签
      br.remove()
    }
  })
  
  // 移除只包含空格的p标签
  const whitespaceParagraphs = quillEditor.querySelectorAll('p')
  whitespaceParagraphs.forEach(p => {
    if (p.textContent?.trim() === '' && p.children.length === 0) {
      p.remove()
    }
  })
  
  // 最终检查：如果编辑器为空或只包含无意义的HTML，完全清空
  const finalContent = quillEditor.innerHTML.trim()
  if (finalContent === '' || finalContent === '<p></p>' || finalContent === '<p><br></p>') {
    quillEditor.innerHTML = ''
    quill.setContents([])
  }
}

// 清理编辑器内容，移除多余的空段落和文本
const cleanEditorContent = () => {
  if (!quill) return
  
  const currentContent = quill.getContents()
  if (!currentContent.ops || currentContent.ops.length === 0) return
  
  // 过滤掉空段落和只有换行符的内容
  const cleanedOps = currentContent.ops.filter((op: any) => {
    if (typeof op.insert === 'string') {
      // 保留有实际内容的文本
      return op.insert.trim() !== '' && op.insert !== '\n'
    }
    // 保留数学公式
    return op.insert && op.insert.math
  })
  
  // 如果清理后没有内容，清空编辑器
  if (cleanedOps.length === 0) {
    quill.setContents([])
  } else {
    // 更新内容
    quill.setContents(cleanedOps)
  }
}

// 聚焦编辑器
const focus = () => {
  if (quill) {
    quill.focus()
  }
}

// 监听 modelValue 变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== getMarkdownContent()) {
    setContent(newValue)
  }
})

// 生命周期
onMounted(async () => {
  await nextTick()
  await initializeEditor()
})

onUnmounted(() => {
  if (quill) {
    quill = null
  }
})

// 暴露方法给父组件
defineExpose({
  insertMathField,
  getMarkdownContent,
  setContent,
  clearContent,
  focus
})
</script>

<style scoped>
/* 基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.math-formula-editor {
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: transparent;
  min-height: auto;
  padding: 0;
}


.container {
  max-width: 100%;
  margin: 0;
  background: transparent;
  height: auto;
}


.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-section {
  padding: 0;
  flex: 1;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title::before {
  content: "";
  width: 4px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
}


/* Quill编辑器样式 */
.quill-editor {
  min-height: auto;
  max-height: 200px;
  border: none !important;
  border-radius: 0;
  background: transparent;
  margin-bottom: 0;
}

.quill-editor .ql-editor {
  padding: 0px 10px;
  border: none !important;
  outline: none !important;
  font-size: 16px;
  line-height: 1.4;
  color: #3c4043;
  background: transparent;
  min-height: auto;
}

.quill-editor .ql-editor:focus {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

.quill-editor .ql-container {
  border: none !important;
}

.quill-editor .ql-container:focus {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

.quill-editor .ql-container:focus-within {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

.quill-editor:focus {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

.quill-editor .ql-editor.ql-blank::before {
  color: #9aa0a6 !important;
  font-style: normal !important;
  font-size: 16px !important;
  left: 10px !important;
  right: 10px !important;
  opacity: 1 !important;
}


/* 响应式设计 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .math-formula-editor {
    padding: 10px;
  }

  .header {
    padding: 20px;
  }

  .header h3 {
    font-size: 24px;
  }

  .editor-section {
    padding: 20px;
  }

  .quill-editor {
    min-height: 36px;
    max-height: 150px;
  }
}
</style>

<style>
/* 全局样式 - 用于Quill和MathLive */
.ql-toolbar {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.ql-container {
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

/* 去除 Quill 编辑器 focus 状态下的边框 */
.ql-container:focus,
.ql-container:focus-within,
.ql-container.ql-focused {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

.ql-editor {
  padding: 0px 10px;
  min-height: auto;
}

.ql-editor.ql-blank::before {
  color: #9aa0a6 !important;
  font-style: normal !important;
  font-size: 16px !important;
  left: 10px !important;
  right: 10px !important;
  opacity: 1 !important;
}

.ql-editor:focus {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* 确保 Quill 容器本身没有边框 */
.ql-container {
  border: none !important;
}

.ql-container:hover {
  border: none !important;
}

/* MathLive在Quill中的样式 */
.ql-editor math-field {
  display: inline-block;
  margin: 2px 4px;
  padding: 4px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: #f8f9ff;
  min-width: 60px;
  font-size: 16px;
  transition: all 0.3s ease;
  vertical-align: baseline;
}

.ql-editor math-field:focus {
  border-color: #e0e0e0;
  background: #f8f9ff;
  box-shadow: none;
}

.ql-editor math-field:hover {
  border-color: #e0e0e0;
  background: #f8f9ff;
}

/* 确保公式容器也是行内元素 */
.ql-editor .ql-math-embed {
  display: inline;
  vertical-align: baseline;
  margin: 0 2px;
}

/* 确保 span 标签包裹的公式是行内元素 */
.ql-editor span.ql-math-embed {
  display: inline;
  vertical-align: baseline;
}

/* 强制覆盖 Quill 的默认 p 标签行为 */
.ql-editor p {
  display: inline;
  margin: 0;
  padding: 0;
}

/* 确保包含公式的段落也是行内显示 */
.ql-editor p:has(.ql-math-embed) {
  display: inline;
  margin: 0;
  padding: 0;
}

/* 隐藏空的 br 标签和段落 */
.ql-editor br:only-child {
  display: none !important;
}

.ql-editor p:empty {
  display: none !important;
}

.ql-editor p:has(br:only-child) {
  display: none !important;
}

/* 隐藏只包含空格的段落 */
.ql-editor p:has(br) {
  display: none !important;
}

/* 确保空的编辑器不显示任何内容 */
.ql-editor:empty {
  display: none;
}

.ql-editor:has(p:empty) {
  display: none;
}

/* 强制移除不必要的换行和空格 */
.ql-editor br {
  display: none !important;
}

/* 确保段落标签不产生额外的垂直空间 */
.ql-editor p {
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1 !important;
}


/* MathLive 虚拟键盘自定义样式 */
.ML__keyboard {
  border-radius: 12px !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
}

.ML__keyboard .ML__keycap {
  border-radius: 6px !important;
}

.ql-math-readonly {
  user-select: none;
}
</style>
