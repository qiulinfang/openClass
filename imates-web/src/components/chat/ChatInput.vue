<template>
  <div class="modern-chat-container">
    <!-- 主容器上方扩展区域：顶部工具条 + 额外插槽内容 -->
    <div v-if="showToolbar" class="chat-input-header-flex">
      <!-- 顶层：允许整块头部完全自定义 -->
      <slot name="header-all">
        <!-- 默认实现：左 + 右 -->

        <!-- 左侧：顶部工具条 -->
        <div class="chat-input-header-left">
          <div class="chat-top-toolbar">
            <!-- 前置插槽：最前面的按钮，如“选中并问” -->
            <slot name="header-prefix"></slot>
            <!-- 默认中间工具条（公式 + 问老师） -->
            <slot name="header-middle">
              <!-- 公式 -->
              <button type="button" class="toolbar-btn" @click="handleFormulaTopClick">
                <img :src="formulaIcon" alt="公式" class="toolbar-icon" />
              </button>
              <!-- 问老师：仅在 AI 场景显示，老师答疑场景隐藏，作业场景也隐藏 -->
              <button
                v-if="props.type !== 'teacher' && !props.hideAskTeacherIcon"
                type="button"
                class="toolbar-btn"
                @click="handleAskTeacherClick"
              >
                <img :src="askTeacherIconToUse" alt="问老师" class="toolbar-icon" />
              </button>
            </slot>

            <!-- 后置插槽：工具条下方追加内容（说明文字等） -->
            <slot name="header-suffix"></slot>
          </div>
        </div>

        <!-- 右侧：额外 header 区域 -->
        <div class="chat-input-header-right">
          <slot name="header-right"></slot>
        </div>
      </slot>
    </div>

    <!-- 主容器 -->
    <div class="chat-input-wrapper" ref="inputAreaRef">
      <!-- 引用消息区域 -->
      <div v-if="props.quotedMessage" class="quote-bar">
        <div class="quote-content">
          <div class="quote-text">
            <span class="quote-message">{{
              truncateQuoteContent(props.quotedMessage.content)
            }}</span>
          </div>
        </div>
        <!-- 关闭引用按钮 -->
        <button type="button" class="quote-close" @click.stop="emit('remove-quote')">
          <q-icon name="close" size="16px" color="grey-6" />
        </button>
      </div>
      <!-- 截图缩略图（挂在输入框内左上角），支持多张 -->
      <div v-if="screenshotsToShow.length" class="screenshot-thumb-bar">
        <div
          v-for="shot in screenshotsToShow"
          :key="shot.id"
          class="screenshot-thumb-inner"
        >
          <ScreenshotThumb
            :image-url="shot.dataUrl"
            :show-delete="true"
            @click="handleScreenshotThumbClick(shot)"
            @remove="emit('remove-screenshot', shot.id)"
          />
        </div>
      </div>
      <!-- 新的MathFormulaEditor输入区域 -->
      <div class="unified-input-area">
        <MathFormulaEditor
          ref="mathEditorRef"
          v-model="editorContent"
          :placeholder="props.placeholderText || '请输入要问的问题'"
          :disabled="props.isLoading"
          :max-height="'200px'"
          @focus="handleEditorFocus"
          @blur="handleEditorBlur"
          @keydown="handleEditorKeydown"
          @edit-formula="handleEditFormulaFromEditor"
          @update:modelValue="handleEditorUpdate"
        />
      </div>

      <Modal
        v-model="showFormulaModal"
        title="公式编辑"
        :showFooter="true"
        confirmText="插入"
        cancelText="取消"
        :initialWidth="980"
        :initialHeight="680"
        :minWidth="400"
        :minHeight="300"
        :zIndex="111111"
        @confirm="handleInsertFormulaFromDialog"
        @cancel="handleCancelFormulaDialog"
      >
        <HighSchoolMathEditor v-model="formulaDialogValue" />
      </Modal>

      <!-- 控制栏 -->
      <div class="control-bar">
        <!-- 左侧控制组 -->
        <div class="left-controls">
          <!-- 编辑状态指示器 -->
          <div v-if="props.isEditing" class="edit-indicator">
            <q-icon name="edit" color="primary" size="16px" />
            <span class="edit-text">编辑消息</span>
            <button @click.stop="handleCancelEdit" class="cancel-edit-btn" type="button">
              <q-icon name="close" color="grey-6" size="16px" />
              <q-tooltip>取消编辑</q-tooltip>
            </button>
          </div>

          <!-- 四个功能按钮：仅在非编辑状态下显示 -->
          <template v-if="!props.isEditing">
            <!-- 模式选择器（同桌按钮）- 仅在AI通用、AI题目和AI教材模式下显示 -->
            <BubblePopup
              v-if="
                props.type === 'ai-general' ||
                props.type === 'ai-exercise' ||
                props.type === 'ai-textbook'
              "
              v-model="showModeSelectorMenu"
              placement="top"
              :offset="8"
            >
              <template #trigger>
                <button
                  class="action-mode-btn"
                  :class="{ active: true }"
                >
                  <img
                    :src="getModelIcon(props.selectedModel)"
                    :alt="getModelDisplayName(props.selectedModel)"
                    style="width: 18px; height: 18px"
                  />
                  <span>{{ getModelDisplayName(props.selectedModel) }}</span>
                </button>
              </template>
              <ActionList :items="modelActionItems" />
            </BubblePopup>

            <!-- 联网搜索按钮 - 使用顶部同款搜索图标 -->
            <button
              class="toolbar-btn"
              @click="handleToggleWebSearch"
              v-if="
                props.type === 'ai-general' ||
                props.type === 'ai-exercise' ||
                props.type === 'ai-textbook'
              "
            >
              <img :src="onlineSearchIconToUse" alt="互联网搜索" class="toolbar-icon" />
            </button>
          </template>
        </div>

        <!-- 右侧控制组 -->
        <div class="right-controls">

          <!-- 图片上传 - 在 ai-general 和 user-client 场景下显示 -->
          <button
            v-if="props.type === 'ai-general' || props.type === 'user-client' || props.type === 'teacher'"
            type="button"
            @click="handleShowImagePicker"
            class="control-icon-btn"
            :class="{ active: props.activeMode?.label === '图片模式' }"
          >
            <img :src="picturIcon" alt="添加图片" class="control-icon" />
            <q-tooltip>添加图片</q-tooltip>
          </button>


          <!-- 发送按钮（外层透明点击区域更大，内部视觉尺寸不变） -->
          <div class="send-button-hit-area" @click="handleSendButtonHitAreaClick">
            <button
              type="button"
              :disabled="!props.canSend || props.isLoading"
              class="send-button"
              :class="{
                // 只要可以发送（非 loading），无论是否编辑模式，都使用同一个高亮样式
                'send-button--enabled': !props.isLoading && (props.canSend || props.isEditing),
                'send-button--disabled': props.isLoading || (!props.canSend && !props.isEditing),
              }"
            >
              <!-- 加载状态图标 -->
              <img
                v-if="props.isLoading"
                :src="waitingIcon"
                alt="等待中"
                class="send-loading-icon"
              />
              <!-- 编辑状态图标 -->
              <img v-else-if="props.isEditing" :src="sendIcon" alt="发送" class="send-icon" />
              <!-- 自定义发送图标 -->
              <img v-else :src="sendIcon" alt="发送" class="send-icon" />
              <q-tooltip v-if="props.isEditing">更新消息</q-tooltip>
              <q-tooltip v-else>发送消息</q-tooltip>
            </button>
          </div>
        </div>
      </div>

      
    </div>
    <!-- 图片预览对话框（仅在 ChatInput 内部使用） -->
    <ImageViewer
      v-model="imageViewerVisible"
      :image-url="imageViewerUrl"
      alt="截图预览"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { AI_ROLE_OPTIONS } from '../../constants/options'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import MathFormulaEditor from '../MathFormulaEditor.vue'
