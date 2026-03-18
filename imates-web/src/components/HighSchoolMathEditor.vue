<template>
  <div class="hsm-editor">
    <!-- 核心交互区 -->
    <div class="hsm-core">
      <!-- 源码编辑 -->
      <div class="hsm-core-col">
        <div class="hsm-section-header">
          <label class="hsm-section-label">LATEX 公式</label>
          <div class="hsm-section-actions">
            <button
              type="button"
              class="hsm-link-btn"
              :disabled="!canUndo"
              @click="undo"
            >
              <img :src="redoIcon" alt="前进" class="hsm-action-icon" />
            </button>
            <button
              type="button"
              class="hsm-link-btn"
              :disabled="!canRedo"
              @click="redo"
            >
              <img :src="undoIcon" alt="后退" class="hsm-action-icon" />
            </button>
            <button @click="clear" class="hsm-link-btn hsm-link-btn--danger">
              <img :src="clearIcon" alt="清空内容" class="hsm-action-icon" />
            </button>
          </div>
        </div>
        <div class="hsm-editor-wrapper" ref="editorWrapper">
          <pre ref="prismLayer" class="hsm-prism-layer" aria-hidden="true"><code class="language-latex" v-html="highlightedFormula"></code></pre>
          <div
            ref="editor"
            class="latex-input hsm-textarea hsm-contenteditable"
            contenteditable="true"
            spellcheck="false"
            :data-placeholder="'在此处输入或通过上方工具栏生成代码...'"
            @input="onEditorInput"
            @keydown="onEditorKeydown"
            @focus="handleEditorFocus"
            @click="updateCursorPosition"
            @keyup="updateCursorPosition"
          />

          <!-- 光标浮动按钮 -->
          <div
            v-if="cursorButton.show"
            class="cursor-float-button"
            :style="{ left: `${cursorButton.x}px`, top: `${cursorButton.y}px` }"
          >
            <Popover
              v-model="showCursorPopover"
              trigger="manual"
              placement="right"
              :offset="8"
              :z-index="1111112"
              :maxWidth="800"
              :maxHeight="2000"
            >
              <template #trigger>
                <button
                  class="float-trigger-btn"
                  @mousedown="handleFloatButtonMouseDown"
                  :class="{ active: showCursorPopover }"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </template>

              <div class="symbol-panel-popup">
                <div class="scroll-x-container">
                  <div v-for="(group, name) in symbolGroups" :key="name" class="symbol-category">
                    <span class="hsm-category-title">{{ name }}</span>
                    <div class="hsm-symbol-grid">
                      <button
                        v-for="item in group"
                        :key="item.label"
                        @mousedown="handleSymbolClick(item)"
                        class="symbol-btn"
                        :title="item.label"
                      >
                        <span class="hsm-symbol" v-html="renderStatic(item.value)" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Popover>
          </div>
        </div>
      </div>

      <!-- 实时预览 -->
      <div class="hsm-core-col hsm-core-col--preview">
        <div class="hsm-section-header">
          <label class="hsm-section-label">数学渲染预览</label>
        </div>
        <div class="hsm-preview-wrapper">
          <div class="preview-container">
            <div v-if="formula.trim()" ref="previewArea"></div>
            <div v-else class="hsm-preview-empty">等待输入公式...</div>
          </div>
          <div v-if="error" class="hsm-error">
            语法错误: {{ error }}
          </div>
        </div>
      </div>
    </div>

    <!-- 提示框 -->
    <div v-if="toast" class="hsm-toast">
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import Popover from './base/Popover.vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-latex'
import 'prismjs/themes/prism.css'
import undoIcon from '/icons/undo.svg'
import redoIcon from '/icons/redo.svg'
import clearIcon from '/icons/delete.svg'

// Props
interface Props {
  modelValue?: string
  apiKey?: string
}

interface SymbolItem {
  label: string
  value: string
  display?: string
  cursorStart?: number
  cursorEnd?: number
}

