<template>
  <div class="modern-chat-container">
    <!-- 主容器 -->
    <div class="chat-input-wrapper" ref="inputAreaRef">
      <!-- 新的Tiptap编辑器输入区域 -->
      <div class="unified-input-area">
        <TiptapEditor
          ref="tiptapEditorRef"
          v-model="editorContent"
          :placeholder="props.placeholderText"
          :disabled="props.isLoading"
          :max-height="'200px'"
          @focus="handleEditorFocus"
          @blur="handleEditorBlur"
          @keydown="handleEditorKeydown"
          @update:modelValue="handleEditorUpdate"
        />
      </div>

      <!-- 控制栏 -->
      <div class="control-bar">
        <!-- 左侧控制组 -->
        <div class="left-controls">
          <!-- 编辑状态指示器 -->
          <div v-if="props.isEditing" class="edit-indicator">
            <q-icon name="edit" color="primary" size="16px" />
            <span class="edit-text">编辑消息</span>
            <q-btn
              flat
              dense
              round
              icon="close"
              size="sm"
              color="grey-6"
              @click="$emit('cancel-edit')"
              class="cancel-edit-btn"
            >
              <q-tooltip>取消编辑</q-tooltip>
            </q-btn>
          </div>

          <!-- 模式选择器 - 仅在AI模式下显示且非编辑状态 -->
          <q-btn-dropdown
            v-if="props.type === 'ai' && !props.isEditing"
            flat
            dense
            class="mode-selector"
            :class="{ active: false }"
            :label="getModelDisplayName(props.selectedModel)"
            icon="smart_toy"
            :icon-size="20"
            no-icon-animation
            auto-close
            anchor="top middle"
            self="bottom middle"
          >
            <q-list class="model-select-list">
              <q-item
                v-for="option in aiRoleOptions"
                :key="option.value"
                clickable
                v-close-popup
                @click="selectModel(option.value)"
                :class="{ active: props.selectedModel === option.value }"
                class="model-select-item"
              >
                <q-item-section>
                  <q-item-label>{{ option.label }}</q-item-label>
                </q-item-section>
                <q-item-section side v-if="props.selectedModel === option.value">
                  <q-icon name="check" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <!-- 联网搜索 - 仅在AI对话时显示且非编辑状态 -->
          <q-btn
            v-if="props.type === 'ai' && !props.isEditing"
            flat
            dense
            class="web-search-btn"
            :class="{ active: props.enableWebSearch }"
            @click="$emit('toggle-web-search')"
          >
            <q-icon name="language" size="20px" />
            <span>联网搜索</span>
          </q-btn>
        </div>

        <!-- 右侧控制组 -->
        <div class="right-controls">
          <!-- 语音按钮 - 仅老师对话显示，AI模式下隐藏 -->
          <q-btn
            v-if="props.type === 'teacher'"
            flat
            round
            dense
            :icon="props.isRecording ? 'mic' : 'mic_none'"
            :color="props.isRecording ? 'red-6' : undefined"
            @mousedown="handleVoiceStart"
            @mouseup="handleVoiceEnd"
            @mouseleave="handleVoiceEnd"
            @touchstart="handleVoiceStart"
            @touchend="handleVoiceEnd"
            @touchmove="handleVoiceMove"
            class="control-icon-btn voice-btn"
          >
            <q-tooltip>{{ props.isRecording ? '松开结束录音' : '按住说话' }}</q-tooltip>
          </q-btn>

          <!-- 图片上传 - AI模式下隐藏 -->
          <q-btn
            v-if="props.type !== 'ai'"
            flat
            round
            dense
            icon="add_photo_alternate"
            @click="$emit('show-image-picker')"
            class="control-icon-btn"
            :class="{ active: props.activeMode?.label === '图片模式' }"
          >
            <q-tooltip>添加图片</q-tooltip>
          </q-btn>

          <!-- 插入公式按钮 -->
          <q-btn
            round
            icon="functions"
            color="primary"
            outline
            @click="handleInsertMathFormula"
            class="math-formula-btn"
            size="md"
          >
            <q-tooltip>插入数学公式</q-tooltip>
          </q-btn>

          <!-- 发送按钮 -->
          <q-btn
            round
            :icon="props.isLoading ? 'hourglass_empty' : (props.isEditing ? 'check' : 'send')"
            :color="props.canSend ? 'primary' : 'grey-4'"
            :disable="!props.canSend || props.isLoading"
            :loading="props.isLoading"
            @click="handleSendMessage"
            class="send-button"
            size="md"
          >
            <q-tooltip v-if="props.isEditing">更新消息</q-tooltip>
            <q-tooltip v-else>发送消息</q-tooltip>
          </q-btn>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch, getCurrentInstance } from 'vue'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import TiptapEditor from './TiptapEditor.vue'
import type { 
  ContentBlock, 
  ChatInputProps, 
  ChatInputEmits 
} from '../../types'

// 动态导入MathLive（向后兼容）
let MathfieldElement: any = null

const props = defineProps<ChatInputProps>()

const emit = defineEmits<ChatInputEmits & {
  'focus': []
  'blur': []
}>()

// 新的编辑器相关状态
const inputAreaRef = ref<HTMLElement>()
const editorContent = ref<string>('')
const isEditorFocused = ref(false)
const tiptapEditorRef = ref<InstanceType<typeof TiptapEditor>>()

// 保留原有的复杂状态用于向后兼容（如果需要）
const contentCanvasRef = ref<HTMLElement>()
const contentBlocks = ref<ContentBlock[]>([])
const currentEditingFormula = ref<ContentBlock | null>(null)
const formulaRefs = ref<Map<string, HTMLElement>>(new Map())
const mathfields = ref<Map<string, any>>(new Map())
const selectedBlockIndex = ref<number>(-1)
const isKeyboardTransitioning = ref(false)
const isInsertingFormula = ref(false)
const isPlaceholderClicked = ref(false)
const isReadyForTextInput = ref(false)

// 消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 获取当前组件实例
const instance = getCurrentInstance()

// 新的编辑器相关计算属性
const hasAnyContent = computed(() => {
  return editorContent.value.trim().length > 0
})

const currentInputValue = computed(() => {
  return editorContent.value
})

// 编辑器事件处理
const handleEditorFocus = () => {
  console.log('🎯 [编辑器] 编辑器获得焦点')
  console.log('🔍 [编辑器焦点] 当前状态检查', {
    isEditorFocused: isEditorFocused.value,
    editorContent: editorContent.value,
    editorContentLength: editorContent.value?.length || 0
  })
  isEditorFocused.value = true
  emit('focus')
}