import HighSchoolMathEditor from '../HighSchoolMathEditor.vue'
import Modal from '../base/Modal.vue'
import ImageViewer from '../ImageViewer.vue'
import ScreenshotThumb from '../ScreenshotThumb.vue'
import BubblePopup from '../base/Popover.vue'
import ActionList from '../ActionList.vue'
import waitingIcon from '/icons/waiting.svg'
import sendIcon from '/icons/send.svg'
import DeskmateIcon from '/icons/Deskmate.svg'
import RepresentativeIcon from '/icons/Representative.svg'
import GuruIcon from '/icons/Guru.svg'
// 顶部工具条图标
import onlineSearchIcon from '/icons/onlineSearch.svg' // 搜索
import selectAndAskIcon from '/icons/selectAndAsk.svg' // 选中并问
import formulaIcon from '/icons/formula.svg' // 公式
import askTeacherIcon from '/icons/askTeacher.svg' // 问老师
import onlineSearchIconSelected from '/icons/onlineSearch_select.svg' // 搜索选中
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg' // 选中并问选中
import formulaIconSelected from '/icons/formula_select.svg' // 公式选中
import askTeacherIconSelected from '/icons/askTeacher_select.svg' // 问老师选中
import picturIcon from '/icons/picture.svg' // 图片上传
import type { ContentBlock } from '../../types'
import type { AttachedScreenshot } from '@/types'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  placeholderText: {
    type: String,
    required: true,
  },
  isLoading: {
    type: Boolean,
    required: true,
  },
  enableWebSearch: {
    type: Boolean,
    required: true,
  },
  selectedModel: {
    type: String,
    required: true,
  },
  type: {
    type: String as () =>
      | 'ai-general'
      | 'ai-exercise'
      | 'ai-textbook'
      | 'teacher'
      | 'user-client',
    required: true,
  },
  uploadedFiles: {
    type: Array,
    required: true,
  },
  activeMode: {
    type: Object,
    required: false,
    default: null,
  },
  hideAskTeacherIcon: {
    type: Boolean,
    required: false,
    default: false,
  },
  canSend: {
    type: Boolean,
    required: true,
  },
  isEditing: {
    type: Boolean,
    default: false,
  },
  editingMessageId: {
    type: String as () => string | null,
    default: null,
  },
  // 你原来额外加的两个
  attachedScreenshot: {
    type: Object as () =>
      | {
          dataUrl: string
          width: number
          height: number
        }
      | undefined,
    default: undefined,
  },
  // 新增：支持多张截图缩略图
  attachedScreenshots: {
    type: Array as () => AttachedScreenshot[],
    default: () => [],
  },
  quotedMessage: {
    // 关键：这里显式声明 quotedMessage
    type: Object as () => import('../../types').ChatBubble | null | undefined,
    default: null,
  },
  showToolbar: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits({
  'update:modelValue': (value: string) => true,
  'send-message': () => true,
  'add-new-line': () => true,
  'input-focus': () => true,
  'input-blur': () => true,
  'show-image-picker': () => true,
  'toggle-web-search': () => true,
  'scroll-to-bottom': () => true,
  'update:selected-model': (_value: string) => true,
  'remove-file': (_id: string) => true,
  'upload-file': () => true,
  'cancel-edit': () => true,
  focus: () => true,
  blur: () => true,
  'remove-screenshot': (_id: string) => true,
  'send-with-screenshot': (_shots: AttachedScreenshot[]) => true,
  'edit-screenshot': (_id: string) => true,
  'remove-quote': () => true,
  // 顶部工具条相关事件，供上层接入真实行为
  'explore-click': () => true,
  'formula-click': () => true,
  'ask-teacher-click': (_payload?: { mode?: string }) => true,
})