type HistorySnapshot = {
  value: string
  selectionStart: number
  selectionEnd: number
}
const props = withDefaults(defineProps<Props>(), {
  modelValue: '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
  apiKey: ''
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'formula-insert': [formula: string]
}>()

// Reactive data
// 公式内容，双向绑定到父组件的 modelValue
const formula = ref(props.modelValue)
// 编辑器容器元素的引用
const editorWrapper = ref<HTMLElement>()
// 主编辑器元素的引用
const editor = ref<HTMLElement>()
// 语法高亮层的引用
const prismLayer = ref<HTMLElement>()
// 预览区域的引用
const previewArea = ref<HTMLElement>()
// 错误信息状态
const error = ref<string | null>(null)
// 提示信息状态
const toast = ref('')

// 光标浮动按钮的位置和显示状态
const cursorButton = ref({ show: false, x: 0, y: 0 })
// 光标气泡菜单的显示状态
const showCursorPopover = ref(false)

// 计算属性：语法高亮后的公式
const highlightedFormula = computed(() => {
  const value = formula.value || ''
  const highlighted = Prism.highlight(value, Prism.languages.latex, 'latex')
  return highlighted.length > 0 ? highlighted : '&nbsp;'
})

// 历史记录数组
const history = ref<HistorySnapshot[]>([])
// 当前历史记录索引
const historyIndex = ref(-1)
// 是否正在恢复历史记录的状态标记
const isRestoringHistory = ref(false)

// 计算属性：是否可以撤销
const canUndo = computed(() => historyIndex.value > 0)
// 计算属性：是否可以重做
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1)


