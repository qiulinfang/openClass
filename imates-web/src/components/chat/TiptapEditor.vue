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

// 导入新的公式服务
import { FormulaService } from '../../services/FormulaService'
import { FORMULA_EVENTS } from '../../utils/math/FormulaEventManager'

// 定义Props
interface Props {
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
  'formula-created': [nodeId: string]
  'formula-activated': [nodeId: string]
  'formula-deactivated': [nodeId: string]
  'formula-content-changed': [nodeId: string, content: string]
  'formula-deleted': [nodeId: string]
}>()

// 初始化公式服务
const formulaService = FormulaService.getInstance()

// 使用新的FormulaNode
const FormulaNode = formulaService.createFormulaNode() as any

// 编辑器实例
const editor = ref<Editor | null>(null)

// 调试模式状态
const showDebugControls = ref(props.showDebugControls)

// 初始化编辑器
const initializeEditor = () => {
  console.log('🔧 [TIPTAP-EDITOR] 初始化编辑器')
  
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
      FormulaNode,
    ],
    content: props.modelValue,
    editable: props.editable,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      console.log('📝 [TIPTAP-EDITOR] 编辑器内容更新', { content })
      emit('update:modelValue', content)
    },
    onSelectionUpdate: () => {
      console.log('🎯 [TIPTAP-EDITOR] 选择更新')
    },
    onFocus: () => {
      console.log('🎯 [TIPTAP-EDITOR] 编辑器获得焦点')
    },
    onBlur: () => {
      console.log('🎯 [TIPTAP-EDITOR] 编辑器失去焦点')
    },
  })

  console.log('✅ [TIPTAP-EDITOR] 编辑器初始化完成')
}

// 计算属性
const shouldShowPlaceholder = computed(() => {
  return editor.value?.isEmpty && !editor.value?.isFocused
})

// 事件处理函数
const handleEditorClick = (event: MouseEvent) => {
  console.log('🖱️ [TIPTAP-EDITOR] 编辑器点击事件')
  
  const target = event.target as HTMLElement
  if (target.closest('.formula-node-container')) {
    console.log('🧮 [TIPTAP-EDITOR] 点击在公式节点上')
    event.preventDefault()
    event.stopPropagation()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  console.log('⌨️ [TIPTAP-EDITOR] 键盘事件', { key: event.key })
  
  // 处理特殊按键
  if (event.key === 'Enter' && !event.shiftKey) {
    console.log('📤 [TIPTAP-EDITOR] 回车键')
    // 可以在这里处理发送消息的逻辑
  }
}

const focusEditor = () => {
  console.log('🎯 [TIPTAP-EDITOR] 聚焦编辑器')
  editor.value?.commands.focus()
}

// 调试函数
const debugShowKeyboard = () => {
  console.log('🔧 [DEBUG] 显示虚拟键盘')
  const activeNode = formulaService.getActiveFormulaNode()
  if (activeNode?.mathField && typeof (activeNode.mathField as any).executeCommand === 'function') {
    (activeNode.mathField as any).executeCommand('showVirtualKeyboard')
  }
}

const debugHideKeyboard = () => {
  console.log('🔧 [DEBUG] 隐藏虚拟键盘')
  const activeNode = formulaService.getActiveFormulaNode()
  if (activeNode?.mathField && typeof (activeNode.mathField as any).executeCommand === 'function') {
    (activeNode.mathField as any).executeCommand('hideVirtualKeyboard')
  }
}

const debugCreateFormula = async () => {
  console.log('🔧 [DEBUG] 手动创建公式')
  
  if (!editor.value) {
    console.error('❌ [DEBUG] 编辑器未初始化')
    return
  }

  try {
    // 获取当前光标位置
    const { from } = editor.value.state.selection
    console.log('🔧 [DEBUG] 当前光标位置', { from })
    
    // 使用公式服务创建公式
    const nodeId = await formulaService.createFormula(from)
    
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
      
      console.log('✅ [DEBUG] 公式创建完成', { nodeId })
    } else {
      console.error('❌ [DEBUG] 公式创建失败')
    }
  } catch (error) {
    console.error('❌ [DEBUG] 公式创建异常', error)
  }
}