// 统一的截图列表：完全由 props 决定
// - 优先使用 attachedScreenshots（多张）
// - 兼容旧的单张 attachedScreenshot
const screenshotsToShow = computed<AttachedScreenshot[]>(() => {
  if (Array.isArray(props.attachedScreenshots) && props.attachedScreenshots.length > 0) {
    return props.attachedScreenshots
  }

  if (props.attachedScreenshot) {
    return [
      {
        id: 'legacy-single',
        dataUrl: props.attachedScreenshot.dataUrl,
        width: props.attachedScreenshot.width,
        height: props.attachedScreenshot.height,
      },
    ]
  }

  return []
})

// 截断引用内容，最多显示50个字符
const truncateQuoteContent = (content: string): string => {
  if (!content) return ''
  // 移除HTML标签和多余空白
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plainText.length <= 50) return plainText
  return plainText.substring(0, 50) + '...'
}

// 新的编辑器相关状态
const inputAreaRef = ref<HTMLElement>()
const editorContent = ref<string>('')
const isEditorFocused = ref(false)
const mathEditorRef = ref<InstanceType<typeof MathFormulaEditor>>()

const showFormulaModal = ref(false)
const formulaDialogValue = ref('')
const editingFormulaIndex = ref<number | null>(null)

// 响应式宽度
const isNarrow = ref(false)

// 顶部工具条本地选中状态
const isOnlineSearchSelected = ref(false)
const isFormulaSelected = ref(false)
const isAskTeacherSelected = ref(false)

// 本地图片预览状态（不透传给父组件）
const imageViewerVisible = ref(false)
const imageViewerUrl = ref('')

const openScreenshotPreview = (url: string) => {
  imageViewerUrl.value = url
  imageViewerVisible.value = true
}

const handleScreenshotThumbClick = (shot: AttachedScreenshot) => {
  if (!shot?.id) return

  // 教材场景：点缩略图进入编辑（由上层 ChatView 统一弹 ScreenshotInputDialog 并同步 store）
  if (props.type === 'ai-textbook') {
    emit('edit-screenshot', shot.id)
    return
  }

  // 其它场景：保持原有行为（预览）
  openScreenshotPreview(shot.dataUrl)
}

// 联网搜索图标：当前只使用普通态图标
const onlineSearchIconToUse = computed(() =>
  isOnlineSearchSelected.value ? onlineSearchIconSelected : onlineSearchIcon
)
// 问老师图标：当前只使用普通态图标
const askTeacherIconToUse = computed(() =>
  isAskTeacherSelected.value ? askTeacherIconSelected : askTeacherIcon
)