// 高中数学知识板块分类
const symbolGroups: Record<string, SymbolItem[]> = {
  '运算符号': [
    { label: '加', value: '+' },
    { label: '减', value: '-' },
    { label: '乘', value: '\\times' },
    { label: '除', value: '\\div' },
    { label: '等号', value: '=' },
    { label: '大于', value: '>' },
    { label: '小于', value: '<' },
    { label: '大于等于', value: '\\geq' },
    { label: '小于等于', value: '\\leq' },
    { label: '约等于', value: '\\approx' },
    { label: '推出', value: '\\Rightarrow' },
    { label: '圆括号', value: '( )', cursorStart: 2, cursorEnd: 2 },
    { label: '方括号', value: '[ ]', cursorStart: 2, cursorEnd: 2 },
    { label: '绝对值', value: '| |', cursorStart: 2, cursorEnd: 2 },
  ],
    '函数与导数': [
    { label: '分数', value: '\\frac{ }{ }', display: '\\frac{\\square}{\\square}' },
    { label: '根号', value: '\\sqrt{ }', display: '\\sqrt{\\square}' },
    { label: '对数', value: '\\log_{a}(x)', display: '\\log_{\\square}(\\square)', cursorStart: 6, cursorEnd: 7 },
    { label: '自然对数', value: '\\ln(x)', display: '\\ln(\\square)', cursorStart: 4, cursorEnd: 5 },
    { label: '指数', value: 'e^{ }', display: 'e^{\\square}' },
    { label: '平方', value: 'x^{2}', cursorStart: 0, cursorEnd: 1 },
    { label: '立方', value: 'x^{3}', cursorStart: 0, cursorEnd: 1 },
    { label: 'n次方', value: 'x^{n}', cursorStart: 0, cursorEnd: 1 },
    { label: 'a平方', value: 'a^{2}', cursorStart: 0, cursorEnd: 1 },
    { label: 'a立方', value: 'a^{3}', cursorStart: 0, cursorEnd: 1 },
    { label: '导数', value: "f'(x)" },

    { label: '方程组', value: '\\begin{cases} x + y = 2 \\\\ x - y = 0 \\\\ \\end{cases}', cursorStart: 12, cursorEnd: 13 },
  ],
  '集合与常用逻辑': [
    { label: '属于', value: '\\in' },
    { label: '包含于', value: '\\subseteq' },
    { label: '真包含于', value: '\\subsetneqq' },
    { label: '并集', value: '\\cup' },
    { label: '交集', value: '\\cap' },
    { label: '空集', value: '\\emptyset' },
    { label: '补集', value: '\\complement_U' },
    { label: '任意', value: '\\forall' },
    { label: '存在', value: '\\exists' },
  ],

  '三角函数': [
    { label: '正弦', value: '\\sin(x)', cursorStart: 5, cursorEnd: 6 },
    { label: '余弦', value: '\\cos(x)', cursorStart: 5, cursorEnd: 6 },
    { label: '正切', value: '\\tan(x)', cursorStart: 5, cursorEnd: 6 },
    { label: '角度', value: '^{\\circ}', display: '\\square^{\\circ}' },
    { label: '圆周率', value: '\\pi' },
    { label: '希腊alpha', value: '\\alpha' },
    { label: '希腊theta', value: '\\theta' },
    { label: '希腊omega', value: '\\omega' }
  ],
  '数列与向量': [
    { label: '向量', value: '\\vec{ }', display: '\\vec{\\square}' },
    { label: '点乘', value: '\\cdot' },
    { label: '求和', value: '\\sum_{i=1}^{n}' },
    { label: '通项', value: 'a_n' },
    { label: '模', value: '| |', display: '|\\vec{\\square}|' },
    { label: '平行', value: '\\parallel' },
    { label: '垂直', value: '\\perp' }
  ],
  '几何与变换': [
    { label: '三角形', value: '\\triangle' },
    { label: '全等', value: '\\cong' },
    { label: '相似', value: '\\sim' },
    { label: '因为', value: '\\because' },
    { label: '所以', value: '\\therefore' },
    { label: '椭圆模板', value: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1' }
  ],
  '概率统计与复数': [
    { label: '组合', value: 'C_{n}^{m}' },
    { label: '排列', value: 'A_{n}^{m}' },
    { label: '期望', value: 'E(X)' },
    { label: '方差', value: 'D(X)' },
    { label: '平均数', value: '\\bar{x}' },
    { label: '虚数', value: 'i' },
    { label: '共轭复数', value: '\\bar{z}' },
    { label: '不等于', value: '\\neq' }
  ]
}

// 获取编辑器纯文本内容
const getEditorPlainText = () => {
  const el = editor.value
  if (!el) return ''
  return (el.innerText || '').replace(/\r\n/g, '\n')
}

// 设置编辑器纯文本内容，使用 textContent 防止 HTML 注入风险
const setEditorPlainText = (value: string) => {
  const el = editor.value
  if (!el) return
  // 使用 textContent 设置纯文本，确保安全性
  el.textContent = value
}

// 判断选区是否完全位于编辑器内部
const isSelectionInsideEditor = (sel: Selection) => {
  const el = editor.value
  if (!el) return false
  // 获取选区的起始节点
  const node = sel.anchorNode
  // 检查节点是否存在且被编辑器元素包含
  return !!node && el.contains(node)
}

// 确保编辑器内存在折叠光标选区，用于光标定位
const ensureCollapsedSelectionInEditor = () => {
  // 获取编辑器对象
  const el = editor.value
  if (!el) return
  // 获取全局选区对象
  const sel = window.getSelection()
  if (!sel) return

  // 如果已有有效选区且在编辑器内，则无需处理
  if (sel.rangeCount > 0 && isSelectionInsideEditor(sel)) return

  // 聚焦编辑器并创建折叠选区
  el.focus()
  const r = document.createRange()
  // 选中编辑器全部内容
  r.selectNodeContents(el)
  // 折叠到末尾，形成光标
  r.collapse(false)
  // 清除旧选区并设置新选区
  sel.removeAllRanges()
  sel.addRange(r)
}

// 选区-文本双向转换
// 选区位置 → 文本位置  
const getSelectionCharOffsets = () => {
  // 获取编辑器元素和当前选区对象
  const el = editor.value
  const sel = window.getSelection()
  
  // 验证编辑器、选区是否存在，以及选区是否在编辑器内部
  if (!el || !sel || sel.rangeCount === 0 || !isSelectionInsideEditor(sel)) {
    return { start: 0, end: 0 }
  }

  // 获取当前选区的第一个范围
  const range = sel.getRangeAt(0)
  
  // 创建范围来测量选区开始位置的字符偏移量
  const pre = document.createRange()
  pre.selectNodeContents(el) // 选中编辑器全部内容
  pre.setEnd(range.startContainer, range.startOffset) // 设置结束点为选区开始位置
  const start = pre.toString().length // 计算开始位置的字符数

  // 创建范围来测量选区结束位置的字符偏移量
  const pre2 = document.createRange()
  pre2.selectNodeContents(el) // 选中编辑器全部内容
  pre2.setEnd(range.endContainer, range.endOffset) // 设置结束点为选区结束位置
  const end = pre2.toString().length // 计算结束位置的字符数
  
  // 返回选区的开始和结束字符偏移量
  return { start, end }
}

// 文本位置 → 选区位置
const setSelectionByCharOffsets = (start: number, end: number) => {
  // 获取编辑器元素引用
  const el = editor.value
  if (!el) return

  // 获取编辑器内所有文本节点
  const getTextNodes = () => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let n = walker.nextNode() as Text | null
    while (n) {
      nodes.push(n)
      n = walker.nextNode() as Text | null
    }
    return nodes
  }

  // 限制偏移量在有效范围内
  const clampOffsets = (nodes: Text[]) => {
    const total = nodes.reduce((sum, t) => sum + (t.nodeValue?.length ?? 0), 0)
    const s = Math.max(0, Math.min(start, total))
    const e = Math.max(0, Math.min(end, total))
    return { s, e }
  }

  // 根据字符位置定位到具体的文本节点和偏移量
  const locate = (nodes: Text[], pos: number) => {
    let acc = 0
    for (const t of nodes) {
      const len = t.nodeValue?.length ?? 0
      if (acc + len >= pos) {
        return { node: t as Node, offset: pos - acc }
      }
      acc += len
    }
    const last = nodes[nodes.length - 1]
    return { node: last as Node, offset: (last.nodeValue?.length ?? 0) }
  }

  // 获取所有文本节点
  const nodes = getTextNodes()

  // 如果没有文本节点，创建空选区
  if (nodes.length === 0) {
    const r = document.createRange()
    r.setStart(el, 0)
    r.setEnd(el, 0)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    return
  }

  // 限制偏移量并定位位置
  const { s, e } = clampOffsets(nodes)
  const sPos = locate(nodes, s)
  const ePos = locate(nodes, e)

  // 创建并设置选区范围
  const r = document.createRange()
  r.setStart(sPos.node, sPos.offset)
  r.setEnd(ePos.node, ePos.offset)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}

