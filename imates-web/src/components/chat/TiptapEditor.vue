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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

// 直接使用底层管理器
import { 
  focusManager, 
  nodeBuilder,
  createFormula,
  getAllFormulaNodes,
  getActiveFormulaNode,
  resetAll
} from '../../utils/math'

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

// 使用新的FormulaNode
const FormulaNode = nodeBuilder.createFormulaNode()

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
      FormulaNode as any,
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

// 调试函数
const debugShowKeyboard = () => {
  const activeNode = getActiveFormulaNode()
  if (activeNode?.mathField && typeof (activeNode.mathField as unknown as { executeCommand: (cmd: string) => void }).executeCommand === 'function') {
    (activeNode.mathField as unknown as { executeCommand: (cmd: string) => void }).executeCommand('showVirtualKeyboard')
  }
}

const debugHideKeyboard = () => {
  const activeNode = getActiveFormulaNode()
  if (activeNode?.mathField && typeof (activeNode.mathField as unknown as { executeCommand: (cmd: string) => void }).executeCommand === 'function') {
    (activeNode.mathField as unknown as { executeCommand: (cmd: string) => void }).executeCommand('hideVirtualKeyboard')
  }
}

const debugCreateFormula = async () => {
  
  if (!editor.value) {
    return
  }

  try {
    // 获取当前光标位置
    const { from } = editor.value.state.selection
    
    // 使用公式管理器创建公式
    const nodeId = await createFormula(from)
    
    if (nodeId) {
      // 插入公式节点到编辑器
      editor.value
        .chain()
        .insertContent({
          type: 'formula',
          attrs: {
            formula: '',
            isNew: true,
          },
        })
        .run()
      
    }
  } catch {
    // 忽略错误，静默处理
  }
}

const debugClearAll = () => {
  // 失活所有公式
  const allNodes = getAllFormulaNodes()
  allNodes.forEach(node => {
    if (node.isActive && node.mathField) {
      focusManager.deactivateFormula(node.id, node.mathField)
    }
  })
  
  // 清空编辑器内容
  editor.value?.commands.clearContent()
  
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

// 插入数学公式方法
const insertMathFormula = async () => {
  if (!editor.value) {
    console.warn('🎯 [TIPTAP_EDITOR] 编辑器未初始化')
    return
  }
  
  try {
    console.log('🎯 [TIPTAP_EDITOR] 开始创建数学公式节点')
    // 设置插入公式状态标记，防止触发原生键盘
    isInsertingFormula.value = true
    
    // 获取当前光标位置
    const { from } = editor.value.state.selection
    console.log('🎯 [TIPTAP_EDITOR] 光标位置:', from)
    
    // 使用公式管理器创建公式
    const formulaId = await createFormula(from)
    console.log('🎯 [TIPTAP_EDITOR] 公式节点ID:', formulaId)
    
    if (formulaId) {
      // 插入公式节点到编辑器，不调用 focus() 避免触发原生键盘
      editor.value
        .chain()
        .insertContent({
          type: 'formula',
          attrs: {
            formula: '',
            isNew: true,
            nodeId: formulaId,
          },
        })
        .run()
      
      console.log('🎯 [TIPTAP_EDITOR] 公式节点已插入到编辑器')
    } else {
      console.warn('🎯 [TIPTAP_EDITOR] 公式节点创建失败')
      isInsertingFormula.value = false
    }
  } catch (error) {
    console.error('❌ [TIPTAP_EDITOR] 插入数学公式失败:', error)
    isInsertingFormula.value = false
  }
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
  // 调试相关方法
  hideAllVirtualKeyboards: () => {
    console.log('🔧 [TIPTAP-EDITOR] 隐藏所有虚拟键盘')
    const allNodes = getAllFormulaNodes()
    allNodes.forEach(node => {
      if (node.mathField && typeof (node.mathField as unknown as { executeCommand: (cmd: string) => void }).executeCommand === 'function') {
        (node.mathField as unknown as { executeCommand: (cmd: string) => void }).executeCommand('hideVirtualKeyboard')
      }
    })
  },
  deactivateAllFormulas: () => {
    const allNodes = getAllFormulaNodes()
    allNodes.forEach(node => {
      if (node.isActive && node.mathField) {
        focusManager.deactivateFormula(node.id, node.mathField)
      }
    })
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
  
  // 重置所有状态
  resetAll()
  
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