// 调试：监控 quotedMessage 变化
watch(
  () => props.quotedMessage,
  (newVal) => {
    console.log('[ChatInput] quotedMessage 变化:', newVal)
  },
  { immediate: true }
)

onMounted(() => {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      isNarrow.value = entry.contentRect.width < 500
    }
  })

  if (inputAreaRef.value) {
    observer.observe(inputAreaRef.value)
  }

  onUnmounted(() => {
    if (inputAreaRef.value) {
      observer.unobserve(inputAreaRef.value)
    }
  })
})

// 模式选择器菜单显示状态
const showModeSelectorMenu = ref(false)

// 保留原有的复杂状态用于向后兼容（如果需要）
const contentCanvasRef = ref<HTMLElement>()
const contentBlocks = ref<ContentBlock[]>([])
const currentEditingFormula = ref<ContentBlock | null>(null)
const formulaRefs = ref<Map<string, HTMLElement>>(new Map())
const mathfields = ref<Map<string, unknown>>(new Map())
const selectedBlockIndex = ref<number>(-1)
const isKeyboardTransitioning = ref(false)
const isPlaceholderClicked = ref(false)
const isReadyForTextInput = ref(false)

// 消息渲染器
const { renderMessageContent } = useMessageRenderer()

const currentInputValue = computed(() => {
  return editorContent.value
})

// 编辑器事件处理
const handleEditorFocus = () => {
  console.log('[ChatInput][Keyboard] editor focus')
  isEditorFocused.value = true
  emit('focus')
}

const handleEditorBlur = () => {
  console.log('[ChatInput][Keyboard] editor blur')
  isEditorFocused.value = false
  emit('blur')
}

const handleEditorKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    console.log('[ChatInput][Keyboard] Enter pressed without Shift -> sendMessage')
    handleSendMessage()
  }
}

const handleEditorUpdate = (content: string) => {
  editorContent.value = content
  emit('update:modelValue', content)
}

// 学习伙伴角色选项
const aiRoleOptions = AI_ROLE_OPTIONS

// 根据选择的模式获取显示名称
const getModelDisplayName = (model: string) => {
  const option = aiRoleOptions.find((opt) => opt.value === model)
  return option ? option.label : '同桌'
}

// 根据模式值获取对应的图标
const getModelIcon = (model: string) => {
  const iconMap: Record<string, string> = {
    mate: DeskmateIcon,
    mentor: RepresentativeIcon,
    researcher: GuruIcon,
  }
  return iconMap[model] || DeskmateIcon
}

// 适配到通用 ActionList 的 items 结构
const modelActionItems = computed(() =>
  aiRoleOptions.map((option) => ({
    key: option.value,
    label: option.label,
    icon: getModelIcon(option.value),
    visible: true,
    // 当前选中的模型可以通过样式在 ActionList 里用 :class 实现，这里逻辑上始终可点击
    onClick: () => selectModel(option.value),
  }))
)

// 切换模式选择器菜单
const toggleModeSelector = (event?: Event) => {
  // 阻止事件冒泡
  if (event) {
    event.stopPropagation()
  }
  showModeSelectorMenu.value = !showModeSelectorMenu.value
}

// 选择模型
const selectModel = (model: string) => {
  emit('update:selected-model', model)
  showModeSelectorMenu.value = false
}

// 取消编辑处理
const handleCancelEdit = () => {
  emit('cancel-edit')
}

// 切换联网搜索处理
const handleToggleWebSearch = () => {
  isOnlineSearchSelected.value = !isOnlineSearchSelected.value
  emit('toggle-web-search')
}


// 顶部“公式”按钮：沿用原有插入公式逻辑，并发事件
const handleFormulaTopClick = () => {
  isFormulaSelected.value = !isFormulaSelected.value
  formulaDialogValue.value = ''
  editingFormulaIndex.value = null
  showFormulaModal.value = true
  emit('formula-click')
}

const handleEditFormulaFromEditor = (payload: { latex: string; index: number | null }) => {
  formulaDialogValue.value = (payload?.latex || '').trim()
  editingFormulaIndex.value = typeof payload?.index === 'number' ? payload.index : null
  showFormulaModal.value = true
}