// 确保历史记录已初始化
const ensureHistoryInitialized = () => {
  if (history.value.length > 0) return
  const sel = getSelectionCharOffsets()
  history.value = [{ value: formula.value || '', selectionStart: sel.start, selectionEnd: sel.end }]
  historyIndex.value = 0
}

// 推入历史快照
const pushHistorySnapshot = (value: string, selectionStart: number, selectionEnd: number) => {
  if (isRestoringHistory.value) return

  const prev = history.value[historyIndex.value]
  if (prev && prev.value === value && prev.selectionStart === selectionStart && prev.selectionEnd === selectionEnd) {
    return
  }

  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  history.value.push({ value, selectionStart, selectionEnd })
  historyIndex.value = history.value.length - 1
}

// 应用历史快照到编辑器
const applySnapshot = async (snap: HistorySnapshot) => {
  // 设置历史恢复状态标志，防止触发新的历史记录
  isRestoringHistory.value = true
  // 更新公式值为快照中的值
  formula.value = snap.value
  // 等待下一个渲染周期
  await nextTick()
  // 将快照内容设置为编辑器纯文本
  setEditorPlainText(snap.value)
  // 根据快照中的选区位置设置当前选区
  setSelectionByCharOffsets(snap.selectionStart, snap.selectionEnd)
  // 清除历史恢复状态标志
  isRestoringHistory.value = false
}

// 将 LaTeX 字符串转换为静态 HTML 渲染结果
const renderStatic = (latex: string) => {
  try {
    // 使用 KaTeX 将 LaTeX 渲染为 HTML 字符串，遇到错误时不抛出异常
    return katex.renderToString(latex, { throwOnError: false })
  } catch (e) { 
    // 渲染失败时返回原始 LaTeX 字符串作为后备
    return latex 
  }
}

// 在预览区域渲染当前公式的 KaTeX 表达式
const updatePreview = () => {
  if (!formula.value.trim()) return
  nextTick(() => {
    if (previewArea.value) {
      try {
        katex.render(formula.value, previewArea.value, {
          throwOnError: true,
          displayMode: true
        })
        error.value = null
      } catch (e: any) {
        error.value = e.message
      }
    }
  })
}

