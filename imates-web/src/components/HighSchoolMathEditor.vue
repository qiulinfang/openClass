<template>
  <div class="hsm-editor">
    <!-- 核心交互区 -->
    <div class="hsm-core">
      <!-- 源码编辑 -->
      <div class="hsm-core-col">
        <div class="hsm-section-header">
          <label class="hsm-section-label">LATEX 代码</label>
          <div class="hsm-section-actions">
            <button
              type="button"
              class="hsm-link-btn"
              :disabled="!canUndo"
              @click="undo"
            >
              后退
            </button>
            <button
              type="button"
              class="hsm-link-btn"
              :disabled="!canRedo"
              @click="redo"
            >
              前进
            </button>
            <button @click="clear" class="hsm-link-btn hsm-link-btn--danger">清空内容</button>
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
            @scroll="syncEditorScroll"
            @dragover.prevent="onEditorDragOver"
            @drop.prevent="onEditorDrop"
          />

          <!-- 光标浮动按钮 -->
          <div
            v-if="cursorButton.show"
            class="cursor-float-button"
            :style="{ left: `${cursorButton.x}px`, top: `${cursorButton.y}px` }"
          >
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
          </div>

          <!-- 光标位置的 Popover（符号面板） -->
          <Popover
            v-model="showCursorPopover"
            trigger="manual"
            placement="bottom"
            :offset="8"
            :selectionPosition="cursorSelectionPosition"
            :z-index="1111112"
            :maxWidth="800"
            :maxHeight="2000"
          >
            <template #trigger>
              <div style="width: 1px; height: 1px;"></div>
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
                      draggable="true"
                      @dragstart="onSymbolDragStart(item, $event)"
                      class="symbol-btn"
                      :title="item.label"
                    >
                      <span class="hsm-symbol" v-html="renderStatic(item.display || item.value)"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Popover>
        </div>
      </div>

      <!-- 实时预览 -->
      <div class="hsm-core-col hsm-core-col--preview">
        <div class="hsm-section-header">
          <label class="hsm-section-label">数学渲染预览</label>
          <button @click="copyToClipboard" class="hsm-link-btn hsm-link-btn--primary">复制源码</button>
        </div>
        <div class="preview-container">
          <div v-if="formula.trim()" ref="previewArea"></div>
          <div v-else class="hsm-preview-empty">等待输入公式...</div>
        </div>
        <div v-if="error" class="hsm-error">
          语法错误: {{ error }}
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
import type { Component } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-latex'
import 'prismjs/themes/prism.css'

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

interface DragSymbolPayload {
  value: string
  cursorStart?: number
  cursorEnd?: number
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
const formula = ref(props.modelValue)
const editorWrapper = ref<HTMLElement>()
const editor = ref<HTMLElement>()
const prismLayer = ref<HTMLElement>()
const previewArea = ref<HTMLElement>()
const error = ref<string | null>(null)
const toast = ref('')

const cursorButton = ref({ show: false, x: 0, y: 0 })
const cursorSelectionPosition = ref<{ top: number; left: number; right?: number; bottom?: number } | null>(null)
const showCursorPopover = ref(false)

const highlightedFormula = computed(() => {
  const value = formula.value || ''
  const highlighted = Prism.highlight(value, Prism.languages.latex, 'latex')
  return highlighted.length > 0 ? highlighted : '&nbsp;'
})

type HistorySnapshot = {
  value: string
  selectionStart: number
  selectionEnd: number
}

const history = ref<HistorySnapshot[]>([])
const historyIndex = ref(-1)
const isRestoringHistory = ref(false)

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1)

const getEditorPlainText = () => {
  const el = editor.value
  if (!el) return ''
  // innerText 会把 <div><br> 等转换为换行，更符合编辑体验
  return (el.innerText || '').replace(/\r\n/g, '\n')
}