const handleInsertFormulaFromDialog = async () => {
  // 等待一个 tick，确保 HighSchoolMathEditor 的 emit 已经同步
  await nextTick()
  
  const latex = (formulaDialogValue.value || '').trim()
  console.log('[ChatInput] 确认插入公式，当前 formulaDialogValue:', latex)
  
  if (!mathEditorRef.value) {
    console.log('[ChatInput] mathEditorRef 不存在')
    editingFormulaIndex.value = null
    showFormulaModal.value = false
    return
  }
  const editorAny = mathEditorRef.value as any

  // 编辑已有公式时：若 latex 为空，视为删除该公式块
  if (!latex && editingFormulaIndex.value !== null) {
    console.log('[ChatInput] LaTeX 为空，删除公式块，索引:', editingFormulaIndex.value)
    if (typeof editorAny.deleteMathFieldAt === 'function') {
      editorAny.deleteMathFieldAt(editingFormulaIndex.value)
    } else if (typeof editorAny.replaceMathFieldAt === 'function') {
      // 兜底：若没有删除方法，则退化为不操作
      console.warn('[ChatInput] deleteMathFieldAt 不存在，无法删除公式块')
    }
    editingFormulaIndex.value = null
    showFormulaModal.value = false
    emit('scroll-to-bottom')
    return
  }

  // 插入新公式时：latex 为空则直接关闭
  if (!latex) {
    console.log('[ChatInput] LaTeX 为空，关闭弹窗')
    editingFormulaIndex.value = null
    showFormulaModal.value = false
    return
  }

  // 若来自"点击已有公式"，则原位替换
  if (editingFormulaIndex.value !== null && typeof editorAny.replaceMathFieldAt === 'function') {
    console.log('[ChatInput] 替换公式，索引:', editingFormulaIndex.value, 'LaTeX:', latex)
    editorAny.replaceMathFieldAt(editingFormulaIndex.value, latex)
    editingFormulaIndex.value = null
    showFormulaModal.value = false
    emit('scroll-to-bottom')
    return
  }

  if (typeof editorAny.insertMathField !== 'function') {
    console.log('[ChatInput] insertMathField 方法不存在')
    editingFormulaIndex.value = null
    showFormulaModal.value = false
    return
  }
  try {
    console.log('[ChatInput] 插入新公式，LaTeX:', latex)
    editorAny.insertMathField(latex)
    editingFormulaIndex.value = null
    showFormulaModal.value = false
    emit('scroll-to-bottom')
  } catch (error) {
    console.error('[ChatInput] 插入数学公式失败:', error)
    editingFormulaIndex.value = null
    showFormulaModal.value = false
  }
}

const handleCancelFormulaDialog = () => {
  editingFormulaIndex.value = null
  showFormulaModal.value = false
}

const handleAskTeacherClick = () => {
  isAskTeacherSelected.value = !isAskTeacherSelected.value
  emit('ask-teacher-click', { mode: 'ask-teacher' }) // 传递问老师模式参数
}

// 显示图片选择器处理
const handleShowImagePicker = () => {
  emit('show-image-picker')
}

// 发送按钮外层点击区域处理：仅在可发送且未 loading 时触发发送
const handleSendButtonHitAreaClick = () => {
  if (!props.canSend || props.isLoading) {
    return
  }
  handleSendMessage()
}

// 麦克风按钮点击处理
const handleMicButtonClick = () => {
  // 注意：此功能可能尚未实现，仅记录日志
}


// 完成公式编辑
const finishFormulaEditing = async (blockId: string) => {
  // 1. 获取MathLive实例
  const mathfield = mathfields.value.get(blockId) as HTMLElement
  if (!mathfield) {
    return
  }

  // 2. 获取公式内容
  const content = (mathfield as { value?: string }).value || ''

  // 3. 开始退出动画
  isKeyboardTransitioning.value = true
  mathfield.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  mathfield.style.opacity = '0'
  mathfield.style.transform = 'translateY(-5px)'

  // 4. 等待动画完成
  setTimeout(() => {
    // 5. 检查组件挂载状态
    if (!contentCanvasRef.value) {
      return
    }

    // 6. 处理公式块保存
    if (currentEditingFormula.value && currentEditingFormula.value.id === blockId) {
      // 6.1 检查内容是否为空
      if (!content.trim()) {
        currentEditingFormula.value = null
        return
      }

      // 6.2 创建新的公式块
      const formulaBlock: ContentBlock = {
        id: blockId,
        type: 'formula',
        content: content,
        renderedContent: content ? renderMessageContent(content) : '',
        isEditing: false,
      }

      // 6.3 添加到内容块列表
      contentBlocks.value.push(formulaBlock)
      currentEditingFormula.value = null
    } else {
      // 6.3 更新现有公式块
      const blockIndex = contentBlocks.value.findIndex((block) => block.id === blockId)
      if (blockIndex !== -1) {
        contentBlocks.value[blockIndex].content = content
        contentBlocks.value[blockIndex].renderedContent = content
          ? renderMessageContent(content)
          : ''
        contentBlocks.value[blockIndex].isEditing = false
      } else {
      }
    }

    // 7. 清理MathLive实例
    cleanupMathLiveInstance(mathfield, blockId)

    // 8. 更新modelValue
    const newModelValue = currentInputValue.value
    emit('update:modelValue', newModelValue)

    // 9. 重置键盘切换状态
    isKeyboardTransitioning.value = false
  }, 200)
}

