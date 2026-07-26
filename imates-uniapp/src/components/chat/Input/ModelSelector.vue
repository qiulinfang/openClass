<template>
  <view class="model-selector-wrapper">
    <!-- 主选择按钮：显示当前选中的 AI 角色 -->
    <view class="action-mode-btn" @click="showRoleActionSheet">
      <text class="mode-icon">{{ currentRoleInfo.icon }}</text>
      <text class="mode-label">{{ currentRoleInfo.label }}</text>
      <svg class="arrow-down" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface SelectOption {
  label: string
  value: string
  icon?: string
}

// 1:1 对齐 imates-web 的 AI_ROLE_OPTIONS
const AI_ROLE_OPTIONS: SelectOption[] = [
  { label: '同桌', value: 'mate', icon: '🤖' },
  { label: '课代表', value: 'mentor', icon: '🎓' },
  { label: '大神', value: 'researcher', icon: '👨‍🔬' },
]

const props = withDefaults(
  defineProps<{
    selectedModel?: string
  }>(),
  {
    selectedModel: 'mate'
  }
)

const emit = defineEmits<{
  (e: 'update:selectedModel', value: string): void
}>()

const currentRoleInfo = computed(() => {
  const matched = AI_ROLE_OPTIONS.find(opt => opt.value === props.selectedModel)
  return matched || { label: '同桌', value: 'mate', icon: '🤖' }
})

const showRoleActionSheet = () => {
  const itemList = AI_ROLE_OPTIONS.map(opt => `${opt.icon} ${opt.label}`)
  uni.showActionSheet({
    itemList,
    success: (res) => {
      const selected = AI_ROLE_OPTIONS[res.tapIndex]
      if (selected) {
        emit('update:selectedModel', selected.value)
        uni.showToast({
          title: `切换为 AI${selected.label}`,
          icon: 'none'
        })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.model-selector-wrapper {
  display: inline-block;
}

.action-mode-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background-color: #f0f2fe;
  border: 1px solid #e0e4ff;
  color: #7a7cff;
  border-radius: 32rpx;
  padding: 10rpx 22rpx;
  font-size: 24rpx;
  font-weight: 600;
  transition: all 0.2s ease;

  &:active {
    background-color: #e5e8ff;
  }
}

.mode-icon {
  font-size: 24rpx;
}

.mode-label {
  font-size: 24rpx;
  color: #4f46e5;
  font-weight: 600;
}

.arrow-down {
  color: #7a7cff;
  margin-left: 2rpx;
}
</style>