const debugClearAll = () => {
  console.log('🔧 [DEBUG] 清理所有公式')
  
  // 失活所有公式
  const allNodes = formulaService.getAllFormulaNodes()
  allNodes.forEach(node => {
    if (node.isActive) {
      formulaService.deactivateFormula(node.id)
    }
  })
  
  // 清空编辑器内容
  editor.value?.commands.clearContent()
  
  console.log('✅ [DEBUG] 清理完成')
}

const toggleDebugMode = () => {
  showDebugControls.value = !showDebugControls.value
  console.log('🔧 [DEBUG] 调试模式切换', { showDebugControls: showDebugControls.value })
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
    console.error('❌ [TIPTAP-EDITOR] 编辑器未初始化')
    return
  }
  
  try {
    // 获取当前光标位置
    const { from } = editor.value.state.selection
    console.log('🔢 [TIPTAP-EDITOR] 在位置', from, '插入数学公式')
    
    // 使用公式服务创建公式
    const formulaId = await formulaService.createFormula(from)
    if (formulaId) {
      // 插入公式节点到编辑器，传递nodeId
      editor.value
        .chain()
        .focus()
        .insertContent({
          type: 'formula',
          attrs: {
            formula: '',
            isNew: true,
            nodeId: formulaId,
          },
        })
        .run()
      
      console.log('✅ [TIPTAP-EDITOR] 数学公式创建成功:', formulaId)
    } else {
      console.warn('⚠️ [TIPTAP-EDITOR] 数学公式创建失败')
    }
  } catch (error) {
    console.error('❌ [TIPTAP-EDITOR] 插入数学公式失败:', error)
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
})

// 监听modelValue变化
watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    console.log('👀 [TIPTAP-EDITOR] 监听modelValue变化', { newValue })
    editor.value.commands.setContent(newValue)
  }
})

// 设置公式服务事件监听器
const setupFormulaEventListeners = () => {
  console.log('🎧 [TIPTAP-EDITOR] 设置公式服务事件监听器')
  
  // 监听公式激活事件
  formulaService.on(FORMULA_EVENTS.ACTIVATED, (data: any) => {
    console.log('🧮 [TIPTAP-EDITOR] 公式激活事件', data)
    emit('formula-activated', data.nodeId)
  })
  
  // 监听公式失活事件
  formulaService.on(FORMULA_EVENTS.DEACTIVATED, (data: any) => {
    console.log('🧮 [TIPTAP-EDITOR] 公式失活事件', data)
    emit('formula-deactivated', data.nodeId)
  })
  
  // 监听公式内容变化事件
  formulaService.on(FORMULA_EVENTS.CONTENT_CHANGED, (data: any) => {
    console.log('🧮 [TIPTAP-EDITOR] 公式内容变化事件', data)
    emit('formula-content-changed', data.nodeId, data.content)
  })
  
  // 监听公式删除事件
  formulaService.on(FORMULA_EVENTS.DELETED, (data: any) => {
    console.log('🧮 [TIPTAP-EDITOR] 公式删除事件', data)
    emit('formula-deleted', data.nodeId)
  })
}

// 生命周期钩子
onMounted(() => {
  console.log('🔧 [TIPTAP-EDITOR] 组件挂载')
  
  initializeEditor()
  setupFormulaEventListeners()
  
  console.log('✅ [TIPTAP-EDITOR] 组件挂载完成')
})

onUnmounted(() => {
  console.log('🔧 [TIPTAP-EDITOR] 组件卸载')
  
  if (editor.value) {
    editor.value.destroy()
  }
  
  // 重置公式服务状态
  formulaService.reset()
  
  console.log('✅ [TIPTAP-EDITOR] 组件卸载完成')
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
  margin: 0 2px;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  transition: all 0.2s ease;
  cursor: pointer;
  vertical-align: baseline;
}

:deep(.formula-node-container.formula-active) {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(0, 123, 255, 0.3);
}

:deep(.formula-node-container.formula-inactive) {
  border-color: #e0e0e0;
  background: #f8f9fa;
}

:deep(.formula-node-container:hover) {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

:deep(math-field) {
  display: inline-block;
  min-width: 20px;
  min-height: 20px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  line-height: 1.2;
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
