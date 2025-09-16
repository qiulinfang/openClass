<template>
  <div class="tiptap-editor-container">
    <!-- 编辑器主体 -->
    <div class="editor-wrapper">
      <editor-content 
        :editor="editor as any" 
        class="editor-content"
        @click="handleEditorClick"
        @keydown="handleKeydown"
      />
      
      <!-- 占位符 -->
      <div 
        v-if="shouldShowPlaceholder"
        class="editor-placeholder"
        @click="focusEditor"
      >
        {{ placeholder }}
      </div>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed, type Ref } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Node, mergeAttributes } from '@tiptap/core'

// 动态导入MathLive
let MathfieldElement: any = null // eslint-disable-line @typescript-eslint/no-explicit-any

// 自定义数学公式节点 - 双模态版本
const FormulaNode = Node.create({
  name: 'formula',
  
  group: 'inline',
  
  inline: true,
  
  atom: true,
  
  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: element => element.getAttribute('data-formula'),
        renderHTML: attributes => {
          if (!attributes.formula) {
            return {}
          }
          return {
            'data-formula': attributes.formula,
          }
        },
      },
      isNew: {
        default: false,
        parseHTML: element => element.getAttribute('data-new') === 'true',
        renderHTML: attributes => {
          if (!attributes.isNew) {
            return {}
          }
          return {
            'data-new': 'true',
          }
        },
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-formula]',
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'formula-node',
      }),
    ]
  },
  
  addNodeView() {
    return ({ node, getPos, editor }) => {
      // ==================== 第一阶段：容器初始化 ====================
      console.log('🧮 [FORMULA-INIT] 开始初始化公式节点')
      
      // 1.1 创建公式节点容器
      const container = document.createElement('span')
      const { isNew } = node.attrs
      console.log('🧮 [FORMULA-INIT] 创建公式容器元素')
      
      // 1.2 生成唯一节点ID，用于后续聚焦管理
      const nodeId = `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      container.setAttribute('data-node-id', nodeId)
      console.log('🧮 [FORMULA-INIT] 生成节点ID:', nodeId)
      
      // 1.3 初始化失活延迟定时器（使用对象包装以便在函数间传递引用）
      const blurTimeout = { current: null as ReturnType<typeof setTimeout> | null };
      console.log('🧮 [FORMULA-INIT] 初始化失活延迟定时器')
      
      // 1.4 根据 isNew 属性确定初始激活状态
      const isInitiallyActive = isNew;
      container.className = isInitiallyActive 
        ? 'formula-node-container formula-active' 
        : 'formula-node-container formula-inactive';
      console.log('🧮 [FORMULA-INIT] 设置初始激活状态:', isInitiallyActive ? '激活' : '失活')

      // 1.5 声明 MathLive 实例变量
      let mathField: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
      console.log('🧮 [FORMULA-INIT] 第一阶段初始化完成')

      // ==================== 第二阶段：MathLive 初始化 ====================
      const initMathField = async () => {
        console.log('🧮 [FORMULA-MATHLIVE] 开始初始化 MathLive 实例')
        
        // 2.1 动态导入 MathLive 库
        if (!MathfieldElement) {
          console.log('🧮 [FORMULA-MATHLIVE] 动态导入 MathLive 库')
          const mathlive = await import('mathlive')
          MathfieldElement = mathlive.MathfieldElement
          console.log('🧮 [FORMULA-MATHLIVE] MathLive 库导入完成')
        } else {
          console.log('🧮 [FORMULA-MATHLIVE] MathLive 库已存在，跳过导入')
        }
        
        // 2.2 创建 MathLive 实例并设置初始值
        console.log('🧮 [FORMULA-MATHLIVE] 创建 MathLive 实例')
        mathField = new MathfieldElement()
        mathField.setValue(node.attrs.formula)
        console.log('🧮 [FORMULA-MATHLIVE] 设置初始公式值:', node.attrs.formula || '(空)')
        
        // 2.3 配置 MathLive 选项
        console.log('🧮 [FORMULA-MATHLIVE] 配置 MathLive 选项')
        configureMathFieldOptions(mathField, isInitiallyActive)

        // 2.4 设置事件监听器
        console.log('🧮 [FORMULA-MATHLIVE] 设置事件监听器')
        setupMathFieldEventListeners(mathField)

        // 2.5 将 MathField 添加到容器
        console.log('🧮 [FORMULA-MATHLIVE] 将 MathField 添加到容器')
        container.appendChild(mathField)
        
        // 2.6 如果是新插入的公式，执行初始聚焦流程
        if (isInitiallyActive) {
          console.log('🧮 [FORMULA-MATHLIVE] 执行初始聚焦流程')
          await handleInitialFocus(mathField, getPos, editor)
        } else {
          console.log('🧮 [FORMULA-MATHLIVE] 跳过初始聚焦（非新插入公式）')
        }
        
        console.log('🧮 [FORMULA-MATHLIVE] MathLive 初始化完成')

        // 监听内容变化
        console.log('🧮 [FORMULA-MATHLIVE] 设置内容变化监听器')
        mathField.addEventListener('input', () => {
          const newFormula = mathField.getValue()
          console.log('🧮 [FORMULA-EDIT] 公式内容变化:', newFormula || '(空)')
          
          if (typeof getPos === 'function' && getPos !== undefined) {
            const pos = getPos()
            if (pos !== undefined) {
              console.log('🧮 [FORMULA-EDIT] 更新节点内容，位置:', pos)
              const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, {
                formula: newFormula,
              })
              editor.view.dispatch(transaction)
              console.log('🧮 [FORMULA-EDIT] 节点内容更新完成')
            }
          }
        });

        // 2.8 设置激活/失活控制函数
        const { activate, deactivate } = createActivationControls(
          mathField, 
          container, 
          getPos, 
          editor, 
          blurTimeout
        )

        // 2.9 设置用户交互事件监听器
        setupUserInteractionListeners(container, mathField, activate, deactivate, blurTimeout)
      }

      // 异步初始化 MathField
      nextTick(initMathField)
      
      // ==================== 第三阶段：返回 NodeView 接口 ====================
      console.log('🧮 [FORMULA-NODEVIEW] 返回 NodeView 接口')
      
      return {
        dom: container,
        update: (updatedNode) => {
          console.log('🧮 [FORMULA-UPDATE] 节点更新触发')
          
          // 3.1 检查节点类型是否匹配
          if (updatedNode.type.name !== 'formula') {
            console.log('🧮 [FORMULA-UPDATE] 节点类型不匹配，跳过更新')
            return false
          }
          
          // 3.2 更新公式内容（如果内容有变化）
          const newFormula = updatedNode.attrs.formula
          const currentFormula = mathField ? mathField.getValue() : ''
          
          if (mathField && currentFormula !== newFormula) {
            console.log('🧮 [FORMULA-UPDATE] 公式内容有变化，更新 MathField')
            console.log('🧮 [FORMULA-UPDATE] 旧内容:', currentFormula || '(空)')
            console.log('🧮 [FORMULA-UPDATE] 新内容:', newFormula || '(空)')
            mathField.setValue(newFormula)
            console.log('🧮 [FORMULA-UPDATE] MathField 内容更新完成')
          } else {
            console.log('🧮 [FORMULA-UPDATE] 公式内容无变化，跳过更新')
          }
          
          console.log('🧮 [FORMULA-UPDATE] 节点更新完成')
          return true
        },
        // 3.3 阻止 Tiptap 处理此节点上的选区事件
        stopEvent: () => {
          console.log('🧮 [FORMULA-EVENT] 阻止 Tiptap 处理节点事件')
          return true
        },
      }
    }
  },
})

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  maxHeight?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'focus'): void
  (e: 'blur'): void
  (e: 'keydown', event: KeyboardEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '输入消息...',
  disabled: false,
  maxHeight: '200px'
}) as Props

const emit = defineEmits<Emits>()

// 编辑器实例
const editor = ref<Editor | undefined>(undefined)

// 计算是否应该显示占位符
const shouldShowPlaceholder = computed(() => {
  if (!editor.value) return true
  
  // 检查是否有文本内容
  const hasText = editor.value.getText().trim().length > 0
  if (hasText) return false
  
  // 检查是否有公式节点或其他内容
  let hasContent = false
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === 'formula' || 
        (node.type.name === 'paragraph' && node.content.size > 0) ||
        (node.type.name !== 'doc' && node.type.name !== 'paragraph')) {
      hasContent = true
      return false // 停止遍历
    }
  })
  
  return !hasContent
})

// ==================== 提炼的小函数：MathLive 相关工具函数 ====================

/**
 * 配置 MathLive 字段选项
 * @param mathField MathLive 实例
 * @param isInitiallyActive 是否初始激活状态
 */
const configureMathFieldOptions = (mathField: any, isInitiallyActive: boolean) => {
        mathField.setOptions({
          mathVirtualKeyboardPolicy: 'manual', // 手动控制虚拟键盘
          virtualKeyboardMode: 'manual', // 确保手动模式
          defaultMode: 'math',
          fontSize: 16,
          placeholder: '输入内容...',
          smartMode: true,
          smartSuperscript: true,
          theme: 'light',
          toolbar: 'none',
          autoComplete: 'off',
          selectionMode: 'none',
          contextMenu: 'none',
          dragMode: 'none',
          readOnly: !isInitiallyActive,
          border: 'none',
          backgroundColor: 'transparent',
          decorations: false,
          // 防止原生键盘弹出
          inputMode: 'none', // 禁用原生输入模式
          // 添加更多防止原生键盘的设置
          virtualKeyboardPolicy: 'manual',
          // 简化样式配置
          style: {
            '--math-field-background-color': 'transparent',
            '--math-field-border': 'none',
            '--math-field-padding': '0',
            '--math-field-margin': '0'
          }
        })
        
        // 额外设置属性防止原生键盘
        try {
          mathField.setAttribute('inputmode', 'none')
          mathField.setAttribute('readonly', 'false')
          mathField.setAttribute('tabindex', '0')
        } catch (e) {
          console.warn('⚠️ [MathLive配置] 设置额外属性失败:', e)
        }
}

/**
 * 设置 MathLive 事件监听器
 * @param mathField MathLive 实例
 */
const setupMathFieldEventListeners = (mathField: any) => {
  console.log('🧮 [FORMULA-EVENTS] 开始设置 MathLive 事件监听器')
  
  // 监听虚拟键盘切换事件
        mathField.addEventListener('virtual-keyboard-toggle', (event: Event) => {
          const customEvent = event as CustomEvent
          const { visible, height } = customEvent.detail || {}
    console.log('🧮 [FORMULA-KEYBOARD] 虚拟键盘切换事件', { visible, height })
          
          // 触发自定义事件通知ChatView
          const keyboardEvent = new CustomEvent('custom-keyboard-toggle', {
            detail: { visible, height: height || 300 }
          })
          window.dispatchEvent(keyboardEvent)
          
          // 如果键盘显示，延迟滚动以确保键盘完全显示后再滚动
          if (visible) {
            setTimeout(() => {
              // 触发滚动事件，让ChatView滚动到底部
              const scrollEvent = new CustomEvent('formula-keyboard-shown', {
                detail: { height: height || 300 }
              })
              window.dispatchEvent(scrollEvent)
            }, 100) // 给键盘显示一些时间
          }
        })

  // 监听焦点事件
        mathField.addEventListener('focus', () => {
    console.log('🧮 [FORMULA-FOCUS] MathLive 获得焦点')
        })

  // 监听失焦事件
        mathField.addEventListener('blur', () => {
    console.log('🧮 [FORMULA-BLUR] MathLive 失去焦点')
          // 当MathLive失去焦点时，也触发键盘隐藏事件
          const keyboardEvent = new CustomEvent('custom-keyboard-toggle', {
            detail: { visible: false, height: 0 }
          })
          window.dispatchEvent(keyboardEvent)
    console.log('🧮 [FORMULA-BLUR] 触发键盘隐藏事件')
  })
}

/**
 * 处理初始聚焦流程（新插入公式时）
 * @param mathField MathLive 实例
 * @param getPos 获取节点位置的函数
 * @param editor Tiptap 编辑器实例
 */
const handleInitialFocus = async (mathField: any, getPos: () => number | undefined, editor: any) => {
  console.log('🧮 [FORMULA-FOCUS-INIT] 开始初始聚焦流程')
  
          nextTick(async () => {
            try {
              // 1. 立即显示MathLive虚拟键盘（在聚焦前）
      console.log('🧮 [FORMULA-FOCUS-INIT] 立即显示 MathLive 虚拟键盘')
              mathField.executeCommand('showVirtualKeyboard');
              
              // 2. 聚焦公式编辑器
      console.log('🧮 [FORMULA-FOCUS-INIT] 聚焦公式编辑器')
              mathField.focus();
              mathField.executeCommand('scrollIntoView');
              
              // 3. 确保虚拟键盘保持显示
      console.log('🧮 [FORMULA-FOCUS-INIT] 确保虚拟键盘保持显示')
              setTimeout(() => {
                mathField.executeCommand('showVirtualKeyboard');
              }, 50);
              
      // 4. 聚焦后清除 isNew 标记
              if (typeof getPos === 'function' && getPos() !== undefined) {
                const pos = getPos();
                if (pos !== undefined) {
          console.log('🧮 [FORMULA-FOCUS-INIT] 移除 isNew 标记，位置:', pos)
                  const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, { isNew: false });
                  editor.view.dispatch(transaction);
          console.log('🧮 [FORMULA-FOCUS-INIT] isNew 标记移除完成')
        }
      }
      
      console.log('🧮 [FORMULA-FOCUS-INIT] 初始聚焦流程完成')
    } catch (e) { 
      console.error('🧮 [FORMULA-FOCUS-INIT] 初始聚焦失败:', e) 
    }
  })
}

/**
 * 设置内容变化监听器
 * @param mathField MathLive 实例
 * @param getPos 获取节点位置的函数
 * @param editor Tiptap 编辑器实例
 */
const setupContentChangeListener = (mathField: any, getPos: () => number | undefined, editor: any) => {
        mathField.addEventListener('input', () => {
    if (typeof getPos === 'function' && getPos() !== undefined) {
            const pos = getPos()
            if (pos !== undefined) {
              const newFormula = mathField.getValue()
              const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, {
                formula: newFormula,
              })
              editor.view.dispatch(transaction)
            }
          }
        });
}

/**
 * 创建激活/失活控制函数
 * @param mathField MathLive 实例
 * @param container 容器元素
 * @param getPos 获取节点位置的函数
 * @param editor Tiptap 编辑器实例
 * @param blurTimeout 失活延迟定时器引用
 * @returns 激活和失活函数
 */
const createActivationControls = (
  mathField: any, 
  container: HTMLElement, 
  getPos: () => number | undefined, 
  editor: any,
  blurTimeout: { current: ReturnType<typeof setTimeout> | null }
) => {
  // 激活函数
        const activate = () => {
    console.log('🧮 [FORMULA-ACTIVATE] 激活公式节点')
    
    // 在激活时，清除任何待处理的失活任务
    if (blurTimeout.current) {
      console.log('🧮 [FORMULA-ACTIVATE] 清除待处理的失活任务')
      clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
    
    // 清除全局定时器管理器中的定时器
    const nodeId = container.getAttribute('data-node-id')
    if (nodeId) {
      globalTimeoutManager.clearTimeout(nodeId)
    }
    
          if (mathField.readOnly) {
      console.log('🧮 [FORMULA-ACTIVATE] 设置公式为可编辑状态')
            mathField.setOptions({ readOnly: false });
            container.classList.remove('formula-inactive');
            container.classList.add('formula-active');
      
            // 确保Tiptap的光标不会干扰
            const pos = getPos();
            if (pos !== undefined) {
        console.log('🧮 [FORMULA-ACTIVATE] 设置节点选择，位置:', pos)
              editor.commands.setNodeSelection(pos);
            }
      
      console.log('🧮 [FORMULA-ACTIVATE] 公式节点激活完成')
    } else {
      console.log('🧮 [FORMULA-ACTIVATE] 公式节点已经是激活状态')
          }
        }
        
  // 失活函数
        const deactivate = () => {
          if (mathField && !mathField.readOnly) {
      console.log('🧮 [FORMULA-DEACTIVATE] 失活公式节点')
              mathField.setOptions({ readOnly: true });
              container.classList.remove('formula-active');
              container.classList.add('formula-inactive');
      console.log('🧮 [FORMULA-DEACTIVATE] 公式节点失活完成')
    }
    // 移除重复的日志，只在真正需要失活时输出
  }

  return { activate, deactivate }
}

/**
 * 设置用户交互事件监听器
 * @param container 容器元素
 * @param mathField MathLive 实例
 * @param activate 激活函数
 * @param deactivate 失活函数
 * @param blurTimeout 失活延迟定时器引用
 */
const setupUserInteractionListeners = (
  container: HTMLElement, 
  mathField: any, 
  activate: () => void, 
  deactivate: () => void,
  blurTimeout: { current: ReturnType<typeof setTimeout> | null }
) => {
  // 使用 mousedown 替代 click，因为它触发更早
        container.addEventListener('mousedown', (event) => {
          // mousedown 事件发生时，就意味着用户想编辑，立即激活
          activate(); 
          event.stopPropagation();
        });
        
        mathField.addEventListener('focus', () => {
          // 在获得焦点时清除任何待处理的失活任务
          if (blurTimeout.current) {
            clearTimeout(blurTimeout.current);
            blurTimeout.current = null;
          }
          activate();
        });

        mathField.addEventListener('blur', () => {
    // 延迟失活，给 mousedown 事件留出反应时间
    const nodeId = container.getAttribute('data-node-id')
    if (nodeId) {
      blurTimeout.current = globalTimeoutManager.setTimeout(nodeId, deactivate, 150)
    } else {
      blurTimeout.current = setTimeout(deactivate, 150)
    }
  });
}

// 全局定时器管理器：用于管理所有公式节点的失活定时器
const globalTimeoutManager = {
  timeouts: new Map<string, ReturnType<typeof setTimeout>>(),
  
  // 设置定时器
  setTimeout(nodeId: string, callback: () => void, delay: number) {
    // 清除该节点之前的定时器
    this.clearTimeout(nodeId)
    
    const timeoutId = setTimeout(() => {
      callback()
      this.timeouts.delete(nodeId)
    }, delay)
    
    this.timeouts.set(nodeId, timeoutId)
    return timeoutId
  },
  
  // 清除特定节点的定时器
  clearTimeout(nodeId: string) {
    const timeoutId = this.timeouts.get(nodeId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.timeouts.delete(nodeId)
    }
  },
  
  // 清除所有定时器
  clearAllTimeouts() {
    this.timeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId)
    })
    this.timeouts.clear()
  }
}

// 聚焦管理器：确保新插入的公式能够正确聚焦
const focusManager = {
  pendingFocus: new Set<string>(),
  
  // 标记需要聚焦的公式
  markForFocus(nodeId: string) {
    this.pendingFocus.add(nodeId)
  },
  
  // 尝试聚焦所有待聚焦的公式
  tryFocusAll() {
    this.pendingFocus.forEach(nodeId => {
      const element = document.querySelector(`[data-node-id="${nodeId}"]`)
      if (element) {
        const mathField = element.querySelector('math-field') as any // eslint-disable-line @typescript-eslint/no-explicit-any
        if (mathField && typeof mathField.focus === 'function') {
          try {
            mathField.focus()
            if (typeof mathField.executeCommand === 'function') {
              mathField.executeCommand('scrollIntoView')
            }
            this.pendingFocus.delete(nodeId)
          } catch (error) {
            console.warn('Focus manager focus failed:', error)
          }
        }
      }
    })
  }
}

// 初始化编辑器
const initEditor = async () => {
  // 动态导入MathLive
  if (!MathfieldElement) {
    const mathlive = await import('mathlive')
    MathfieldElement = mathlive.MathfieldElement
  }

  editor.value = new Editor({
    extensions: [
      StarterKit.configure({
        // 禁用一些不需要的功能
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        hardBreak: false,
        code: false,
      }),
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
    editable: !props.disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      emit('update:modelValue', html)
    },
    onFocus: () => {
      emit('focus')
    },
    onBlur: () => {
      emit('blur')
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
  })
}

// 插入数学公式
const insertMathFormula = async () => {
  if (editor.value) {
    console.log('🧮 [FORMULA-CREATE] 开始创建公式流程')
    
    // 0. 先清理所有现有的公式状态，确保没有残留的焦点状态
    console.log('🧮 [FORMULA-CREATE] 清理现有公式状态')
    hideAllVirtualKeyboards()
    deactivateAllFormulas()
    
    // 等待一小段时间确保清理完成
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // 1. 临时阻止编辑器获得焦点
    console.log('🧮 [FORMULA-CREATE] 临时阻止编辑器焦点')
    const editorElement = editor.value.view.dom
    const originalTabIndex = editorElement.getAttribute('tabindex')
    editorElement.setAttribute('tabindex', '-1')
    
    // 2. 插入FormulaNode，标记为新插入（不立即聚焦编辑器）
    console.log('🧮 [FORMULA-CREATE] 插入空公式节点到编辑器')
    editor.value.chain().insertContent({
      type: 'formula',
      attrs: {
        formula: '', // 插入一个空公式
        isNew: true  // 标记为新插入
      },
    }).run()
    
    // 3. 延迟聚焦，让 MathLive 先获得焦点
    console.log('🧮 [FORMULA-CREATE] 设置延迟聚焦机制')
    nextTick(() => {
      setTimeout(() => {
        console.log('🧮 [FORMULA-CREATE] 执行聚焦管理器')
        focusManager.tryFocusAll()
        
        // 4. 恢复编辑器的 tabindex
        setTimeout(() => {
          console.log('🧮 [FORMULA-CREATE] 恢复编辑器 tabindex')
          if (originalTabIndex !== null) {
            editorElement.setAttribute('tabindex', originalTabIndex)
          } else {
            editorElement.removeAttribute('tabindex')
          }
        }, 200)
      }, 100) // 增加延迟时间，确保 MathLive 先获得焦点
    })
  }
}

// 新增：将编辑器内容转换为Markdown字符串的方法
const getMarkdown = (): string => {
  if (!editor.value) {
    return '';
  }
  // 使用 Tiptap 的 getText 方法，并为 formula 节点提供一个自定义的文本序列化器
  return editor.value.getText({
    blockSeparator: '\n', // 段落之间用换行符分隔
    textSerializers: {
      // 当遇到 formula 节点时，将其转换为 $$...$$ 的 LaTeX 格式
      formula: ({ node }) => `$${node.attrs.formula}$`,
    },
  });
};

// 暴露方法给父组件
defineExpose({
  insertMathFormula,
  getMarkdown, // 暴露 getMarkdown 方法
  editor, // 同时暴露 editor 实例，方便父组件调用 clearContent 等方法
} as {
  insertMathFormula: () => void
  getMarkdown: () => string
  editor: Ref<Editor | undefined>
})


// 编辑器点击处理
const handleEditorClick = () => {
  // 点击事件由FormulaNode内部处理
}

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  // 处理回车键发送消息
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('keydown', event)
  }
}

// 聚焦编辑器
const focusEditor = () => {
  editor.value?.commands.focus()
}

// 监听modelValue变化
watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue || '')
  }
})

// 监听disabled状态
watch(() => props.disabled, (disabled) => {
  if (editor.value) {
    editor.value.setEditable(!disabled)
  }
})

// 点击外部区域隐藏虚拟键盘的处理
const handleDocumentClick = (event: MouseEvent) => {
  // 检查点击的目标是否在公式节点内部或虚拟键盘内部
  const target = event.target as HTMLElement
  
  // 更精确的检测：包括虚拟键盘的所有可能元素
  const isClickInsideFormula = target.closest('.formula-node-container') || 
                               target.closest('math-field') ||
                               target.closest('.ML__virtual-keyboard') ||
                               target.closest('.ML__keyboard') ||
                               target.closest('.ML__keyboard-panel') ||
                               target.closest('.ML__keyboard-row') ||
                               target.closest('.ML__keyboard-key') ||
                               target.closest('[class*="ML__keyboard"]') ||
                               target.closest('[class*="virtual-keyboard"]')
  
  // 检查是否点击在虚拟键盘的遮罩层上（这通常表示用户想关闭键盘）
  const isClickOnKeyboardOverlay = target.classList.contains('ML__keyboard-overlay') ||
                                   target.classList.contains('ML__keyboard-backdrop')
  
  // 检查是否点击在输入框或其他交互元素上（这些不应该触发公式失活）
  const isClickOnInputElement = target.closest('input') ||
                               target.closest('textarea') ||
                               target.closest('.q-field') ||
                               target.closest('.search-input') ||
                               target.closest('[contenteditable="true"]') ||
                               target.closest('.q-input') ||
                               target.closest('.q-select') ||
                               target.closest('.q-btn') ||
                               target.closest('button')
  
  if (!isClickInsideFormula && !isClickOnKeyboardOverlay && !isClickOnInputElement) {
    console.log('🧮 [FORMULA-CLICK-OUTSIDE] 点击在公式外部，开始失活所有公式')
    
    // 点击在公式和虚拟键盘外部，隐藏所有MathLive虚拟键盘并失活所有公式
    hideAllVirtualKeyboards()
    deactivateAllFormulas()
    
    // 直接触发键盘隐藏事件通知ChatView
    const keyboardEvent = new CustomEvent('custom-keyboard-toggle', {
      detail: { visible: false, height: 0 }
    })
    window.dispatchEvent(keyboardEvent)
    console.log('🧮 [FORMULA-CLICK-OUTSIDE] 触发键盘隐藏事件')
  } else if (isClickOnInputElement) {
    console.log('🧮 [FORMULA-CLICK-OUTSIDE] 点击在输入元素上，跳过公式失活', target)
  }
  // 移除内部点击的日志，减少重复输出
}

// 隐藏所有MathLive虚拟键盘
const hideAllVirtualKeyboards = () => {
  console.log('🧮 [FORMULA-KEYBOARD-HIDE] 开始隐藏所有虚拟键盘')
  
  // 查找所有激活的公式节点
  const activeFormulaNodes = document.querySelectorAll('.formula-active math-field')
  console.log('🧮 [FORMULA-KEYBOARD-HIDE] 找到激活的公式节点数量:', activeFormulaNodes.length)
  
  activeFormulaNodes.forEach((mathField: Element, index: number) => {
    const mathFieldElement = mathField as any // eslint-disable-line @typescript-eslint/no-explicit-any
    if (mathFieldElement && typeof mathFieldElement.executeCommand === 'function') {
      try {
        console.log(`🧮 [FORMULA-KEYBOARD-HIDE] 隐藏公式节点 ${index + 1} 的虚拟键盘`)
        // 隐藏虚拟键盘
        mathFieldElement.executeCommand('hideVirtualKeyboard')
        console.log(`🧮 [FORMULA-KEYBOARD-HIDE] 公式节点 ${index + 1} 虚拟键盘隐藏完成`)
      } catch (error) {
        console.error(`🧮 [FORMULA-KEYBOARD-HIDE] 隐藏公式节点 ${index + 1} 虚拟键盘失败:`, error)
      }
    } else {
      console.warn(`🧮 [FORMULA-KEYBOARD-HIDE] 公式节点 ${index + 1} 不支持虚拟键盘操作`)
    }
  })
  
  console.log('🧮 [FORMULA-KEYBOARD-HIDE] 所有虚拟键盘隐藏完成')
}

// 失活所有公式节点
const deactivateAllFormulas = () => {
  // 1. 先清除所有待处理的定时器
  console.log('🧮 [FORMULA-DEACTIVATE-ALL] 清除所有待处理的定时器')
  globalTimeoutManager.clearAllTimeouts()
  
  // 2. 查找所有激活的公式容器
  const activeFormulaContainers = document.querySelectorAll('.formula-active')
  
  if (activeFormulaContainers.length === 0) {
    console.log('🧮 [FORMULA-DEACTIVATE-ALL] 没有激活的公式节点需要失活')
    return
  }
  
  console.log('🧮 [FORMULA-DEACTIVATE-ALL] 开始失活所有公式节点，数量:', activeFormulaContainers.length)
  
  activeFormulaContainers.forEach((container: Element, index: number) => {
    const mathField = container.querySelector('math-field') as any // eslint-disable-line @typescript-eslint/no-explicit-any
    if (mathField) {
      try {
        console.log(`🧮 [FORMULA-DEACTIVATE-ALL] 失活公式节点 ${index + 1}`)
        
        // 1. 先隐藏虚拟键盘
        if (typeof mathField.executeCommand === 'function') {
          mathField.executeCommand('hideVirtualKeyboard')
        }
        
        // 2. 强制失焦
        if (typeof mathField.blur === 'function') {
          mathField.blur()
        }
        
        // 3. 设置为只读模式
        mathField.setOptions({ readOnly: true })
        
        // 4. 更新容器样式
        container.classList.remove('formula-active')
        container.classList.add('formula-inactive')
        
        console.log(`🧮 [FORMULA-DEACTIVATE-ALL] 公式节点 ${index + 1} 失活完成`)
      } catch (error) {
        console.error(`🧮 [FORMULA-DEACTIVATE-ALL] 失活公式节点 ${index + 1} 失败:`, error)
      }
    } else {
      console.log(`🧮 [FORMULA-DEACTIVATE-ALL] 公式节点 ${index + 1} 不存在`)
    }
  })
  
  console.log('🧮 [FORMULA-DEACTIVATE-ALL] 所有公式节点失活完成')
}

// 生命周期
onMounted(() => {
  initEditor()
  
  // 添加全局点击监听器
  document.addEventListener('click', handleDocumentClick, true)
})

onUnmounted(() => {
  if (editor.value) {
    editor.value.destroy()
  }
  
  // 移除全局点击监听器
  document.removeEventListener('click', handleDocumentClick, true)
})
</script>

<style scoped>
.tiptap-editor-container {
  width: 100%;
  background: transparent;
  border-radius: 24px;
  border: none;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;
  position: relative;
}

.tiptap-editor-container:focus-within {
  box-shadow: none;
  transform: none;
  background: transparent;
  border: none;
}

/* 编辑器包装器 */
.editor-wrapper {
  position: relative;
  min-height: 40px;
  max-height: v-bind(maxHeight);
  overflow-y: auto;
}

/* 编辑器内容 */
.editor-content {
  padding: 12px 16px;
  min-height: 40px;
  outline: none !important;
  font-size: 16px;
  line-height: 1.4;
  color: #3c4043;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  letter-spacing: 0;
}

.editor-content:focus {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

/* 覆盖TipTap编辑器内部元素的focus样式 */
:deep(.editor-content *) {
  outline: none !important;
}

:deep(.editor-content *:focus) {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

:deep(.ProseMirror) {
  outline: none !important;
}

:deep(.ProseMirror:focus) {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

/* 占位符 */
.editor-placeholder {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  color: #9aa0a6;
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  pointer-events: none;
  user-select: none;
  z-index: 1;
  line-height: 1.4;
  letter-spacing: 0;
}

/* FormulaNode 样式 - 简洁版本 */
:deep(.formula-node-container) {
  display: inline-flex;
  vertical-align: baseline;
  transition: all 0.2s ease-in-out;
  /* 添加适当的边距 */
  margin: 0 4px; /* 左右边距 */
  padding: 2px 4px; /* 内边距 */
  border: none; 
  background: transparent;
}

/* 暂存模式 (readOnly) */
:deep(.formula-inactive) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  cursor: pointer;
}

:deep(.formula-inactive:hover) {
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 激活模式 */
:deep(.formula-active) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  cursor: text;
}

/* 统一控制 math-field 的外观 */
:deep(math-field) {
  /* 移除所有 math-field 自身的边框和背景，让它完全受控于外部容器 */
  --math-field-background-color: transparent !important;
  --math-field-border: none !important;
  min-width: 1ch; /* 确保空公式也有最小宽度 */
}

/* 控制暂存模式下公式的颜色 */
:deep(.formula-inactive math-field) {
  color: #1a73e8;
}

/* 控制激活模式下公式的颜色 */
:deep(.formula-active math-field) {
  color: #000000;
}



/* 响应式设计 */
@media (max-width: 768px) {
  .tiptap-editor-container {
    border-radius: 20px;
  }
  
  .editor-content {
    padding: 10px 12px;
    font-size: 15px;
  }
  
  .editor-placeholder {
    top: 10px;
    left: 12px;
    right: 12px;
    font-size: 15px;
  }
}

</style>
    