// 在编辑器中插入指定的文本内容
const insert = (text: string, cursorStart?: number, cursorEnd?: number) => {
  // 获取编辑器元素引用
  const el = editor.value
  if (!el) return
  // 获取当前选区对象
  const sel = window.getSelection()
  if (!sel) return

  // 如果选区不存在或不在编辑器内，确保编辑器内有折叠选区
  if (sel.rangeCount === 0 || !isSelectionInsideEditor(sel)) {
    ensureCollapsedSelectionInEditor()
  }

  // 获取当前选区范围并删除选中内容
  const range = sel.getRangeAt(0)
  range.deleteContents()

  // 创建文本节点并插入到选区位置
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)

  // 计算光标位置：优先使用传入参数，否则根据大括号位置或文本长度设置
  const startOffset = typeof cursorStart === 'number' ? cursorStart : (text.includes('{') ? text.indexOf('{') + 1 : text.length)
  const endOffset = typeof cursorEnd === 'number' ? cursorEnd : startOffset
  // 确保偏移量在有效范围内
  const s = Math.max(0, Math.min(startOffset, textNode.length))
  const e = Math.max(0, Math.min(endOffset, textNode.length))

  // 创建新的选区范围并设置为插入内容内的指定位置
  const newRange = document.createRange()
  newRange.setStart(textNode, s)
  newRange.setEnd(textNode, e)
  sel.removeAllRanges()
  sel.addRange(newRange)

  // 同步更新公式值
  formula.value = getEditorPlainText()
  emit('update:modelValue', formula.value)

  // 在下一个tick中更新历史记录和光标位置
  nextTick(() => {
    ensureHistoryInitialized()
    const offsets = getSelectionCharOffsets()
    pushHistorySnapshot(formula.value || '', offsets.start, offsets.end)
    updateCursorPosition()
  })

  // 触发公式插入事件
  emit('formula-insert', text)
}

// 切换光标弹窗的显示状态
const handleFloatButtonMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  showCursorPopover.value = !showCursorPopover.value
}

// 插入符号并关闭光标弹窗
const handleSymbolClick = (item: SymbolItem) => {
  insert(item.value, item.cursorStart, item.cursorEnd)
  showCursorPopover.value = false
}

// 根据光标弹窗显示状态控制光标按钮可见性的小工具函数
const hideCursorButtonIfAllowed = () => {
  if (!showCursorPopover.value) {
    cursorButton.value = { show: false, x: 0, y: 0 }
  }
}

// 获取当前编辑器内的 Selection 对象，若不在编辑器或无选区返回 null
const getSelectionInEditor = () => {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  if (!isSelectionInsideEditor(sel)) return null
  return sel
}

// 在给定范围内获取光标矩形，必要时插入探针标记以测量
const getRangeRectWithProbe = (range: Range, sel: Selection) => {
  // 获取范围的初始矩形信息
  let rect = range.getBoundingClientRect()

  // 如果矩形宽度或高度为0，说明可能是空选区或不可见内容
  if (rect && rect.width === 0 && rect.height === 0) {
    try {
      // 创建一个不可见的零宽度空格标记作为探针
      const marker = document.createElement('span')
      marker.textContent = '\u200B'
      // 克隆当前范围以避免修改原始范围
      const probeRange = range.cloneRange()
      // 在范围位置插入探针标记
      probeRange.insertNode(marker)
      // 获取探针标记的矩形信息
      rect = marker.getBoundingClientRect()
      // 移除探针标记，避免影响DOM结构
      marker.parentNode?.removeChild(marker)

      // 恢复原始选区状态
      const restoreRange = document.createRange()
      restoreRange.setStart(range.startContainer, range.startOffset)
      restoreRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(restoreRange)
    } catch {
      // 忽略可能出现的DOM操作异常
    }
  }

  return rect
}

// 在光标不可用时返回回退的光标矩形信息
const getFallbackCaretRect = (el: HTMLElement) => {
  const editorRect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  const padLeft = parseFloat(style.paddingLeft || '0')
  const padTop = parseFloat(style.paddingTop || '0')
  const lineHeight = parseFloat(style.lineHeight || '20')
  return {
    left: editorRect.left + padLeft,
    top: editorRect.top + padTop,
    right: editorRect.left + padLeft + 1,
    bottom: editorRect.top + padTop + lineHeight,
    width: 1,
    height: lineHeight,
    x: editorRect.left + padLeft,
    y: editorRect.top + padTop,
    toJSON: () => ({}),
  } as DOMRect
}

// 根据当前选区和编辑器元素计算光标位置及包装区矩形
const getCaretRect = (sel: Selection, wrapper: HTMLElement, el: HTMLElement) => {
  const range = sel.getRangeAt(0)
  const rect = getRangeRectWithProbe(range, sel)

  // 当内容为空时，range rect 可能是 0（或不可用），回退到编辑器左上角 padding 处
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return { caretRect: getFallbackCaretRect(el), wrapperRect: wrapper.getBoundingClientRect() }
  }

  return { caretRect: rect, wrapperRect: wrapper.getBoundingClientRect() }
}

