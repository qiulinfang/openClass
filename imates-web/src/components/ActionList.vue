<template>
  <div>
    <div
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
      <img
        v-if="item.icon"
        :src="item.icon"
        :alt="item.label"
        width="20"
        height="20"
        :class="item.iconClass"
      />
      <!-- Quasar 图标 -->
      <q-icon
        v-else-if="item.iconName"
        :name="item.iconName"
        :size="item.iconSize || '20px'"
        :color="item.iconColor || 'grey-7'"
      />
      <!-- 内置 SVG 图标（多选） -->
      <svg
        v-else-if="item.iconSvgType === 'multi-select'"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          fill="#9792ac"
        />
      </svg>
      <div>{{ item.label }}</div>
    </div>

    <slot name="extra" />
  </div>
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
