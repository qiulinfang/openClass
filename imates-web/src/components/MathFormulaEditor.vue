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
    
    <!-- 状态指示器 -->
    <div class="status-indicator" :class="{ show: showStatus, error: statusType === 'error' }" ref="statusIndicatorRef">
      {{ statusMessage }}
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
const statusIndicatorRef = ref(null)
const showStatus = ref(false)
const statusMessage = ref('')
const statusType = ref('success')

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
      console.log('🎯 [MATH_FORMULA_EDITOR] 公式内容输入变化:', currentValue)
      node.setAttribute("data-value", currentValue)
      mathField.setAttribute("data-value", currentValue)
    })

    // 监听焦点事件
    mathField.addEventListener("focus", () => {
      console.log('🎯 [MATH_FORMULA_EDITOR] 公式字段获得焦点，开始编辑')
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
      console.log('🎯 [MATH_FORMULA_EDITOR] 公式字段失去焦点，编辑完成，最终内容:', currentValue)
      node.setAttribute("data-value", currentValue)
      mathField.setAttribute("data-value", currentValue)
      
      // 强制触发Quill内容更新，确保Delta结构同步
      if (quill) {
        console.log('🎯 [MATH_FORMULA_EDITOR] 触发Quill内容更新')
        quill.updateContents(quill.getContents())
      }
      
      // 失焦时不需要提示
      
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
      console.log('🎯 [MATH_FORMULA_EDITOR] 虚拟键盘状态变化:', visible)
      
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
      const value = (
        mathField.value ||
        mathField.getAttribute("value") ||
        mathField.getAttribute("data-value") ||
        node.getAttribute("data-value") ||
        ""
      )
      console.log('🎯 [MATH_FORMULA_EDITOR] MathBlot获取公式值:', value)
      return value
    }
    const fallbackValue = node.getAttribute("data-value") || ""
    console.log('🎯 [MATH_FORMULA_EDITOR] MathBlot获取公式值(备用):', fallbackValue)
    return fallbackValue
  }

  static formats(node: any) {
    return this.value(node)
  }

  value() {
    const mathField = (this as any).domNode.querySelector("math-field")
    if (mathField) {
      return (
        mathField.value ||
        mathField.getAttribute("value") ||
        mathField.getAttribute("data-value") ||
        (this as any).domNode.getAttribute("data-value") ||
        ""
      )
    }
    return (this as any).domNode.getAttribute("data-value") || ""
  }
}

// @ts-expect-error - Quill Blot static properties
MathBlot.blotName = "math"
// @ts-expect-error - Quill Blot static properties
MathBlot.tagName = "span"
// @ts-expect-error - Quill Blot static properties
MathBlot.className = "ql-math-embed"

// 注册自定义Blot
// @ts-expect-error - Quill register method
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

    // 设置初始内容为空，避免自动插入 br
    quill.setContents([])

    // 监听内容变化
    quill?.on("text-change", () => {
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
    showStatusMessage("编辑器初始化失败", "error")
  }
}

// 插入数学公式字段
const insertMathField = (latex = "") => {
  console.log('🎯 [MATH_FORMULA_EDITOR] 开始插入数学公式字段', { latex })
  
  if (!quill) {
    console.warn('🎯 [MATH_FORMULA_EDITOR] Quill编辑器未初始化，无法插入公式')
    return
  }

  // 获取当前光标位置，如果没有选择则插入到末尾
  const range = quill.getSelection() || { index: quill.getLength() }
  console.log('🎯 [MATH_FORMULA_EDITOR] 当前光标位置:', range)
  
  // 检查当前光标是否在空段落中，如果是则先插入空格
  const currentText = quill.getText(range.index, 1)
  if (currentText === '\n' || (range.index === 0 && currentText === '')) {
    console.log('🎯 [MATH_FORMULA_EDITOR] 在空段落中，先插入空格')
    quill.insertText(range.index, ' ')
    range.index += 1
  }
  
  // 插入数学公式作为行内元素
  console.log('🎯 [MATH_FORMULA_EDITOR] 插入数学公式到位置:', range.index)
  quill.insertEmbed(range.index, "math", latex)
  
  // 在公式后插入空格，确保后续文本不会紧贴公式
  quill.insertText(range.index + 1, ' ')
  console.log('🎯 [MATH_FORMULA_EDITOR] 数学公式插入完成，已添加后续空格')
  
  // 聚焦到新插入的公式编辑器（不聚焦 Quill）
  const focusNewMathField = (attempt = 1) => {
    console.log(`🎯 [MATH_FORMULA_EDITOR] 尝试聚焦到新公式字段，第${attempt}次尝试`)
    const [blot] = quill?.getLeaf(range.index) || []
    if (blot && (blot as any).domNode && typeof (blot as any).domNode.querySelector === 'function') {
      const mathField = (blot as any).domNode.querySelector("math-field")
      if (mathField) {
        console.log('🎯 [MATH_FORMULA_EDITOR] 成功聚焦到数学公式字段')
        mathField.focus()
        return
      }
    }
    if (attempt < 3) {
      console.log(`🎯 [MATH_FORMULA_EDITOR] 聚焦失败，${100}ms后重试`)
      setTimeout(() => focusNewMathField(attempt + 1), 100)
    } else {
      console.warn('🎯 [MATH_FORMULA_EDITOR] 聚焦到数学公式字段失败，已达到最大重试次数')
    }
  }
  setTimeout(() => focusNewMathField(), 120)
}

