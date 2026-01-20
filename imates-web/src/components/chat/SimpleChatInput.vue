<template>
  <div>
    <!-- 顶部可自定义区域（左对齐，宽度由内容决定） -->
    <div class="simple-chat-top-slot">
      <slot name="top"></slot>
    </div>

    <div class="input-row">
    <!-- 前置插槽：用于在输入框前放置操作按钮（例如 PhotoSearchView 的按钮组） -->
    <div class="input-prefix">
      <slot name="header-prefix"></slot>
    </div>
    <div class="simple-chat-input-wrapper">
      <!-- 模式选择器（与 ChatInput.vue 相同实现） -->
      <BubblePopup v-model="showModeSelectorMenu" placement="top" :offset="8">
        <template #trigger>
          <button class="action-mode-btn" :class="{ active: true }" type="button" @click="toggleModeSelector">
            <img :src="getModelIcon(props.selectedModel)" :alt="getModelDisplayName(props.selectedModel)"
              style="width: 18px; height: 18px" />
            <span>{{ getModelDisplayName(props.selectedModel) }}</span>
          </button>
        </template>
        <ActionList :items="modelActionItems" />
      </BubblePopup>

      <div class="input-area">
        <input ref="inputRef" v-model="localInputValue" class="simple-chat-input" type="text" :placeholder="placeholder"
          @keydown.enter.prevent="handleEnter" @focus="handleFocus" @blur="handleBlur" />
      </div>

      <div class="right-actions">
        <button type="button" class="simple-send-btn" :disabled="!localInputValue.trim() || isLoading"
          @click="handleSend">
          <q-icon :name="isLoading ? 'hourglass_empty' : 'send'" size="18px" color="white" />
        </button>
      </div>
    </div>
    </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent } from 'vue'
const BubblePopup = defineAsyncComponent(() => import('../base/Popover.vue'))
const ActionList = defineAsyncComponent(() => import('../ActionList.vue'))
const DeskmateIcon = '/icons/Deskmate.svg'
const RepresentativeIcon = '/icons/Representative.svg'
const GuruIcon = '/icons/Guru.svg'

// Props
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    isLoading?: boolean
    selectedModel?: string
  }>(),
  {
    placeholder: '输入你的问题',
    isLoading: false,
    selectedModel: 'mate',
  }
)

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [message: string]
  focus: []
  blur: []
  mic: []
  'update:selected-model': [value: string]
}>()

// 本地输入值
const localInputValue = ref(props.modelValue)
const inputRef = ref<HTMLInputElement>()

// 模式选择器相关（复用 ChatInput 的简化逻辑）
const showModeSelectorMenu = ref(false)

const aiRoleOptions = [
  { label: '同桌', value: 'mate' },
  { label: '课代表', value: 'mentor' },
  { label: '大神', value: 'researcher' },
]

const getModelDisplayName = (model: string) => {
  const option = aiRoleOptions.find((opt) => opt.value === model)
  return option ? option.label : '同桌'
}

// 使用项目内 svg 图标与 ChatInput 一致
const getModelIcon = (model: string) => {
  const iconMap: Record<string, string> = {
    mate: DeskmateIcon,
    mentor: RepresentativeIcon,
    researcher: GuruIcon,
  }
  return iconMap[model] || DeskmateIcon
}

const modelActionItems = computed(() =>
  aiRoleOptions.map((option) => ({
    key: option.value,
    label: option.label,
    icon: getModelIcon(option.value),
    visible: true,
    onClick: () => {
      selectModel(option.value)
    },
  }))
)

// 如果 BubblePopup 的内部 trigger 点击未生效，提供一个备选的切换函数直接由按钮调用
const toggleModeSelector = (event?: Event) => {
  console.log('toggleModeSelector', event)
  if (event) event.stopPropagation()
  showModeSelectorMenu.value = !showModeSelectorMenu.value
}

const selectModel = (model: string) => {
  // 仅通知父组件更新 selectedModel，父组件负责将新值通过 props 回传
  emit('update:selected-model', model)
  showModeSelectorMenu.value = false
}

// (keyword search handled outside in PhotoSearchView; no handler here)

// 监听外部值变化
watch(
  () => props.modelValue,
  (newValue) => {
    localInputValue.value = newValue
  }
)

// 监听本地值变化，同步到外部
watch(localInputValue, (newValue) => {
  emit('update:modelValue', newValue)
})

// 处理发送
const handleSend = () => {
  const message = localInputValue.value.trim()
  if (!message || props.isLoading) return

  // 先让输入框失焦，关闭键盘
  inputRef.value?.blur()

  // 延迟发送消息，等待键盘关闭动画完成
  setTimeout(() => {
    emit('send', message)
    localInputValue.value = ''
  }, 100) // 100ms 延迟，给键盘关闭动画时间
}

// 处理回车
const handleEnter = () => {
  handleSend()
}

// 处理焦点
const handleFocus = () => {
  emit('focus')
}

const handleBlur = () => {
  emit('blur')
}

// (麦克风按钮在此组件中已移除，相关事件由父组件或其他组件处理)

// 暴露方法给父组件
defineExpose({
  focus: () => {
    inputRef.value?.focus()
  },
  blur: () => {
    inputRef.value?.blur()
  },
})
</script>

<style lang="scss" scoped>
/* 主容器 - 圆角带渐变边框，水平布局（左头像 + 输入 + 右侧动作） */
.simple-chat-input-wrapper {
  background-image: linear-gradient(#ffffff, #ffffff), linear-gradient(90deg, #7a7cff, #c072ff);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  border-radius: 14px;
  border: 1.5px solid transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  width: 100%;
  flex: 1;
  box-sizing: border-box;
  transition: all 0.18s ease;
}

.left-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: transparent;
}

/* 模式选择器按钮样式（简化自 ChatInput） */
.action-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border-radius: 20px;
  border: none;
  color: #3c4043;
  font-size: 14px;
  transition: all 0.18s ease;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  font-weight: 600;
}

.action-mode-btn:hover {
  background: #f8f9fa;
  color: #333333;
}

.action-mode-btn.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.mode-text {
  font-weight: 500;
}

/* 与 ChatInput.vue 保持一致的 mode-selector 样式 */
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

.mode-selector:hover {
  background: #f8f9fa;
}

.mode-selector.active {
  background: #e8f0fe;
  color: #1a73e8;
}

/* 顶部插槽样式 */
.simple-chat-top-slot {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: auto;
  /* 宽度由内容决定 */
  padding: 4px 0 6px 0;
}

/* 模式下拉菜单 */
.mode-selector-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10002;
  min-width: 120px;
}

.mode-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  text-align: left;
  width: 100%;
  cursor: pointer;
  border-radius: 6px;
}

.mode-dropdown-item:hover {
  background: #f5f5f7;
}

.input-area {
  flex: 1;
  display: flex;
  align-items: center;
}

/* 输入前置插槽容器（放置图标按钮组等） */
.input-prefix {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-right: 6px;
}

/* 输入行容器：前置插槽 + 输入框容器并排 */
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.simple-chat-input {
  width: 100%;
  height: 40px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #333;
  padding: 0 8px;

  &::placeholder {
    color: #999;
  }
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* toolbar button/icon (search) — reuse ChatInput styles */
.toolbar-btn {
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.toolbar-icon {
  display: block;
  height: 20px;
  width: 20px;
  object-fit: contain;
}

.mic-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  border: none;
  cursor: pointer;
  transition: transform 0.12s;

  &:hover:not(:disabled) {
    transform: scale(1.05);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.simple-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #7A7CFF;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: #6A6CE8;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
}
</style>