const handleEditorBlur = () => {
  console.log('🎯 [编辑器] 编辑器失去焦点')
  console.log('🔍 [编辑器失焦] 当前状态检查', {
    isEditorFocused: isEditorFocused.value,
    editorContent: editorContent.value,
    editorContentLength: editorContent.value?.length || 0
  })
  isEditorFocused.value = false
  emit('blur')
}

const handleEditorKeydown = (event: KeyboardEvent) => {
  console.log('⌨️ [编辑器] 编辑器键盘事件', { key: event.key })
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSendMessage()
  }
}

const handleEditorUpdate = (content: string) => {
  console.log('📝 [编辑器] 编辑器内容更新', { content })
  editorContent.value = content
  emit('update:modelValue', content)
}

// 学习伙伴角色选项
const aiRoleOptions = [
  { label: '同桌', value: 'mate' },
  { label: '学长', value: 'mentor' },
  { label: '大神', value: 'researcher' },
]

// 根据选择的模式获取显示名称
const getModelDisplayName = (model: string) => {
  const option = aiRoleOptions.find(opt => opt.value === model)
  return option ? option.label : '同桌'
}

// 切换模型选择弹出框（使用q-btn-dropdown后不再需要此函数）

// 选择模型
const selectModel = (model: string) => {
  emit('update:selected-model', model)
}

// 语音录制事件处理
const handleVoiceStart = (event: TouchEvent | MouseEvent) => {
  // 1. 阻止默认行为
  event.preventDefault()
  
  // 2. 触发开始录音事件
  emit('start-voice-input', event)
}

const handleVoiceEnd = (event: TouchEvent | MouseEvent) => {
  // 1. 阻止默认行为
  event.preventDefault()
  
  // 2. 触发停止录音事件
  emit('stop-voice-input', event)
}

const handleVoiceMove = (event: TouchEvent | MouseEvent) => {
  // 1. 阻止默认行为
  event.preventDefault()
  
  // 2. 触发语音移动事件
  emit('voice-move', event)
}

// 统一输入核心方法
const generateBlockId = () => {
  // 1. 生成时间戳
  const timestamp = Date.now()
  
  // 2. 生成随机字符串
  const randomStr = Math.random().toString(36).substr(2, 9)
  
  // 3. 组合生成唯一ID
  const blockId = `block_${timestamp}_${randomStr}`
  
  console.log('🆔 [生成块ID] 创建新的内容块ID', {
    timestamp,
    randomStr,
    blockId
  })
  
  return blockId
}

// 插入公式
const insertFormula = async (clickPosition?: number) => {
  console.log('🔧 [插入公式] 开始插入公式流程', { clickPosition })
  
  // 1. 防止重复点击
  if (isInsertingFormula.value || isKeyboardTransitioning.value) {
    console.log('⚠️ [插入公式] 检测到重复点击，跳过执行', {
      isInsertingFormula: isInsertingFormula.value,
      isKeyboardTransitioning: isKeyboardTransitioning.value
    })
    return
  }
  
  // 1.1 检查组件实例和挂载状态
  if (!instance || !instance.isMounted || !contentCanvasRef.value) {
    console.log('❌ [插入公式] 组件未挂载或实例无效，跳过执行', {
      hasInstance: !!instance,
      isMounted: instance?.isMounted,
      hasContentCanvasRef: !!contentCanvasRef.value
    })
    return
  }
  
  // 1.2 清理之前的编辑状态和实例
  if (currentEditingFormula.value) {
    console.log('🧹 [插入公式] 清理之前的编辑状态', {
      previousEditingId: currentEditingFormula.value.id
    })
    // 清理对应的MathLive实例
    const oldMathfield = mathfields.value.get(currentEditingFormula.value.id)
    if (oldMathfield) {
      console.log('🗑️ [插入公式] 清理旧的MathLive实例')
      cleanupMathLiveInstance(oldMathfield, currentEditingFormula.value.id)
    }
    currentEditingFormula.value = null
  }
  
  // 1.3 清理所有现有的MathLive实例
  if (mathfields.value.size > 0) {
    console.log('🧹 [插入公式] 清理所有现有MathLive实例', {
      instanceCount: mathfields.value.size
    })
    cleanupAllMathLiveInstances()
  }
  
  try {
    // 2. 设置插入状态
    console.log('📝 [插入公式] 设置插入状态为true')
    isInsertingFormula.value = true
    
    // 3. 再次检查组件挂载状态
    if (!contentCanvasRef.value) {
      console.log('❌ [插入公式] 组件在设置状态后未挂载，contentCanvasRef为空')
      isInsertingFormula.value = false
      return
    }
    console.log('✅ [插入公式] 组件挂载状态正常')
    
    // 4. 创建公式块对象
    const formulaBlock: ContentBlock = {
      id: generateBlockId(),
      type: 'formula',
      content: '',
      isEditing: true
    }
    console.log('📦 [插入公式] 创建公式块对象', {
      blockId: formulaBlock.id,
      type: formulaBlock.type,
      isEditing: formulaBlock.isEditing
    })
    
    // 5. 在指定位置插入公式块到contentBlocks中
    if (clickPosition !== undefined && clickPosition >= 0 && clickPosition < contentBlocks.value.length) {
      // 在指定位置插入
      contentBlocks.value.splice(clickPosition, 0, formulaBlock)
      console.log('📍 [插入公式] 在指定位置插入公式块', {
        position: clickPosition,
        totalBlocks: contentBlocks.value.length
      })
    } else {
      // 在尾部插入（默认行为）
      contentBlocks.value.push(formulaBlock)
      console.log('📍 [插入公式] 在尾部插入公式块', {
        totalBlocks: contentBlocks.value.length
      })
    }
    
    // 6. 设置当前编辑公式
    currentEditingFormula.value = formulaBlock
    console.log('🎯 [插入公式] 设置当前编辑公式', {
      currentEditingFormulaId: currentEditingFormula.value?.id
    })
    
    // 6. 等待DOM更新
    console.log('⏳ [插入公式] 等待DOM更新')
    await nextTick()
    console.log('✅ [插入公式] DOM更新完成')
    
    // 7. 再次验证组件状态
    if (!contentCanvasRef.value || !currentEditingFormula.value) {
      console.log('❌ [插入公式] DOM更新后组件状态异常', {
        contentCanvasRef: !!contentCanvasRef.value,
        currentEditingFormula: !!currentEditingFormula.value
      })
      isInsertingFormula.value = false
      return
    }
    console.log('✅ [插入公式] DOM更新后组件状态正常')
    
    // 8. 初始化MathLive编辑器
    console.log('🚀 [插入公式] 开始初始化MathLive编辑器', {
      blockId: formulaBlock.id
    })
    await initMathLiveForBlock(formulaBlock.id)
    console.log('✅ [插入公式] MathLive编辑器初始化完成')
    
  } catch (error) {
    // 9. 错误处理
    console.error('💥 [插入公式] 插入公式失败:', error)
    console.log('🧹 [插入公式] 清理错误状态')
    
    // 检查组件是否仍然有效
    if (instance && instance.isMounted) {
      currentEditingFormula.value = null
      isKeyboardTransitioning.value = false
    }
  } finally {
    // 10. 清理插入状态
    console.log('🏁 [插入公式] 清理插入状态')
    if (instance && instance.isMounted) {
      isInsertingFormula.value = false
    }
    console.log('✅ [插入公式] 插入公式流程完成')
  }
}