const setEditorPlainText = (value: string) => {
  const el = editor.value
  if (!el) return
  // 用 textContent 保证无 HTML 注入
  el.textContent = value
}

const isSelectionInsideEditor = (sel: Selection) => {
  const el = editor.value
  if (!el) return false
  const node = sel.anchorNode
  return !!node && el.contains(node)
}

const ensureCollapsedSelectionInEditor = () => {
  const el = editor.value
  if (!el) return
  const sel = window.getSelection()
  if (!sel) return

  if (sel.rangeCount > 0 && isSelectionInsideEditor(sel)) return

  el.focus()
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(false)
  sel.removeAllRanges()
  sel.addRange(r)
}

const getSelectionCharOffsets = () => {
  const el = editor.value
  const sel = window.getSelection()
  if (!el || !sel || sel.rangeCount === 0 || !isSelectionInsideEditor(sel)) {
    return { start: 0, end: 0 }
  }

  const range = sel.getRangeAt(0)
  const pre = document.createRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length

  const pre2 = document.createRange()
  pre2.selectNodeContents(el)
  pre2.setEnd(range.endContainer, range.endOffset)
  const end = pre2.toString().length
  return { start, end }
}

const setSelectionByCharOffsets = (start: number, end: number) => {
  const el = editor.value
  if (!el) return

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  let offset = 0

  const findPos = (target: number) => {
    let cur = node
    let curOffset = offset
    while (cur) {
      const len = cur.nodeValue?.length ?? 0
      if (curOffset + len >= target) {
        return { node: cur, offset: target - curOffset }
      }
      curOffset += len
      cur = walker.nextNode() as Text | null
    }
    // fallback
    return { node: el, offset: el.childNodes.length }
  }

  // 重建 walker（因为 findPos 会推进）
  const walker2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n = walker2.nextNode() as Text | null
  while (n) {
    nodes.push(n)
    n = walker2.nextNode() as Text | null
  }

  const total = nodes.reduce((sum, t) => sum + (t.nodeValue?.length ?? 0), 0)
  const s = Math.max(0, Math.min(start, total))
  const e = Math.max(0, Math.min(end, total))

  // 简化：内容通常只有一个 Text 节点
  if (nodes.length === 0) {
    const r = document.createRange()
    r.setStart(el, 0)
    r.setEnd(el, 0)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    return
  }

  // 重新用遍历计算位置
  let acc = 0
  const locate = (pos: number) => {
    for (const t of nodes) {
      const len = t.nodeValue?.length ?? 0
      if (acc + len >= pos) {
        const res = { node: t as Node, offset: pos - acc }
        return res
      }
      acc += len
    }
    const last = nodes[nodes.length - 1]
    return { node: last as Node, offset: (last.nodeValue?.length ?? 0) }
  }
  acc = 0
  const sPos = locate(s)
  acc = 0
  const ePos = locate(e)

  const r = document.createRange()
  r.setStart(sPos.node, sPos.offset)
  r.setEnd(ePos.node, ePos.offset)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}

const applySnapshot = async (snap: HistorySnapshot) => {
  isRestoringHistory.value = true
  formula.value = snap.value
  await nextTick()
  setEditorPlainText(snap.value)
  setSelectionByCharOffsets(snap.selectionStart, snap.selectionEnd)
  isRestoringHistory.value = false
}

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

const ensureHistoryInitialized = () => {
  if (history.value.length > 0) return
  const sel = getSelectionCharOffsets()
  history.value = [{ value: formula.value || '', selectionStart: sel.start, selectionEnd: sel.end }]
  historyIndex.value = 0
}

const undo = async () => {
  ensureHistoryInitialized()
  if (!canUndo.value) return
  historyIndex.value -= 1
  const snap = history.value[historyIndex.value]
  if (snap) await applySnapshot(snap)
}

const redo = async () => {
  ensureHistoryInitialized()
  if (!canRedo.value) return
  historyIndex.value += 1
  const snap = history.value[historyIndex.value]
  if (snap) await applySnapshot(snap)
}