// 获取 Markdown 内容
const getMarkdownContent = () => {
  if (!quill) {
    console.log('🎯 [MATH_FORMULA_EDITOR] Quill编辑器未初始化，无法获取内容')
    return ''
  }
  
  // 直接从DOM获取数学公式内容，绕过Quill的Delta结构问题
  const editorElement = document.getElementById(editorId.value)
  const mathFields = editorElement?.querySelectorAll('math-field') || []
  let markdown = ''
  
  console.log('🎯 [MATH_FORMULA_EDITOR] 找到的数学公式字段数量:', mathFields.length)
  
  // 遍历所有数学公式字段
  mathFields.forEach((mathField: any, index: number) => {
    const latex = mathField.value || ''
    console.log(`🎯 [MATH_FORMULA_EDITOR] 数学公式字段 ${index} 内容:`, latex)
    if (latex.trim()) {
      markdown += `$${latex}$`
    }
  })
  
  // 如果没有找到数学公式，尝试从Quill的Delta获取
  if (!markdown.trim()) {
    console.log('🎯 [MATH_FORMULA_EDITOR] 未找到数学公式，尝试从Delta获取')
    const delta = quill.getContents()
    console.log('🎯 [MATH_FORMULA_EDITOR] 获取到的Delta内容:', delta)
    
    delta.ops?.forEach((op: any, index: number) => {
      console.log(`🎯 [MATH_FORMULA_EDITOR] 处理Delta操作 ${index}:`, op)
      
      if (op.insert) {
        if (typeof op.insert === 'string') {
          console.log(`🎯 [MATH_FORMULA_EDITOR] 添加文本: "${op.insert}"`)
          markdown += op.insert
        } else if (op.insert.math) {
          // 处理数学公式
          const latex = op.insert.math
          console.log(`🎯 [MATH_FORMULA_EDITOR] 添加数学公式: "${latex}"`)
          markdown += `$${latex}$`
        } else {
          console.log(`🎯 [MATH_FORMULA_EDITOR] 未知的插入类型:`, op.insert)
        }
      }
      
      if (op.attributes) {
        console.log(`🎯 [MATH_FORMULA_EDITOR] 处理格式属性:`, op.attributes)
        // 处理格式属性（如粗体、斜体等）
        if (op.attributes.bold) {
          markdown = markdown.replace(/(.+)/, '**$1**')
        }
        if (op.attributes.italic) {
          markdown = markdown.replace(/(.+)/, '*$1*')
        }
      }
    })
  }
  
  console.log('🎯 [MATH_FORMULA_EDITOR] 最终生成的Markdown内容:', markdown)
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



// 显示状态提示
const showStatusMessage = (message: any, type = "success") => {
  statusMessage.value = message
  statusType.value = type
  showStatus.value = true

  setTimeout(() => {
    showStatus.value = false
  }, 3000)
}

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



/* 状态指示器 */
.status-indicator {
  position: fixed;
  top: 30px;
  right: 30px;
  padding: 15px 20px;
  background: #28a745;
  color: white;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.status-indicator.show {
  opacity: 1;
  transform: translateY(0);
}

.status-indicator.error {
  background: #dc3545;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
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

/* 隐藏空的 br 标签 */
.ql-editor br:only-child {
  display: none;
}

.ql-editor p:empty {
  display: none;
}

.ql-editor p:has(br:only-child) {
  display: none;
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