// 为特定块初始化MathLive
const initMathLiveForBlock = async (blockId: string) => {
  console.log('🔧 [MathLive初始化] 开始初始化MathLive', { blockId })
  
  // 添加全局错误处理来捕获MathLive的选择错误
  const originalConsoleError = console.error
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Invalid selection')) {
      console.warn('⚠️ [MathLive初始化] 捕获到MathLive选择错误，已忽略:', ...args)
      return
    }
    originalConsoleError.apply(console, args)
  }
  
  try {
    // 1. 检查组件实例和挂载状态
    if (!instance || !instance.isMounted || !contentCanvasRef.value) {
      console.log('❌ [MathLive初始化] 组件未挂载或实例无效', {
        hasInstance: !!instance,
        isMounted: instance?.isMounted,
        hasContentCanvasRef: !!contentCanvasRef.value
      })
      isKeyboardTransitioning.value = false
      return
    }
    console.log('✅ [MathLive初始化] 组件挂载状态正常')
    
    // 2. 开始键盘切换动画
    console.log('🎬 [MathLive初始化] 开始键盘切换动画')
    isKeyboardTransitioning.value = true
    
    // 3. 获取容器元素
    const container = formulaRefs.value.get(blockId)
    if (!container) {
      console.log('❌ [MathLive初始化] 未找到容器元素', { blockId })
      isKeyboardTransitioning.value = false
      return
    }
    console.log('✅ [MathLive初始化] 找到容器元素', {
      containerTagName: container.tagName,
      containerClassName: container.className
    })
    
    // 4. 动态导入MathLive
    if (!MathfieldElement) {
      console.log('📦 [MathLive初始化] 开始动态导入MathLive模块')
      const mathlive = await import('mathlive')
      MathfieldElement = mathlive.MathfieldElement
      console.log('✅ [MathLive初始化] MathLive模块导入成功')
    } else {
      console.log('✅ [MathLive初始化] MathLive模块已存在，跳过导入')
    }
    
    // 5. 创建MathLive实例
    console.log('🏗️ [MathLive初始化] 创建MathLive实例')
    const mathfield = new MathfieldElement()
    console.log('✅ [MathLive初始化] MathLive实例创建成功', {
      mathfieldType: typeof mathfield,
      mathfieldConstructor: mathfield.constructor.name
    })
    
    // 6. 配置MathLive属性
    console.log('⚙️ [MathLive初始化] 开始配置MathLive属性')
    try {
      // 使用最简配置，只保留核心功能，不依赖外部资源
      const config = {
        mathVirtualKeyboardPolicy: 'off',
        defaultMode: 'math',
        fontSize: 18,
        placeholder: '输入数学公式...',
        smartMode: true,
        smartSuperscript: true,
        theme: 'light',
        toolbar: 'none',
        autoComplete: 'off',
        selectionMode: 'none',
        contextMenu: 'none',
        dragMode: 'none',
        readOnly: false,
        border: 'none',
        backgroundColor: 'transparent',
        decorations: false
      }
      
      // 逐个设置属性，避免批量设置可能的问题
      Object.entries(config).forEach(([key, value]) => {
        try {
          mathfield[key] = value
        } catch (propError) {
          console.warn(`⚠️ [MathLive初始化] 设置属性 ${key} 失败:`, propError)
        }
      })
      
      console.log('✅ [MathLive初始化] MathLive属性配置完成')
    } catch (configError) {
      console.warn('⚠️ [MathLive初始化] 属性配置失败，使用默认配置:', configError)
    }
    
    // 7. 事件监听器已由 TiptapEditor 统一管理，无需重复设置
    console.log('🎧 [MathLive初始化] 事件监听器由 TiptapEditor 统一管理')
    
    // 8. 设置进入动画
    console.log('🎭 [MathLive初始化] 设置进入动画样式')
    mathfield.style.opacity = '0'
    mathfield.style.transform = 'translateY(10px)'
    console.log('✅ [MathLive初始化] 进入动画样式设置完成')
    
    // 9. 添加到DOM并存储引用
    console.log('🌐 [MathLive初始化] 添加MathLive到DOM')
    try {
      // 检查容器是否仍然有效
      if (!container || !container.isConnected) {
        throw new Error('容器元素无效或已断开连接')
      }
      
      container.appendChild(mathfield)
      mathfields.value.set(blockId, mathfield)
      console.log('✅ [MathLive初始化] MathLive已添加到DOM并存储引用', {
        mathfieldsCount: mathfields.value.size,
        containerChildrenCount: container.children.length
      })
    } catch (error) {
      console.warn('⚠️ [MathLive初始化] 添加MathLive到DOM时出错:', error)
      // 清理失败的实例
      try {
        if (mathfield && typeof mathfield.remove === 'function') {
          mathfield.remove()
        }
      } catch (cleanupError) {
        console.warn('⚠️ [MathLive初始化] 清理失败实例时出错:', cleanupError)
      }
      throw error // 重新抛出错误，让上层处理
    }
    
    // 10. 触发进入动画
    console.log('🎬 [MathLive初始化] 触发进入动画')
    await nextTick()
    mathfield.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    mathfield.style.opacity = '1'
    mathfield.style.transform = 'translateY(0)'
    console.log('✅ [MathLive初始化] 进入动画已触发')
    
    // 11. 延迟聚焦
    console.log('🎯 [MathLive初始化] 设置延迟聚焦')
    setTimeout(() => {
      try {
        if (mathfield && mathfield.isConnected) {
          console.log('🔍 [MathLive初始化] 开始聚焦MathLive')
          // 使用更安全的聚焦方式，增加延迟避免立即失去焦点
          setTimeout(() => {
            try {
              mathfield.focus({ preventScroll: true })
              console.log('✅ [MathLive初始化] MathLive聚焦成功')
            } catch (focusError) {
              console.warn('⚠️ [MathLive初始化] MathLive聚焦失败:', focusError)
            }
          }, 100)
        } else {
          console.log('⚠️ [MathLive初始化] MathLive未连接到DOM，跳过聚焦', {
            mathfieldExists: !!mathfield,
            isConnected: mathfield?.isConnected
          })
        }
      } catch (error) {
        console.warn('⚠️ [MathLive初始化] MathLive聚焦失败:', error)
        // 聚焦失败不影响整体功能
      }
      console.log('🏁 [MathLive初始化] 键盘切换动画结束')
      isKeyboardTransitioning.value = false
    }, 500) // 增加延迟时间
    
    console.log('✅ [MathLive初始化] MathLive初始化流程完成')
    
  } catch (error) {
    // 12. 错误处理
    console.error('💥 [MathLive初始化] MathLive初始化失败:', error)
    console.log('🧹 [MathLive初始化] 清理错误状态')
    
    // 清理当前编辑公式状态
    if (currentEditingFormula.value && currentEditingFormula.value.id === blockId) {
      currentEditingFormula.value = null
    }
    
    isKeyboardTransitioning.value = false
  } finally {
    // 13. 恢复原始console.error
    console.error = originalConsoleError
  }
}