const onEditorInput = () => {
  formula.value = getEditorPlainText()
  emit('update:modelValue', formula.value)
  ensureHistoryInitialized()
  const sel = getSelectionCharOffsets()
  pushHistorySnapshot(formula.value || '', sel.start, sel.end)
  updateCursorPosition()
}

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


// LaTeX rendering
const renderStatic = (latex: string) => {
  try {
    return katex.renderToString(latex, { throwOnError: false })
  } catch (e) { 
    return latex 
  }
}

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

// Formula manipulation
const insert = (text: string, cursorStart?: number, cursorEnd?: number) => {
  const el = editor.value
  if (!el) return
  const sel = window.getSelection()
  if (!sel) return

  if (sel.rangeCount === 0 || !isSelectionInsideEditor(sel)) {
    ensureCollapsedSelectionInEditor()
  }

  const range = sel.getRangeAt(0)
  range.deleteContents()

  const textNode = document.createTextNode(text)
  range.insertNode(textNode)

  // 设置选区到插入内容内部
  const startOffset = typeof cursorStart === 'number' ? cursorStart : (text.includes('{') ? text.indexOf('{') + 1 : text.length)
  const endOffset = typeof cursorEnd === 'number' ? cursorEnd : startOffset
  const s = Math.max(0, Math.min(startOffset, textNode.length))
  const e = Math.max(0, Math.min(endOffset, textNode.length))

  const newRange = document.createRange()
  newRange.setStart(textNode, s)
  newRange.setEnd(textNode, e)
  sel.removeAllRanges()
  sel.addRange(newRange)

  // 同步 formula
  formula.value = getEditorPlainText()
  emit('update:modelValue', formula.value)

  nextTick(() => {
    ensureHistoryInitialized()
    const offsets = getSelectionCharOffsets()
    pushHistorySnapshot(formula.value || '', offsets.start, offsets.end)
    updateCursorPosition()
  })

  emit('formula-insert', text)
}

const clear = () => { 
  const sel = getSelectionCharOffsets()
  formula.value = ''
  error.value = null 

  setEditorPlainText('')

  emit('update:modelValue', formula.value)

  ensureHistoryInitialized()
  pushHistorySnapshot('', sel.start, sel.end)
}

const DRAG_SYMBOL_MIME = 'application/x-hsm-symbol'

const onSymbolDragStart = (item: SymbolItem, event: DragEvent) => {
  if (!event.dataTransfer) return
  const payload: DragSymbolPayload = {
    value: item.value,
    cursorStart: item.cursorStart,
    cursorEnd: item.cursorEnd,
  }
  event.dataTransfer.setData(DRAG_SYMBOL_MIME, JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', item.value)
  event.dataTransfer.effectAllowed = 'copy'
}

const onEditorDragOver = (event: DragEvent) => {
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = 'copy'
}

const onEditorDrop = (event: DragEvent) => {
  const dt = event.dataTransfer
  if (!dt) return

  const raw = dt.getData(DRAG_SYMBOL_MIME)
  if (raw) {
    try {
      const payload = JSON.parse(raw) as DragSymbolPayload
      insert(payload.value, payload.cursorStart, payload.cursorEnd)
      return
    } catch {
      // ignore
    }
  }

  const plain = dt.getData('text/plain')
  if (plain) {
    insert(plain)
  }
}

const handleFloatButtonMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  showCursorPopover.value = !showCursorPopover.value
}

const handleSymbolClick = (item: SymbolItem) => {
  insert(item.value, item.cursorStart, item.cursorEnd)
  showCursorPopover.value = false
}