// 清理MathLive实例
const cleanupMathLiveInstance = (mathfield: HTMLElement, blockId: string) => {
  // 1. 从DOM中移除元素
  try {
    if (mathfield && typeof mathfield.remove === 'function') {
      mathfield.remove()
    }
  } catch {
    // 忽略错误
  }

  // 2. 从引用映射中删除
  mathfields.value.delete(blockId)
}

// 清理所有MathLive实例
const cleanupAllMathLiveInstances = () => {
  // 1. 遍历所有MathLive实例
  mathfields.value.forEach((mathfield: unknown) => {
    try {
      if (
        mathfield &&
        typeof mathfield === 'object' &&
        'remove' in mathfield &&
        typeof (mathfield as { remove?: () => void }).remove === 'function'
      ) {
        ;(mathfield as { remove: () => void }).remove()
      }
    } catch {}
  })

  // 2. 清空引用映射
  mathfields.value.clear()
  formulaRefs.value.clear()
}

// 发送消息标志，防止键盘关闭事件干扰发送
const isSendingMessage = ref(false)

// 发送消息处理
const handleSendMessage = () => {
  console.log('[ChatInput][Keyboard] handleSendMessage start')
  // 1. 设置发送标志，防止键盘关闭事件干扰
  isSendingMessage.value = true

  // 2. 调用 MathFormulaEditor 的 getMarkdownContent 方法获取完整内容
  const markdownContent = mathEditorRef.value?.getMarkdownContent()

  // 3. 检查内容是否为空
  if (!markdownContent || !markdownContent.trim()) {
    console.log('[ChatInput][Keyboard] handleSendMessage aborted: empty content')
    isSendingMessage.value = false
    return
  }
  // 4. 更新 v-model 的值，将完整的 markdown 内容传递给父组件
  emit('update:modelValue', markdownContent)

  // 5. 先发送消息，然后再关闭键盘
  nextTick(() => {
    // 有挂起截图时，优先走截图发送通道
    if (screenshotsToShow.value.length > 0) {
      emit('send-with-screenshot', screenshotsToShow.value)
    } else {
      emit('send-message')
    }
    clearInputContent()

    // 延迟一小段时间后关闭键盘，确保消息已发送
    setTimeout(() => {
      console.log('[ChatInput][Keyboard] handleSendMessage -> blur editor to close keyboard')
      // 让编辑器失焦，触发键盘关闭
      if (mathEditorRef.value) {
        const editorElement =
          mathEditorRef.value.$el?.querySelector?.('.ql-editor') ||
          mathEditorRef.value.$el?.querySelector?.('[contenteditable]')
        if (editorElement) {
          editorElement.blur()
        }
      }

      // 确保当前焦点元素失焦
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && activeElement !== document.body && activeElement.blur) {
        activeElement.blur()
      }

      // 清除发送标志
      isSendingMessage.value = false
    }, 50)
  })
}

// 清空输入内容
const clearInputContent = () => {
  // 1. 调用 MathFormulaEditor 的清空方法
  if (mathEditorRef.value) {
    mathEditorRef.value.clearContent()
  }

  // 2. 确保父组件的 v-model 也被清空
  emit('update:modelValue', '')

  // 3. 清理所有MathLive实例（向后兼容）
  cleanupAllMathLiveInstances()

  // 4. 清空内容块（向后兼容）
  contentBlocks.value = []

  // 5. 清空当前编辑公式（向后兼容）
  currentEditingFormula.value = null

  // 6. 重置选中状态（向后兼容）
  selectedBlockIndex.value = -1

  // 7. 重置键盘切换状态（向后兼容）
  isKeyboardTransitioning.value = false

  // 8. 重置文本输入准备状态（向后兼容）
  isReadyForTextInput.value = false

  // 9. 重置占位符状态（向后兼容）
  isPlaceholderClicked.value = false
}

// 监听modelValue变化，同步到编辑器
watch(
  () => props.modelValue,
  (newValue) => {
    // 1. 检查值是否有效且与当前编辑器内容不同
    if (newValue !== editorContent.value) {
      editorContent.value = newValue || ''
    }
  },
  { immediate: true }
)