// 完成公式编辑
const finishFormulaEditing = async (blockId: string) => {
  console.log('🏁 [公式编辑完成] 开始完成公式编辑流程', { blockId })
  
  // 1. 获取MathLive实例
  const mathfield = mathfields.value.get(blockId)
  if (!mathfield) {
    console.log('❌ [公式编辑完成] 未找到MathLive实例', { blockId })
    return
  }
  console.log('✅ [公式编辑完成] 找到MathLive实例')
  
  // 2. 获取公式内容
  const content = mathfield.value || ''
  console.log('📝 [公式编辑完成] 获取公式内容', {
    blockId,
    content,
    contentLength: content.length,
    isEmpty: !content.trim()
  })
  
  // 3. 开始退出动画
  console.log('🎬 [公式编辑完成] 开始退出动画')
  isKeyboardTransitioning.value = true
  mathfield.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  mathfield.style.opacity = '0'
  mathfield.style.transform = 'translateY(-5px)'
  console.log('✅ [公式编辑完成] 退出动画样式已设置')
  
  // 4. 等待动画完成
  console.log('⏳ [公式编辑完成] 等待退出动画完成')
  setTimeout(() => {
    console.log('🎬 [公式编辑完成] 退出动画完成，开始处理公式块保存')
    
    // 5. 检查组件挂载状态
    if (!contentCanvasRef.value) {
      console.log('❌ [公式编辑完成] 组件未挂载，跳过保存')
      return
    }
    console.log('✅ [公式编辑完成] 组件挂载状态正常')
    
    // 6. 处理公式块保存
    if (currentEditingFormula.value && currentEditingFormula.value.id === blockId) {
      console.log('📦 [公式编辑完成] 处理新公式块保存')
      
      // 6.1 检查内容是否为空
      if (!content.trim()) {
        console.log('⚠️ [公式编辑完成] 公式内容为空，取消保存')
        currentEditingFormula.value = null
        return
      }
      
      // 6.2 创建新的公式块
      const formulaBlock: ContentBlock = {
        id: blockId,
        type: 'formula',
        content: content,
        renderedContent: content ? renderMessageContent(content) : '',
        isEditing: false
      }
      console.log('✅ [公式编辑完成] 新公式块创建完成', {
        blockId: formulaBlock.id,
        type: formulaBlock.type,
        content: formulaBlock.content,
        hasRenderedContent: !!formulaBlock.renderedContent,
        isEditing: formulaBlock.isEditing
      })
      
      // 6.3 添加到内容块列表
      contentBlocks.value.push(formulaBlock)
      currentEditingFormula.value = null
      console.log('✅ [公式编辑完成] 新公式块已添加到内容块列表', {
        totalBlocks: contentBlocks.value.length,
        currentEditingFormulaCleared: !currentEditingFormula.value
      })
    } else {
      console.log('🔄 [公式编辑完成] 处理现有公式块更新')
      
      // 6.3 更新现有公式块
      const blockIndex = contentBlocks.value.findIndex(block => block.id === blockId)
      if (blockIndex !== -1) {
        const oldContent = contentBlocks.value[blockIndex].content
        contentBlocks.value[blockIndex].content = content
        contentBlocks.value[blockIndex].renderedContent = content ? renderMessageContent(content) : ''
        contentBlocks.value[blockIndex].isEditing = false
        console.log('✅ [公式编辑完成] 现有公式块更新完成', {
          blockIndex,
          blockId,
          oldContent,
          newContent: content,
          contentChanged: oldContent !== content,
          isEditing: contentBlocks.value[blockIndex].isEditing
        })
      } else {
        console.log('⚠️ [公式编辑完成] 未找到要更新的公式块', { blockId, blockIndex })
      }
    }
    
    // 7. 清理MathLive实例
    console.log('🧹 [公式编辑完成] 开始清理MathLive实例')
    cleanupMathLiveInstance(mathfield, blockId)
    
    // 8. 更新modelValue
    const newModelValue = currentInputValue.value
    console.log('📤 [公式编辑完成] 更新modelValue', {
      newModelValue,
      modelValueLength: newModelValue.length
    })
    emit('update:modelValue', newModelValue)
    
    // 9. 重置键盘切换状态
    console.log('🔄 [公式编辑完成] 重置键盘切换状态')
    isKeyboardTransitioning.value = false
    
    console.log('✅ [公式编辑完成] 公式编辑完成流程结束')
  }, 200)
}