const updateCursorPosition = () => {
  const sel = window.getSelection()
  const wrapper = editorWrapper.value
  const el = editor.value
  if (!wrapper || !el) return
  if (!sel || sel.rangeCount === 0) {
    // 空内容时点击占位符可能拿不到 selection，这里尝试补一个折叠选区
    ensureCollapsedSelectionInEditor()
  }

  const sel2 = window.getSelection()
  if (!sel2 || sel2.rangeCount === 0 || !isSelectionInsideEditor(sel2)) {
    if (!showCursorPopover.value) {
      cursorButton.value = { show: false, x: 0, y: 0 }
      cursorSelectionPosition.value = null
    }
    return
  }

  if (!sel2.isCollapsed) {
    if (!showCursorPopover.value) {
      cursorButton.value = { show: false, x: 0, y: 0 }
      cursorSelectionPosition.value = null
    }
    return
  }

  const range = sel2.getRangeAt(0)
  let rect = range.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()

  // 当内容为空时，range rect 可能是 0（或不可用），回退到编辑器左上角 padding 处
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const editorRect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    const padLeft = parseFloat(style.paddingLeft || '0')
    const padTop = parseFloat(style.paddingTop || '0')
    const lineHeight = parseFloat(style.lineHeight || '20')
    rect = {
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

  // 按钮定位在光标左侧稍微偏右一些（与之前需求一致）
  const x = rect.left - wrapperRect.left - 5
  const y = rect.top - wrapperRect.top + rect.height / 2 - 16

  cursorButton.value = { show: true, x, y }
  cursorSelectionPosition.value = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

const handleEditorFocus = () => {
  ensureCollapsedSelectionInEditor()
  updateCursorPosition()
}

const syncEditorScroll = () => {
  const el = editor.value
  const layer = prismLayer.value
  if (!el || !layer) return
  layer.scrollTop = el.scrollTop
  layer.scrollLeft = el.scrollLeft
}

const copyToClipboard = () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(formula.value)
    showToast('代码已复制到剪贴板')
  } else {
    const el = document.createElement('textarea')
    el.value = formula.value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    showToast('代码已复制到剪贴板')
  }
}

const showToast = (msg: string) => {
  toast.value = msg
  setTimeout(() => toast.value = '', 2000)
}

// Watchers
watch(formula, () => {
  updatePreview()
})

watch(() => props.modelValue, (newVal) => {
  const incoming = newVal ?? ''
  // 如果外部值与编辑器当前内容一致，不要重设 DOM（重设会把光标打回开头）
  if (incoming === getEditorPlainText()) return

  formula.value = incoming
  nextTick(() => {
    setEditorPlainText(incoming)
    ensureHistoryInitialized()
    const sel = getSelectionCharOffsets()
    pushHistorySnapshot(formula.value || '', sel.start, sel.end)
  })
})

// Lifecycle
onMounted(() => {
  updatePreview()
  nextTick(() => {
    setEditorPlainText(formula.value || '')
    ensureHistoryInitialized()
    updateCursorPosition()
    syncEditorScroll()
  })

  const onSelectionChange = () => {
    updateCursorPosition()
  }
  document.addEventListener('selectionchange', onSelectionChange)
  onUnmounted(() => {
    document.removeEventListener('selectionchange', onSelectionChange)
  })
})
</script>

<style scoped>
.hsm-editor {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.08);
  overflow: hidden;
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
}

.hsm-core-col {
  padding: 24px;
  min-width: 0;
  overflow: hidden;
}

.hsm-core-col + .hsm-core-col {
  border-top: 1px solid #f1f5f9;
}

.hsm-core-col--preview {
  background: rgba(248, 250, 252, 0.5);
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
  background: rgba(147, 51, 234, 0.6);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.3);
  transition: all 0.2s ease;
  pointer-events: auto;
  backdrop-filter: blur(4px);
}

.float-trigger-btn:hover {
  background: rgba(147, 51, 234, 0.8);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);
}

.float-trigger-btn.active {
  background: rgba(126, 34, 206, 0.9);
  transform: rotate(45deg);
}

.latex-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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
