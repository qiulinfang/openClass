<template>
  <view>
    <view
      v-for="item in itemsToShow"
      :key="item.key"
      class="more-menu-item-row"
      :class="{
        'is-loading': item.loading,
        'is-disabled': item.disabled,
      }"
      @click="handleItemClick(item)"
    >
      <!-- 图片图标 -->
      <image
        v-if="item.icon"
        :src="item.icon"
        mode="aspectFit"
        style="width: 20px; height: 20px"
        :class="item.iconClass"
      />
      <!-- 内置符号代替 Quasar 图标 -->
      <text
        v-else-if="item.iconName || item.iconSvgType === 'multi-select'"
        class="menu-icon-text"
        :style="{ color: item.iconColor || '#9792ac', fontSize: item.iconSize || '20px' }"
      >
        {{ getIconSymbol(item) }}
      </text>
      <view>{{ item.label }}</view>
    </view>

    <slot name="extra" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ActionItem {
  key: string
  label: string
  // 图片图标路径（如 /icons/xxx.svg）
  icon?: string
  iconClass?: string
  // 使用 Quasar q-icon 渲染的图标名称，如 'format_quote'、'delete_outline'
  iconName?: string
  iconColor?: string
  iconSize?: string
  // 内置 SVG 图标类型，目前用于 ChatMessage 的多选图标
  iconSvgType?: 'multi-select'
  loading?: boolean
  disabled?: boolean
  visible?: boolean
  onClick?: () => void
}

const props = defineProps<{
  items: ActionItem[]
}>()

const itemsToShow = computed(() => props.items.filter((i) => i.visible ?? true))

const getIconSymbol = (item: ActionItem) => {
  if (item.iconSvgType === 'multi-select') return '☑'
  if (item.iconName === 'delete_outline' || item.iconName === 'delete') return '🗑'
  if (item.iconName === 'edit') return '✎'
  if (item.iconName === 'format_quote') return '＂'
  return '•'
}

const handleItemClick = (item: ActionItem) => {
  if (item.disabled || item.loading) return
  if (typeof item.onClick === 'function') {
    item.onClick()
  }
}
</script>

<style scoped>
/* 通用更多菜单项行样式，来自 QuestionList.vue */
.more-menu-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  font-size: 14px;
  line-height: 1.4;
  padding: 6px 6px;
  cursor: pointer;
}

.more-menu-item-row:hover {
  background-color: rgba(15, 23, 42, 0.03);
}

.more-menu-item-row.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}
</style>