// 清理MathLive实例
const cleanupMathLiveInstance = (mathfield: any, blockId: string) => {
  console.log('🧹 [清理MathLive] 开始清理MathLive实例', {
    blockId,
    mathfieldType: typeof mathfield,
    hasRemoveMethod: typeof mathfield?.remove === 'function',
    isConnected: mathfield?.isConnected
  })
  
  // 1. 从DOM中移除元素
  try {
    if (mathfield && typeof mathfield.remove === 'function') {
      console.log('🗑️ [清理MathLive] 从DOM中移除MathLive元素')
      mathfield.remove()
      console.log('✅ [清理MathLive] MathLive元素已从DOM中移除')
    } else {
      console.log('⚠️ [清理MathLive] MathLive实例无效，跳过移除')
    }
  } catch (error) {
    console.warn('⚠️ [清理MathLive] 移除MathLive元素时出错:', error)
  }
  
  // 2. 从引用映射中删除
  const hadInstance = mathfields.value.has(blockId)
  mathfields.value.delete(blockId)
  console.log('✅ [清理MathLive] 从引用映射中删除MathLive实例', {
    blockId,
    hadInstance,
    remainingInstances: mathfields.value.size
  })
  
  console.log('✅ [清理MathLive] MathLive实例清理完成')
}

// 清理所有MathLive实例
const cleanupAllMathLiveInstances = () => {
  console.log('🧹 [清理所有MathLive] 开始清理所有MathLive实例')
  
  // 1. 遍历所有MathLive实例
  mathfields.value.forEach((mathfield, blockId) => {
    console.log('🗑️ [清理所有MathLive] 清理实例', { blockId })
    try {
      if (mathfield && typeof mathfield.remove === 'function') {
        mathfield.remove()
        console.log('✅ [清理所有MathLive] 实例清理成功', { blockId })
      }
    } catch (error) {
      console.warn('⚠️ [清理所有MathLive] 实例清理失败:', { blockId, error })
    }
  })
  
  // 2. 清空引用映射
  mathfields.value.clear()
  formulaRefs.value.clear()
  console.log('✅ [清理所有MathLive] 所有实例清理完成')
}


// 防抖定时器
let insertFormulaDebounceTimer: number | null = null

// 插入数学公式处理
const handleInsertMathFormula = async () => {
  console.log('🔢 [插入公式] 触发插入数学公式')
  
  // 防抖保护：清除之前的定时器
  if (insertFormulaDebounceTimer) {
    console.log('⚠️ [插入公式] 检测到重复点击，取消之前的操作')
    clearTimeout(insertFormulaDebounceTimer)
  }
  
  // 设置新的防抖定时器
  insertFormulaDebounceTimer = setTimeout(async () => {
    // 检查 TiptapEditor 组件是否已经正确初始化
    if (!tiptapEditorRef.value) {
      console.error('❌ [插入公式] TiptapEditor 组件未初始化')
      return
    }
    
    // 检查 insertMathFormula 方法是否存在
    if (typeof tiptapEditorRef.value.insertMathFormula !== 'function') {
      console.error('❌ [插入公式] insertMathFormula 方法不存在', tiptapEditorRef.value)
      return
    }
    
    try {
      await tiptapEditorRef.value.insertMathFormula()
      
      // 插入公式后触发滚动到底部事件
      console.log('📜 [插入公式] 触发滚动到底部事件')
      emit('scroll-to-bottom')
    } catch (error) {
      console.error('❌ [插入公式] 插入公式失败:', error)
    }
    
    // 清除定时器引用
    insertFormulaDebounceTimer = null
  }, 300) // 300ms防抖延迟
}

// 发送消息处理
const handleSendMessage = () => {
  console.log('📤 [发送消息] 开始发送消息流程')
  
  // 1. 调用 TiptapEditor 的 getMarkdown 方法获取完整内容
  const markdownContent = tiptapEditorRef.value?.getMarkdown();

  // 2. 检查内容是否为空
  if (!markdownContent || !markdownContent.trim()) {
    console.log('⚠️ [发送消息] 没有内容可发送')
    return
  }

  // 3. 更新 v-model 的值，将完整的 markdown 内容传递给父组件
  emit('update:modelValue', markdownContent);

  // 4. 使用 nextTick 确保父组件的 v-model 更新后再发送消息
  nextTick(() => {
    console.log('📤 [发送消息] 触发发送消息事件')
    emit('send-message');

    console.log('🧹 [发送消息] 清空输入内容')
    clearInputContent();
  });
}

// 清空输入内容
const clearInputContent = () => {
  console.log('🧹 [清空内容] 开始清空输入内容')

  // 1. 先隐藏所有公式键盘并失活所有公式（确保虚拟键盘被隐藏）
  if (tiptapEditorRef.value) {
    console.log('🧮 [清空内容] 隐藏所有公式键盘')
    // 调用 TiptapEditor 的隐藏键盘方法
    if (typeof tiptapEditorRef.value.hideAllVirtualKeyboards === 'function') {
      tiptapEditorRef.value.hideAllVirtualKeyboards()
    }
    if (typeof tiptapEditorRef.value.deactivateAllFormulas === 'function') {
      tiptapEditorRef.value.deactivateAllFormulas()
    }
  }

  // 2. 直接调用 TiptapEditor 实例的命令来清空内容
  if (tiptapEditorRef.value && tiptapEditorRef.value.editor) {
    // 参数 true 表示同时发射一个 update 事件，这样 v-model 会自动同步
    tiptapEditorRef.value.editor.commands.clearContent(true);
  }
  
  // 3. 确保父组件的 v-model 也被清空
  emit('update:modelValue', '');

  // 4. 清理所有MathLive实例（向后兼容）
  cleanupAllMathLiveInstances()
  
  // 5. 清空内容块（向后兼容）
  contentBlocks.value = []
  
  // 6. 清空当前编辑公式（向后兼容）
  currentEditingFormula.value = null
  
  // 7. 重置选中状态（向后兼容）
  selectedBlockIndex.value = -1
  
  // 8. 重置键盘切换状态（向后兼容）
  isKeyboardTransitioning.value = false
  
  // 9. 重置文本输入准备状态（向后兼容）
  isReadyForTextInput.value = false
  
  // 10. 重置占位符状态（向后兼容）
  isPlaceholderClicked.value = false
  
  // 11. 更新modelValue
  emit('update:modelValue', '')
  
  console.log('✅ [清空内容] 输入内容清空完成')
}