// 计算并更新光标按钮的位置
const updateCursorPosition = () => {
  // 获取编辑器包装器和编辑器元素的引用
  const wrapper = editorWrapper.value
  const el = editor.value
  if (!wrapper || !el) return

  // 获取全局选区对象
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    // 确保编辑器内选区为折叠状态并可正常定位光标
    ensureCollapsedSelectionInEditor()
  }
  // 获取当前编辑器内的 Selection 对象，若不在编辑器或无选区返回 null
  const sel2 = getSelectionInEditor()
  if (!sel2) {
    // 根据光标弹窗显示状态控制光标按钮的可见性
    hideCursorButtonIfAllowed()
    return
  }

  // 检查选区是否为折叠状态（光标状态）
  if (!sel2.isCollapsed) {
    // 根据光标弹窗显示状态控制光标按钮的可见性
    hideCursorButtonIfAllowed()
    return
  }

  // 根据当前选区和编辑器元素计算光标位置及包装区矩形
  const { caretRect, wrapperRect } = getCaretRect(sel2, wrapper, el)

  // 计算光标按钮相对于包装器的位置
  const x = caretRect.left - wrapperRect.left - 5
  const y = caretRect.top - wrapperRect.top + caretRect.height / 2 - 16

  // 更新光标按钮的显示状态和位置
  cursorButton.value = { show: true, x, y }
}

// 确保选区存在并更新光标位置
const handleEditorFocus = () => {
  ensureCollapsedSelectionInEditor()
  updateCursorPosition()
}

// 撤销操作
const undo = async () => {
  ensureHistoryInitialized()
  if (!canUndo.value) return
  historyIndex.value -= 1
  const snap = history.value[historyIndex.value]
  if (snap) await applySnapshot(snap)
}

// 重做操作
const redo = async () => {
  ensureHistoryInitialized()
  if (!canRedo.value) return
  historyIndex.value += 1
  const snap = history.value[historyIndex.value]
  if (snap) await applySnapshot(snap)
}

// 清除编辑器内容并重置相关状态
const clear = () => { 
  // 获取编辑器当前选区的字符偏移量
  const sel = getSelectionCharOffsets()
  formula.value = ''
  error.value = null 

  // 将纯文本设置到编辑区域的文本内容
  setEditorPlainText('')

  emit('update:modelValue', formula.value)

  // 确保历史快照数组已初始化，若空则创建初始快照并设置索引
  ensureHistoryInitialized()
  // 将当前文本与选区快照推入历史记录数组
  pushHistorySnapshot('', sel.start, sel.end)
}

// 编辑器输入事件处理
const onEditorInput = () => {
  // 获取编辑器的纯文本内容
  formula.value = getEditorPlainText()
  // 同步数据
  emit('update:modelValue', formula.value)
  // 确保历史快照数组已初始化，若空则创建初始快照并设置索引
  ensureHistoryInitialized()
  // 获取选区在编辑区的字符偏移量
  const sel = getSelectionCharOffsets()
  // 将当前编辑内容与光标范围加入历史快照并维护索引
  pushHistorySnapshot(formula.value || '', sel.start, sel.end)
  // 在编辑器聚焦或内容变化时计算光标位置并更新浮动按钮
  updateCursorPosition()
}

// 编辑器键盘事件处理
const onEditorKeydown = (event: KeyboardEvent) => {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
  const isMeta = isMac ? event.metaKey : event.ctrlKey
  if (!isMeta) return

  const key = (event.key || '').toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      void redo()
    } else {
      void undo()
    }
    return
  }
  if (key === 'y') {
    event.preventDefault()
    void redo()
  }
}

// 组件挂载时初始化各项功能
onMounted(() => {
  // 在预览区域渲染当前公式的 KaTeX 表达式
  updatePreview()
  nextTick(() => {
    // 将编辑器的纯文本内容写入 DOM
    setEditorPlainText(formula.value || '')
    // 确保历史记录数组已初始化为初始快照
    ensureHistoryInitialized()
    // 在编辑器聚焦或内容变化时计算光标位置并更新浮动按钮。
    updateCursorPosition()
  })

  document.addEventListener('selectionchange', updateCursorPosition)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', updateCursorPosition)
})
</script>

<style scoped>
.hsm-editor {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  height: 100%;
}

