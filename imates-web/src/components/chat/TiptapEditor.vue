<template>
  <div class="tiptap-editor-container">
    <!-- 调试按钮区域 -->
    <div class="debug-controls" v-if="showDebugControls">
      <button @click="debugShowKeyboard" class="debug-btn">显示键盘</button>
      <button @click="debugHideKeyboard" class="debug-btn">隐藏键盘</button>
      <button @click="debugCreateFormula" class="debug-btn">创建公式</button>
      <button @click="debugClearAll" class="debug-btn">清理所有</button>
      <button @click="toggleDebugMode" class="debug-btn debug-toggle">关闭调试</button>
    </div>

    <!-- 编辑器主体 -->
    <div class="editor-wrapper">
      <editor-content
        :editor="editor as any"
        class="editor-content"
        @click="handleEditorClick"
        @keydown="handleKeydown"
      />

      <!-- 占位符 -->
      <div v-if="shouldShowPlaceholder" class="editor-placeholder" @click="focusEditor">
        {{ placeholder }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted, onUnmounted, watch, computed, type Component } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

// 注意：底层管理器已删除，相关功能已移除

// 导入类型定义
import type { TiptapEditorProps } from '../../types'

// 定义Props
interface Props extends TiptapEditorProps {
  modelValue?: string
  placeholder?: string
  editable?: boolean
  showDebugControls?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请输入内容...',
  editable: true,
  showDebugControls: false
})

// 定义Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 注意：FormulaNode已删除，相关功能已移除

// 编辑器实例
const editor = ref<Editor | null>(null)

// 调试模式状态
const showDebugControls = ref(props.showDebugControls)

// 插入公式状态标记，用于防止触发原生键盘
const isInsertingFormula = ref(false)

// 初始化编辑器
const initializeEditor = () => {
  editor.value = new Editor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: props.placeholder,
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      // 注意：FormulaNode已删除
    ],
    content: props.modelValue,
    editable: props.editable,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      emit('update:modelValue', content)
    },
  })

}

// 计算属性
const shouldShowPlaceholder = computed(() => {
  return editor.value?.isEmpty && !editor.value?.isFocused
})

// 事件处理函数
const handleEditorClick = (event: MouseEvent) => {
  
  const target = event.target as HTMLElement
  const formulaContainer = target.closest('.formula-node-container')
  
  if (formulaContainer) {
    // 如果事件仍然冒泡到这里，说明阻止机制可能有问题
    event.preventDefault()
    event.stopPropagation()
  } else {
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  // 处理特殊按键
  if (event.key === 'Enter' && !event.shiftKey) {
    // 可以在这里处理发送消息的逻辑
  }
}

const focusEditor = () => {
  // 如果正在插入公式，跳过编辑器聚焦，避免触发原生键盘
  if (isInsertingFormula.value) {
    return
  }
  
  editor.value?.commands.focus()
}

// 调试函数 - 已删除相关功能
const debugShowKeyboard = () => {
  console.log('调试功能已删除')
}

const debugHideKeyboard = () => {
  console.log('调试功能已删除')
}

const debugCreateFormula = async () => {
  console.log('调试功能已删除')
}

const debugClearAll = () => {
  // 清空编辑器内容
  editor.value?.commands.clearContent()
  console.log('调试功能已删除')
}

const toggleDebugMode = () => {
  showDebugControls.value = !showDebugControls.value
}

// 将编辑器内容转换为Markdown字符串的方法
const getMarkdown = (): string => {
  if (!editor.value) {
    return ''
  }
  
  return editor.value.getText({
    blockSeparator: '\n',
    textSerializers: {
      formula: ({ node }) => `$${node.attrs.formula}$`,
    },
  })
}

// 插入数学公式方法 - 已删除相关功能
const insertMathFormula = async () => {
  console.log('数学公式功能已删除')
}

// 暴露方法给父组件
defineExpose({
  getMarkdown,
  focus: focusEditor,
  clear: () => editor.value?.commands.clearContent(),
  insertContent: (content: string) => editor.value?.commands.insertContent(content),
  setContent: (content: string) => editor.value?.commands.setContent(content),
  getHTML: () => editor.value?.getHTML() || '',
  getText: () => editor.value?.getText() || '',
  insertMathFormula,
  // 调试相关方法 - 已删除
  hideAllVirtualKeyboards: () => {
    console.log('调试功能已删除')
  },
  deactivateAllFormulas: () => {
    console.log('调试功能已删除')
  },
  // 获取编辑器实例（用于调试）
  editor: computed(() => editor.value)
})

// 监听modelValue变化
watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue)
  }
})

// 移除公式事件监听器（FormulaEventManager已删除）

// 生命周期钩子
onMounted(() => {
  initializeEditor()
})

onUnmounted(() => {
  
  if (editor.value) {
    editor.value.destroy()
  }
  
  // 注意：resetAll已删除
  
})

// 显式定义组件类型以避免TypeScript编译错误
defineOptions({
  name: 'TiptapEditor'
})
</script>

<style scoped>
.tiptap-editor-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.debug-controls {
  position: absolute;
  top: -40px;
  left: 0;
  right: 0;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  z-index: 1000;
}

.debug-btn {
  padding: 4px 8px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.debug-btn:hover {
  background: #0056b3;
}

.debug-toggle {
  background: #dc3545;
}

.debug-toggle:hover {
  background: #c82333;
}

.editor-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.editor-content {
  width: 100%;
  height: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
  font-size: 14px;
  line-height: 1.5;
  overflow-y: auto;
}

.editor-content:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.editor-placeholder {
  position: absolute;
  top: 12px;
  left: 12px;
  color: #999;
  pointer-events: none;
  font-size: 14px;
  line-height: 1.5;
}

/* FormulaNode 样式 */
:deep(.formula-node-container) {
  display: inline-block;
  position: relative;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  transition: all 0.2s ease;
  cursor: pointer;
  vertical-align: baseline;
}

/* 注意：容器的激活/非激活状态样式已移除，现在完全依靠内部元素（.formula-text-display 和 math-field）来体现状态和间距 */


/* 纯文本显示样式 */
:deep(.formula-text-display) {
  display: inline-block;
  padding: 2px 6px;
  margin: 0 2px;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  background: #f8f9fa;
  color: #333;
  cursor: pointer;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.2;
  min-width: 20px;
  min-height: 20px;
  transition: all 0.2s ease;
  user-select: none;
}

:deep(.formula-text-display:hover) {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

:deep(math-field) {
  display: inline-block;
  min-width: 20px;
  min-height: 20px;
  margin: 0 2px;
  padding: 2px 6px;
  border: 1px solid #007bff;
  border-radius: 3px;
  outline: none;
  background: rgba(0, 123, 255, 0.1);
  font-size: 16px;
  line-height: 1.2;
  box-shadow: 0 0 0 1px rgba(0, 123, 255, 0.3);
  transition: all 0.2s ease;
}

:deep(math-field:focus) {
  outline: none;
}

/* 编辑器链接样式 */
:deep(.editor-link) {
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
}

:deep(.editor-link:hover) {
  color: #0056b3;
}

/* 编辑器图片样式 */
:deep(.editor-image) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 4px 0;
}
</style>