// 监听modelValue变化，同步到编辑器
watch(() => props.modelValue, (newValue, oldValue) => {
  console.log('👀 [监听modelValue] 检测到modelValue变化', {
    oldValue,
    newValue,
    oldValueLength: oldValue?.length || 0,
    newValueLength: newValue?.length || 0,
    currentEditorContent: editorContent.value,
    currentEditorContentLength: editorContent.value.length
  })
  
  // 1. 检查值是否有效且与当前编辑器内容不同
  if (newValue !== editorContent.value) {
    console.log('📝 [监听modelValue] 同步到编辑器')
    editorContent.value = newValue || ''
  }
}, { immediate: true })

// 监听内容块变化
watch(() => contentBlocks.value, (newBlocks, oldBlocks) => {
  console.log('👀 [监听内容块] 检测到内容块变化', {
    oldBlocksCount: oldBlocks?.length || 0,
    newBlocksCount: newBlocks?.length || 0,
    blocks: newBlocks.map(block => ({
      id: block.id,
      type: block.type,
      content: block.content,
      contentLength: block.content.length,
      isEditing: block.isEditing,
      isSelected: block.isSelected
    }))
  })
}, { deep: true })

// 监听当前编辑公式变化
watch(() => currentEditingFormula.value, (newFormula, oldFormula) => {
  console.log('👀 [监听编辑公式] 检测到当前编辑公式变化', {
    oldFormula: oldFormula ? {
      id: oldFormula.id,
      type: oldFormula.type,
      content: oldFormula.content,
      isEditing: oldFormula.isEditing
    } : null,
    newFormula: newFormula ? {
      id: newFormula.id,
      type: newFormula.type,
      content: newFormula.content,
      isEditing: newFormula.isEditing
    } : null
  })
})

// 监听文本输入准备状态变化
watch(() => isReadyForTextInput.value, (newValue, oldValue) => {
  console.log('👀 [监听文本输入] 检测到文本输入准备状态变化', {
    oldValue,
    newValue,
    hasAnyContent: hasAnyContent.value
  })
})

const handleNativeKeyboardClose = () => {
  console.log('ChatInput.vue 监听到 nativeKeyboardClose 事件');
  
  // 检查是否有正在编辑的公式
  if (currentEditingFormula.value) {
    // 如果有，则完成编辑
    finishFormulaEditing(currentEditingFormula.value.id);
  }
  
  // 让主输入区域失焦
  if (contentCanvasRef.value) {
    contentCanvasRef.value.blur();
  }
}

const handleFormulaEnterPressed = () => {
  console.log('📤 [ChatInput] 接收到公式回车键事件，准备发送消息')
  // 延迟发送消息，确保公式编辑完成
  setTimeout(() => {
    handleSendMessage()
  }, 100)
}

const handleFormulaContentUpdated = (event: Event) => {
  const customEvent = event as CustomEvent
  const { nodeId, content } = customEvent.detail
  console.log('📝 [ChatInput] 接收到公式内容更新事件', { nodeId, content })
  
  // 更新当前编辑公式的内容
  if (currentEditingFormula.value && currentEditingFormula.value.id === nodeId) {
    currentEditingFormula.value.content = content
    console.log('✅ [ChatInput] 当前编辑公式内容已更新')
  }
}

const handleFormulaCancelEdit = (event: Event) => {
  const customEvent = event as CustomEvent
  const { nodeId } = customEvent.detail
  console.log('🚫 [ChatInput] 接收到公式取消编辑事件', { nodeId })
  
  // 取消当前编辑状态
  if (currentEditingFormula.value && currentEditingFormula.value.id === nodeId) {
    currentEditingFormula.value = null
    isKeyboardTransitioning.value = false
    console.log('✅ [ChatInput] 公式编辑已取消')
  }
}


// 生命周期
onMounted(() => {
  console.log('🚀 [组件挂载] ChatInput组件开始挂载', {
    modelValue: props.modelValue,
    modelValueLength: props.modelValue?.length || 0,
    placeholderText: props.placeholderText,
    type: props.type,
    canSend: props.canSend
  })
  
  // 1. 初始化编辑器内容
  if (props.modelValue) {
    console.log('📝 [组件挂载] 初始化编辑器内容')
    editorContent.value = props.modelValue
  } else {
    console.log('📝 [组件挂载] 没有初始内容，跳过编辑器初始化')
  }
  
  // 2. 添加键盘关闭监听器
  window.addEventListener('nativeKeyboardClose', handleNativeKeyboardClose);
  
  // 3. 添加公式回车键监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-enter-pressed', handleFormulaEnterPressed);
  
  // 4. 添加公式内容更新监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-content-updated', handleFormulaContentUpdated);
  
  // 5. 添加公式取消编辑监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-cancel-edit', handleFormulaCancelEdit);

  console.log('✅ [组件挂载] ChatInput组件挂载完成')
})

onUnmounted(() => {
  console.log('🔄 [组件卸载] 开始清理组件状态', {
    editorContent: editorContent.value,
    editorContentLength: editorContent.value.length,
    contentBlocksCount: contentBlocks.value.length,
    hasCurrentEditingFormula: !!currentEditingFormula.value,
    mathfieldsCount: mathfields.value.size,
    formulaRefsCount: formulaRefs.value.size
  })
  
  // 1. 清理编辑器内容
  editorContent.value = ''
  console.log('🧹 [组件卸载] 编辑器内容已清理')
  
  // 2. 清理编辑状态（向后兼容）
  currentEditingFormula.value = null
  console.log('🧹 [组件卸载] 编辑状态已清理')
  
  // 3. 清理所有MathLive实例（向后兼容）
  cleanupAllMathLiveInstances()
  console.log('🧹 [组件卸载] MathLive实例已清理')
  
  // 4. 清理内容块（向后兼容）
  const blocksCount = contentBlocks.value.length
  contentBlocks.value = []
  selectedBlockIndex.value = -1
  console.log('🧹 [组件卸载] 内容块已清理', { clearedBlocksCount: blocksCount })
  
  // 5. 重置其他状态（向后兼容）
  isReadyForTextInput.value = false
  isKeyboardTransitioning.value = false
  isPlaceholderClicked.value = false
  console.log('🧹 [组件卸载] 其他状态已重置')
  
  // 6. 移除键盘关闭监听器
  window.removeEventListener('nativeKeyboardClose', handleNativeKeyboardClose);
  
  // 7. 移除公式回车键监听器
  window.removeEventListener('formula-enter-pressed', handleFormulaEnterPressed);
  
  // 8. 移除公式内容更新监听器
  window.removeEventListener('formula-content-updated', handleFormulaContentUpdated);
  
  // 9. 移除公式取消编辑监听器
  window.removeEventListener('formula-cancel-edit', handleFormulaCancelEdit);

  console.log('✅ [组件卸载] 组件状态清理完成')
})

