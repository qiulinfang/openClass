<template>
  <div>
    <!-- 笔记锚点标记：
         - marker  模式：只显示锚点，点击仅通知父组件（marker-click）
         - create  模式：显示锚点，点击切换内联输入卡片展开/收起
         - display 模式：显示锚点，点击仅通知父组件（marker-click），卡片由 active 控制 -->
    <div
      class="note-marker"
      :style="markerStyle"
      @click.stop="handleMarkerClick"
    >
      <img :src="bubbleIcon" alt="note" class="note-marker-icon" />
      <span class="note-marker-initial">{{ userInitial }}</span>
    </div>

    <!-- 内联新增输入气泡（create 模式才渲染，display/marker 模式不显示输入） -->
    <div
      v-if="mode === 'create' && isOpen"
      class="note-tooltip"
      :style="tooltipStyle"
      @click.stop
    >
      <q-card flat bordered class="note-input-card">
        <q-input
          :model-value="modelValue"
          @update:model-value="(val) => emit('update:modelValue', val)"
          type="textarea"
          autogrow
          borderless
          autofocus
          dense
          placeholder="输入笔记"
          :input-style="{ fontSize: '12px' }"
        />
        <div class="note-input-actions">
          <q-btn
            flat
            round
            dense
            icon="check"
            color="primary"
            size="sm"
            @click.stop="handleConfirm"
          />
          <q-btn
            flat
            round
            dense
            icon="close"
            color="grey-5"
            size="sm"
            @click.stop="handleCancel"
          />
        </div>
      </q-card>
    </div>

    <!-- 已保存笔记提示卡片（display 模式且 active 时渲染） -->
    <div
      v-if="mode === 'display' && active"
      class="note-tooltip"
      :style="tooltipStyle"
      @click.stop
    >
      <q-card flat bordered class="note-input-card">
        <!-- 第一行：笔记内容 -->
        <q-input
          :model-value="text"
          type="textarea"
          autogrow
          borderless
          dense
          placeholder="暂无内容"
          :input-style="{ fontSize: '12px' }"
        />
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
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