/* 气泡中的符号面板 */
.symbol-panel-popup {
  max-width: none;
  overflow-y: auto;
}

.symbol-panel-popup .hsm-category-title {
  font-size: 11px;
  color: #2563eb;
  font-weight: 700;
  padding-left: 4px;
  border-left: 3px solid #2563eb;
  margin-bottom: 8px;
  display: block;
  white-space: nowrap;
}

.symbol-panel-popup .symbol-category {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 12px;
}

.symbol-panel-popup .hsm-symbol-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.symbol-panel-popup .symbol-btn {
  min-width: 36px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: all 0.2s;
}

.symbol-panel-popup .symbol-btn:hover {
  transform: translateY(-1px);
  background-color: #f3f4f6;
  border-color: #3b82f6;
}

.symbol-panel-popup .hsm-symbol {
  display: inline-block;
  transform: scale(0.8);
  transform-origin: center;
}

.symbol-panel-popup .scroll-x-container {
  display: flex;
  overflow-x: auto;
  gap: 1rem;
  padding-bottom: 0.5rem;
  scrollbar-width: thin;
}


.hsm-core {
  border-top: 1px solid #f1f5f9;
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
}

.hsm-core-col {
  padding: 24px;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hsm-core-col + .hsm-core-col {
  border-top: 1px solid #f1f5f9;
}


.hsm-core {
  grid-template-columns: 1fr 1fr;
  min-width: 0;
}
.hsm-core-col + .hsm-core-col {
  border-top: none;
  border-left: 1px solid #f1f5f9;
}

.hsm-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.hsm-editor-wrapper,
.hsm-preview-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: #f8fafc;
  border-radius: 12px;
}

.hsm-section-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hsm-link-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.hsm-section-label {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.12em;
}

.hsm-link-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.hsm-action-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.hsm-link-btn--danger {
  color: #f87171;
}

.hsm-link-btn--danger:hover {
  color: #dc2626;
}

.hsm-link-btn--primary {
  color: #3b82f6;
}

.hsm-link-btn--primary:hover {
  color: #1d4ed8;
}

.hsm-textarea {
  width: 100%;
  height: 224px;
  padding: 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  line-height: 1.6;
}

.hsm-editor-wrapper {
  position: relative;
  height: 100%;
  border-radius: 12px;
}

.hsm-prism-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 20px;
  border-radius: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 16px;
  line-height: 1.6;
  background: #f8fafc;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  pointer-events: none;
  z-index: 1;
}

.hsm-prism-layer code {
  white-space: pre-wrap;
  word-break: break-word;
}

.hsm-contenteditable {
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: transparent;
  color: transparent;
  caret-color: #0f172a;
  position: relative;
  z-index: 2;
}

.hsm-contenteditable::selection {
  background: rgba(59, 130, 246, 0.25);
}

.hsm-contenteditable:empty:before {
  content: attr(data-placeholder);
  color: #cbd5e1;
  pointer-events: none;
}

.cursor-float-button {
  position: absolute;
  z-index: 1111111;
  pointer-events: none;
}

.float-trigger-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(147, 51, 234, 0.3);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  pointer-events: auto;
}

.float-trigger-btn.active {
  background: rgba(126, 34, 206, 0.6);
  transform: rotate(45deg);
}

.latex-input{
  outline: none;
  border-color: none;
  height: 100%;
}

.hsm-preview-empty {
  font-size: 14px;
  color: #cbd5e1;
  font-style: italic;
}

.hsm-error {
  margin-top: 12px;
  font-size: 10px;
  color: #ef4444;
  background: #fef2f2;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #fee2e2;
  line-height: 1.4;
}

.hsm-toast {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  background: #1f2937;
  color: #ffffff;
  padding: 12px 32px;
  border-radius: 999px;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.3);
  z-index: 50;
  font-size: 14px;
  font-weight: 700;
  animation: hsm-bounce 1s infinite;
}

@keyframes hsm-bounce {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-6px);
  }
}

.preview-container{
  overflow: auto;
}

.preview-container::-webkit-scrollbar,
.scroll-x-container::-webkit-scrollbar {
  height: 5px;
}

.preview-container::-webkit-scrollbar-thumb,
.scroll-x-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.scroll-x-container {
  display: flex;
  overflow-x: auto;
  gap: 2rem;
  padding-bottom: 1rem;
  scrollbar-width: thin;
}

.symbol-category {
  flex: 0 0 auto;
}
</style>