// 暴露方法给父组件
defineExpose({
  clearInputContent,
  insertFormula,
  focus: () => {
    if (tiptapEditorRef.value && tiptapEditorRef.value.editor) {
      tiptapEditorRef.value.editor.commands.focus()
    }
  }
})

</script>

<style scoped>
/* 现代聊天输入容器 */
.modern-chat-container {
  width: 100%;
  max-width: 100%;
  padding: 0 16px 8px 16px;
  background: transparent;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  z-index: 1000; /* 确保整个输入容器在消息区域上方 */
}

/* 主容器 - 现代感设计 */
.chat-input-wrapper {
  background: #f8f9fa;
  border-radius: 16px;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
  border: none;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  width: 100%;
  z-index: 1000; /* 确保输入区域在消息区域上方 */
  max-width: 100%;
  box-sizing: border-box;
}

.chat-input-wrapper:hover {
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.06);
}

.chat-input-wrapper:focus-within {
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
}

/* 附件栏 */
.attachments-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 0 4px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.uploaded-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f3f4;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  color: #3c4043;
}

.file-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  width: 16px;
  height: 16px;
  min-height: 16px;
  color: #5f6368;
}

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #e8f0fe;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  color: #1a73e8;
}

/* 统一输入区域 */
.unified-input-area {
  background: transparent;
  border: none;
  border-radius: 12px;
  padding: 0;
  transition: all 0.2s ease;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.unified-input-area:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.unified-input-area:focus-within {
  box-shadow: none;
}

/* 智能内容画布 */
.content-canvas {
  min-height: 40px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  outline: none;
  font-size: 16px;
  line-height: 1.4;
  color: #3c4043;
  cursor: text;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden; /* 防止占位符溢出 */
  text-decoration: none !important; /* 去除下划线 */
}

/* 隐藏contenteditable的文本内容，只显示Vue模板内容 */
.content-canvas {
  color: transparent !important;
  /* 使用更彻底的方法隐藏文本，不占用空间 */
  font-size: 0 !important;
  line-height: 0 !important;
}

/* 只对contenteditable的直接文本节点应用透明样式，不影响content-block */
.content-canvas > *:not(.canvas-content) {
  color: transparent !important;
  font-size: 0 !important;
  line-height: 0 !important;
  text-decoration: none !important; /* 去除下划线 */
}

/* 确保contenteditable内的所有元素都没有下划线 */
.content-canvas * {
  text-decoration: none !important;
}

/* 确保canvas-content内的内容正常显示 */
.canvas-content {
  font-size: 16px !important;
  line-height: 1.4 !important;
  color: #3c4043 !important;
}

/* 但是content-block要正常显示 */
.content-block {
  color: #3c4043 !important;
  font-size: 16px !important; /* 恢复正常字体大小 */
  line-height: 1.4 !important; /* 恢复正常行高 */
}

.text-block {
  color: #3c4043 !important;
  font-size: 16px !important; /* 恢复正常字体大小 */
  line-height: 1.4 !important; /* 恢复正常行高 */
}

.content-canvas:focus {
  outline: none;
}

/* 画布占位符 */
.canvas-placeholder {
  color: #9aa0a6 !important; /* 确保占位符可见 */
  font-weight: 400;
  pointer-events: auto; /* 允许点击 */
  user-select: none;
  cursor: text; /* 显示文本光标 */
  position: absolute;
  top: 8px;
  left: 12px;
  right: 12px;
  z-index: 1; /* 确保占位符在内容之上 */
  transition: opacity 0.2s ease, transform 0.2s ease; /* 添加过渡效果 */
}

/* Hover效果 - 占位符悬停时变透明 */
.canvas-placeholder:hover {
  opacity: 0.3;
  transform: translateY(-1px);
}

/* 内容区域 */
.canvas-content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px;
  min-height: 24px;
  position: relative;
  z-index: 2; /* 确保内容在占位符之上 */
}

/* 内容块基础样式 */
.content-block {
  display: inline-block;
  position: relative;
  transition: all 0.2s ease;
}

/* 文本块样式 */
.text-block {
  color: #3c4043;
  word-wrap: break-word;
  white-space: nowrap; /* 防止文本换行，保持在一行显示 */
}

/* 公式块样式 */
.formula-block {
  display: inline-block;
  position: relative;
  margin: 0 2px;
  vertical-align: baseline;
}

/* 公式编辑状态 */
.formula-block.editing {
  background: rgba(0, 0, 0, 0.05);
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 2px 4px;
  margin: 0 1px;
}

/* 公式编辑器容器 */
.formula-editor {
  min-width: 60px;
  min-height: 24px;
  display: inline-block;
}

/* 公式渲染内容 */
.formula-rendered {
  display: inline-block;
  vertical-align: baseline;
  font-family: 'Times New Roman', serif;
  color: #1976d2;
}

/* 公式块选中状态 */
.formula-block.selected {
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 2px 4px;
  margin: 0 1px;
}

/* 键盘切换动画 */
.keyboard-transitioning {
  pointer-events: none;
}

.keyboard-transitioning .content-canvas {
  opacity: 0.7;
  transform: scale(0.98);
}

/* 公式编辑器进入动画 */
.formula-editor {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 内容块动画 */
.content-block {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-block:hover {
  transform: translateY(-1px);
}

/* 公式块特殊动画 */
.formula-block {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.formula-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 控制栏 */
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1px 0;
  gap: 16px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border-top: none;
  margin-top: 4px;
  padding-top: 4px;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: nowrap;
  overflow: visible;
}

/* 模式选择器 */
.mode-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border-radius: 20px;
  border: none;
  color: #3c4043;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
}

.mode-selector :deep(.q-btn__content) {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 隐藏下拉箭头 */
.mode-selector :deep(.q-btn-dropdown__arrow) {
  display: none;
}

.mode-selector:hover {
  background: #f8f9fa;
}

.mode-selector.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.mode-text {
  font-weight: 500;
}

/* 当前模式显示 */
.current-mode {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: #1a73e8;
  border-radius: 20px;
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.mode-label {
  white-space: nowrap;
}

/* 编辑状态指示器 */
.edit-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #e3f2fd;
  border-radius: 20px;
  color: #1976d2;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid #bbdefb;
}

.edit-text {
  font-size: 13px;
  font-weight: 500;
}

.cancel-edit-btn {
  width: 20px;
  height: 20px;
  min-height: 20px;
  color: #666;
}

.cancel-edit-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: #333;
}

/* 联网搜索按钮 */
.web-search-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border-radius: 20px;
  border: none;
  color: #3c4043;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
}