const handleNativeKeyboardClose = () => {
  console.log('[ChatInput][Keyboard] nativeKeyboardClose event received', {
    isSendingMessage: isSendingMessage.value,
  })
  // 如果正在发送消息，跳过处理，避免干扰发送流程
  if (isSendingMessage.value) {
    console.log('[ChatInput][Keyboard] nativeKeyboardClose skipped because isSendingMessage=true')
    return
  }

  // 检查是否有正在编辑的公式
  if (currentEditingFormula.value) {
    // 如果有，则完成编辑
    finishFormulaEditing(currentEditingFormula.value.id)
  }

  // 让主输入区域失焦
  if (contentCanvasRef.value) {
    console.log('[ChatInput][Keyboard] nativeKeyboardClose -> blur contentCanvas')
    contentCanvasRef.value.blur()
  }
}

const handleFormulaEnterPressed = () => {
  // 延迟发送消息，确保公式编辑完成
  setTimeout(() => {
    handleSendMessage()
  }, 100)
}

const handleFormulaContentUpdated = (event: Event) => {
  const customEvent = event as CustomEvent
  const { nodeId, content } = customEvent.detail

  // 更新当前编辑公式的内容
  if (currentEditingFormula.value && currentEditingFormula.value.id === nodeId) {
    currentEditingFormula.value.content = content
  }
}

const handleFormulaCancelEdit = (event: Event) => {
  const customEvent = event as CustomEvent
  const { nodeId } = customEvent.detail

  // 取消当前编辑状态
  if (currentEditingFormula.value && currentEditingFormula.value.id === nodeId) {
    currentEditingFormula.value = null
    isKeyboardTransitioning.value = false
  }
}

// 生命周期
onMounted(() => {
  // 1. 初始化编辑器内容
  if (props.modelValue) {
    editorContent.value = props.modelValue
  } else {
  }

  // 2. 添加键盘关闭监听器
  window.addEventListener('nativeKeyboardClose', handleNativeKeyboardClose)

  // 3. 添加公式回车键监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-enter-pressed', handleFormulaEnterPressed)

  // 4. 添加公式内容更新监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-content-updated', handleFormulaContentUpdated)

  // 5. 添加公式取消编辑监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-cancel-edit', handleFormulaCancelEdit)
})

onUnmounted(() => {
  // 1. 清理编辑器内容
  editorContent.value = ''

  // 2. 清理编辑状态（向后兼容）
  currentEditingFormula.value = null

  // 3. 清理所有MathLive实例（向后兼容）
  cleanupAllMathLiveInstances()

  // 4. 清理内容块（向后兼容）
  contentBlocks.value = []
  selectedBlockIndex.value = -1

  // 5. 重置其他状态（向后兼容）
  isReadyForTextInput.value = false
  isKeyboardTransitioning.value = false
  isPlaceholderClicked.value = false

  // 6. 移除键盘关闭监听器
  window.removeEventListener('nativeKeyboardClose', handleNativeKeyboardClose)

  // 7. 移除公式回车键监听器
  window.removeEventListener('formula-enter-pressed', handleFormulaEnterPressed)

  // 8. 移除公式内容更新监听器
  window.removeEventListener('formula-content-updated', handleFormulaContentUpdated)

  // 9. 移除公式取消编辑监听器
  window.removeEventListener('formula-cancel-edit', handleFormulaCancelEdit)
})

// 暴露方法给父组件
defineExpose({
  clearInputContent,
  focus: () => {
    if (mathEditorRef.value) {
      mathEditorRef.value.focus()
    }
  },
})
</script>

<style scoped>
/* 顶部区域整体：左右分布 */
.chat-input-header-flex {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: -4px;
}

.chat-input-header-left {
  flex: 1 1 auto;
  min-width: 0;
}

.chat-input-header-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* 顶部工具条样式 */
.chat-top-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 8px;
}

.toolbar-btn {
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border: none;
  cursor: pointer;
}

.toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
}

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

