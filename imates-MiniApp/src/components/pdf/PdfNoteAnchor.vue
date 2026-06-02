<template>
  <view>
    <!-- 笔记锚点标记 -->
    <view
      class="note-marker"
      :style="markerStyle"
      @click.stop="handleMarkerClick"
    >
      <image :src="bubbleIcon" mode="aspectFit" class="note-marker-icon" />
      <text class="note-marker-initial">{{ userInitial }}</text>
    </view>

    <!-- 内联新增输入气泡 -->
    <view
      v-if="mode === 'create' && isOpen"
      class="note-tooltip"
      :style="tooltipStyle"
      @click.stop
    >
      <view class="note-input-card">
        <textarea
          :value="modelValue"
          @input="(e) => emit('update:modelValue', e.detail.value)"
          class="note-textarea"
          placeholder="输入笔记"
          auto-height
        />
        <view class="note-input-actions">
          <BaseButton
            variant="ghost"
            size="sm"
            @click.stop="handleConfirm"
          >
            <image src="/icons/check.svg" style="width: 20px; height: 20px;" />
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="sm"
            @click.stop="handleCancel"
          >
            <image src="/icons/close.svg" style="width: 20px; height: 20px;" />
          </BaseButton>
        </view>
      </view>
    </view>

    <!-- 已保存笔记提示卡片 -->
    <view
      v-if="mode === 'display' && active"
      class="note-tooltip"
      :style="tooltipStyle"
      @click.stop
    >
      <view class="note-input-card">
        <textarea
          :value="text"
          class="note-textarea"
          disabled
          auto-height
          placeholder="暂无内容"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import BaseButton from '../base/Button.vue'
import noteBubbleIcon from '/icons/bubbles.svg'

interface Props {
  mode: 'marker' | 'create' | 'display'
  // 坐标归一化 [0,1]
  x: number
  y: number
  pageLayout: { width: number; height: number }
  // 展示模式下的文本和激活状态
  text?: string
  active?: boolean
  // 是否显示输入卡片
  inlineActive?: boolean
  modelValue?: string

}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'confirm', text: string): void
  (e: 'cancel'): void
  (e: 'marker-click'): void
  (e: 'marker-click'): void
}>()

// 从 localStorage 中获取当前用户信息
let userInitial = 'G'
try {
  const raw = localStorage.getItem('userInfo')
  if (raw) {
    const userInfo = JSON.parse(raw)
    const name: string | undefined = userInfo?.name
    if (name && name.length > 0) {
      userInitial = name.charAt(0)
    }
  }
} catch (e) {
  console.warn('[PdfPage] 解析 userInfo 失败', e)
}

// 内联输入气泡展开状态：仅在 create 模式下生效
const isOpen = ref(props.mode === 'create' && !!props.inlineActive)

const bubbleIcon = noteBubbleIcon

const markerStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  left: `${props.x * props.pageLayout.width}px`,
  top: `${props.y * props.pageLayout.height}px`,
}))

const tooltipStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  left: `${props.x * props.pageLayout.width}px`,
  top: `${props.y * props.pageLayout.height - 8}px`,
}))

const handleMarkerClick = () => {
  if (props.mode === 'create') {
    // 新增模式：点击锚点展开/收起输入卡片
    isOpen.value = !isOpen.value
    return
  }
  // marker/display 模式：点击锚点仅通知父组件
  emit('marker-click')
}

const handleConfirm = () => {
  isOpen.value = false
  emit('confirm', (props.modelValue || '').trim())
}

const handleCancel = () => {
  isOpen.value = false
  emit('cancel')
}
</script>

<style scoped>
.note-textarea {
  flex: 1;
  font-size: 12px;
  width: 100%;
  padding: 4px;
}

.note-input-card {
  border-radius: 0px 12px 12px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  background-color: #ffffff;
  padding: 0 5px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.note-input-actions {
  margin-top: 4px; /* 和文本稍微拉开一点 */
  display: flex;
  justify-content: flex-end;
  gap: 4px; /* 按钮之间间距 */
}

.note-input-card .q-field {
  flex: 1;
}

.note-display-content {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
}

.note-display-text {
  flex: 1;
  font-size: 12px;
  line-height: 1.4;
  color: #111827;
  padding: 6px 4px;
  white-space: pre-wrap;
}

.note-display-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.note-marker {
  position: absolute;
  cursor: pointer;
}

.note-marker-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.note-marker-initial {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  pointer-events: none;
}

.note-tooltip {
  z-index: 200;
}
</style>