.web-search-btn:hover {
  background: #f8f9fa;
}

.web-search-btn.active {
  background: #e8f5e8;
  color: #34a853;
}

/* 控制图标按钮 */
.control-icon-btn {
  width: 36px;
  height: 36px;
  color: #5f6368;
  transition: all 0.2s ease;
}

.control-icon-btn:hover {
  background-color: rgba(95, 99, 104, 0.12);
  color: #3c4043;
}

.control-icon-btn.active {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1a73e8;
}

/* 公式插入按钮特殊样式 */
.formula-insert-btn {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  color: #1976d2;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.formula-insert-btn:hover {
  background: linear-gradient(135deg, #bbdefb 0%, #e1bee7 100%);
  color: #1565c0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 语音按钮特殊样式 */
.voice-btn.recording {
  color: #ea4335;
  background-color: rgba(234, 67, 53, 0.1);
}

.voice-btn.recording:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #3c4043;
}

.control-icon-btn.active {
  background: #e8f0fe;
  color: #1a73e8;
}

/* 发送按钮 */
.send-button {
  width: 40px;
  height: 40px;
  background: #1a73e8;
  color: white;
  transition: all 0.2s ease;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.1);
  border: none;
}

.send-button:hover {
  background: #1557b0;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px) scale(1.05);
}

.send-button:active {
  transform: translateY(0) scale(0.98);
}

.send-button:disabled {
  background: #e8eaed;
  color: #9aa0a6;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transform: none;
}

/* 插入公式按钮 */
.math-formula-btn {
  width: 40px;
  height: 40px;
  background: transparent;
  color: #1a73e8;
  border: 2px solid #1a73e8;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.math-formula-btn:hover {
  background: #1a73e8;
  color: white;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
  transform: translateY(-1px) scale(1.05);
}

.math-formula-btn:active {
  transform: translateY(0) scale(0.98);
}

/* 状态指示器 */
.status-indicators {
  display: flex;
  gap: 8px;
  padding: 0 4px;
  flex-wrap: wrap;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f1f3f4;
  border-radius: 12px;
  padding: 4px 8px;
  font-size: 12px;
  color: #5f6368;
}

.status-tag.search-enabled {
  background: #e8f5e8;
  color: #137333;
}

.status-tag.role-selected {
  background: #fce8e6;
  color: #c5221f;
}


/* 脉冲动画 */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* 平板优化 */
@media (min-width: 769px) and (max-width: 1024px) {
  .chat-input-wrapper {
    padding: 6px;
    border-radius: 20px;
  }
  
  .input-area {
    padding: 3px 5px;
    border-radius: 14px;
  }
  
  .control-icon-btn {
    width: 40px;
    height: 40px;
  }
  
  .math-formula-btn {
    width: 48px;
    height: 48px;
  }
  
  .send-button {
    width: 48px;
    height: 48px;
  }
  
  .main-textarea :deep(.q-field__native) {
    font-size: 17px;
    padding: 3px 0;
  }
  
  .control-bar {
    padding: 2px 0;
    gap: 18px;
  }
  
  .left-controls {
    gap: 14px;
  }
  
  .right-controls {
    gap: 8px;
  }
}

/* 手机响应式设计 */
@media (max-width: 768px) {
  .chat-input-wrapper {
    padding: 3px;
    border-radius: 16px;
    gap: 6px;
  }
  
  .input-area {
    padding: 2px 4px;
    border-radius: 12px;
  }
  
  .control-icon-btn {
    width: 32px;
    height: 32px;
  }
  
  .math-formula-btn {
    width: 40px;
    height: 40px;
  }
  
  .send-button {
    width: 40px;
    height: 40px;
  }
  
  .control-bar {
    padding: 1px 0;
    gap: 12px;
  }
  
  .left-controls {
    gap: 8px;
  }
  
  .right-controls {
    gap: 4px;
  }
  
  .mode-selector,
  .web-search-btn {
    padding: 4px 8px;
    font-size: 13px;
    max-width: 100px;
  }
  
  .content-canvas {
    font-size: 15px;
    padding: 6px 8px;
    min-height: 36px;
  }
  
  .formula-editor {
    min-width: 50px;
    min-height: 20px;
  }
}


/* 学习伙伴选择弹出框样式 */
.model-select-popup {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 9999;
}

.model-select-list {
  min-width: 120px;
  padding: 4px 0;
}

.model-select-item {
  padding: 8px 16px;
  min-height: 40px;
  transition: all 0.2s ease;
}

.model-select-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.model-select-item.active {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1976d2;
}

.model-select-item .q-item__label {
  font-size: 14px;
  font-weight: 500;
}


/* 减少动画效果 */
* {
  animation-duration: 0.2s !important;
  transition-duration: 0.2s !important;
}

/* 隐藏MathLive的所有装饰元素 */
.formula-editor :deep(.ML__base) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.formula-editor :deep(.ML__fieldcontainer) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.formula-editor :deep(.ML__field) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  min-height: auto !important;
}

.formula-editor :deep(.ML__caret) {
  display: none !important;
}

.formula-editor :deep(.ML__selection) {
  display: none !important;
}

.formula-editor :deep(.ML__virtual-keyboard-toggle) {
  display: none !important;
}

.formula-editor :deep(.ML__toolbar) {
  display: none !important;
}

.formula-editor :deep(.ML__popover) {
  display: none !important;
}


/* 桌面端优化 */
@media (min-width: 1025px) {

  
  .chat-input-wrapper {
    padding: 8px;
    border-radius: 20px;
  }
  
  .input-area {
    padding: 6px 8px;
  }
  
  .control-bar {
    padding: 4px 0;
    gap: 20px;
  }
  
  .left-controls {
    gap: 16px;
  }
  
  .right-controls {
    gap: 12px;
  }
  
  .control-icon-btn {
    width: 40px;
    height: 40px;
  }
  
  .math-formula-btn {
    width: 44px;
    height: 44px;
  }
  
  .send-button {
    width: 44px;
    height: 44px;
  }
}
</style>