/* 主容器 - 白色背景，紫色边框的圆角矩形 */
.chat-input-wrapper {
  border-radius: 16px;
  /* 使用透明边框 + 多重背景实现渐变描边 */
  border: 2px solid transparent;
  background:
    /* 内层：白色填充区域 */ linear-gradient(#ffffff, #ffffff) padding-box,
    /* 外层：紫色渐变描边 */ linear-gradient(90deg, #7a7cff, #b57cff) border-box;
  padding: 8px 12px;
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

.screenshot-thumb-bar {
  padding: 0px 6px;
  display: flex;
  flex-direction: row;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  /* 避免出现滚动条时影响布局 */
  scrollbar-width: thin;
}

.screenshot-thumb-inner {
  position: relative;
  width: 72px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.08);
  flex: 0 0 auto; 
}
.screenshot-thumb-img {
  width: 72px;
  height: 48px;
  object-fit: cover;
}

.screenshot-thumb-close {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

/* 引用消息区域样式 */
.quote-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5f5f7;
  border-radius: 8px;
  margin-bottom: 4px;
}

.quote-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 8px;
}

.quote-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.quote-message {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.quote-close:hover {
  background: rgba(0, 0, 0, 0.08);
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
  min-height: 21px;
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
  padding: 0;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border-top: none;
  margin-top: 8px;
  padding-top: 8px;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  flex-wrap: wrap;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  min-height: 20px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.cancel-edit-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: #333;
}

/* 功能按钮样式 - 统一的按钮样式 */
.action-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f5f5f5;
  border-radius: 10px;
  border: none;
  color: #666666;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  font-weight: 600;
}

.action-mode-btn:hover {
  background: #eeeeee;
  color: #333333;
}

.action-mode-btn.active {
  background: #e5e6ff;
  color: #5e80fe;
}

.action-mode-btn:active {
  transform: scale(0.95);
}

/* 联网搜索按钮（保留向后兼容） */
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

/* 控制图标 */
.control-icon {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

/* 控制图标按钮 */
.control-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #5f6368;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
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


.control-icon-btn.active {
  background: #e8f0fe;
  color: #1a73e8;
}

/* 发送按钮外层点击区域：扩大可点击范围但不改变内部按钮视觉尺寸 */
.send-button-hit-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 16px; /* 四周增加少量透明点击区域 */
  /* 使用负 margin 抵消 padding 对布局高度的影响，避免撑高整个输入区域 */
  margin: -16px -16px;
}


/* 发送按钮 - 浅紫色圆圈 */
.send-button {
  width: 36px;
  height: 36px;
  transition: all 0.2s ease;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(122, 124, 255, 0.3), 0 1px 2px rgba(122, 124, 255, 0.2);
  border: none;
  margin-right: 5px; /* 右侧 margin */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 可发送时的按钮样式 */
.send-button--enabled {
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(122, 124, 255, 0.3), 0 1px 2px rgba(122, 124, 255, 0.2);
}

.send-button--enabled:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(122, 124, 255, 0.4), 0 2px 4px rgba(122, 124, 255, 0.3);
  transform: translateY(-1px) scale(1.05);
}

.send-button--enabled:active {
  transform: translateY(0) scale(0.98);
}

.send-button:disabled {
  background: #e8eaed;
  color: #9aa0a6;
  box-shadow: 0 1px 2px rgba(122, 124, 255, 0.1);
  transform: none;
}

/* 发送图标样式 */
.send-icon {
  width: 20px;
  height: 20px;
  display: block;
  transition: all 0.2s ease;
  object-fit: contain;
}

/* 当按钮可发送时，图标为紫色 */
.send-button--enabled .send-icon {
  filter: brightness(0) saturate(100%) invert(48%) sepia(96%) saturate(2742%) hue-rotate(236deg)
    brightness(105%) contrast(101%);
}

/* 当按钮禁用时，图标为灰色 */
.send-button:disabled .send-icon {
  filter: brightness(0) saturate(100%) invert(65%) sepia(8%) saturate(200%) hue-rotate(169deg)
    brightness(95%) contrast(90%);
}

/* 加载状态图标样式 */
.send-loading-icon {
  width: 20px;
  height: 20px;
  display: block;
  object-fit: contain;
  filter: brightness(0) saturate(100%) invert(48%) sepia(96%) saturate(2742%) hue-rotate(236deg)
    brightness(105%) contrast(101%);
}

/* 加载图标旋转动画 */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 插入公式按钮 - 与其他控制按钮样式一致 */
.math-formula-btn {
  width: 36px;
  height: 36px;
  color: #5f6368;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
}

.math-formula-btn:hover {
  background-color: rgba(95, 99, 104, 0.12);
  color: #3c4043;
}

.math-formula-btn:active {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1a73e8;
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
  0%,
  100% {
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
    width: 44px;
    height: 44px;
    margin-right: 5px; /* 右侧 margin */
  }

  .mic-btn {
    width: 48px;
    height: 48px;
  }

  .mic-btn :deep(.q-icon) {
    font-size: 28px; /* 图标更大 */
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
    width: 36px;
    height: 36px;
    margin-right: 5px; /* 右侧 margin */
  }

  .mic-btn {
    width: 40px;
    height: 40px;
  }

  .mic-btn :deep(.q-icon) {
    font-size: 24px; /* 图标更大 */
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
  z-index: 10004 !important; /* 确保在拍照搜题场景中不被遮挡 */
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
    width: 40px;
    height: 40px;
    margin-right: 5px; /* 右侧 margin */
  }

  .mic-btn {
    width: 44px;
    height: 44px;
  }

  .mic-btn :deep(.q-icon) {
    font-size: 26px; /* 图标更大 */
  }
}
</style>