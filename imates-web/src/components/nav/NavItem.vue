<template>
  <div
    class="nav-item"
    :class="{ active: isActive }"
    @click="$emit('click')"
  >
    <div class="nav-icon-wrapper" v-if="badgeCount > 0 || hasNotification">
      <img :src="icon" :alt="displayLabel" class="nav-icon" />
      <span class="notification-badge" v-if="badgeCount > 0">{{ badgeCount }}</span>
      <span class="notification-dot" v-else-if="hasNotification"></span>
    </div>
    <img v-else :src="icon" :alt="displayLabel" class="nav-icon" />
    <span class="nav-text">{{ displayLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type NavKey =
  | 'toolbox'
  | 'knowledge'
  | 'exercises'
  | 'homework'
  | 'mistakeBook'
  | 'resources'
  | 'photoQa'
  | 'canvas'
  | 'logout'

export interface NavItemConfig {
  key: NavKey
  label: string
  iconType: NavKey
  position: 'main' | 'bottom'
  routeName?: string
}

/**
 * 组件 Props 定义
 */
const props = withDefaults(
  defineProps<{
    /** 导航项名称文本 */
    label?: string
    /** 导航项配置信息（可选） */
    item?: NavItemConfig
    /** 当前导航项是否处于激活选中状态 */
    isActive?: boolean
    /** 导航项显示的图标 URL 地址 */
    icon: string
    /** 未读消息数字角标数量（大于 0 时展示） */
    badgeCount?: number
    /** 是否显示小红点通知标记 */
    hasNotification?: boolean
  }>(),
  {
    label: '',
    isActive: false,
    badgeCount: 0,
    hasNotification: false,
  }
)

const displayLabel = computed(() => props.label || props.item?.label || '')

/**
 * 组件 Emits 定义
 */
defineEmits<{
  /** 点击导航项时触发的事件 */
  click: []
}>()
</script>

<style lang="scss" scoped>
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 9px 8px;
  margin: 0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  position: relative;

  &.active {
    background: #f3e8ff;

    .nav-icon {
      opacity: 1;
      color: #9059ff;

      img {
        filter: none;
        opacity: 1;
      }
    }

    .nav-text {
      color: #9059ff;
      font-weight: 600;
    }
  }

  &:hover:not(.active) {
    background: #f9fafb;

    .nav-icon {
      opacity: 0.8;
      color: #6b7280;

      img {
        opacity: 0.8;
      }
    }

    .nav-text {
      color: #000000;
    }
  }

  .nav-icon-wrapper {
    position: relative;
    display: inline-block;
  }

  .nav-icon {
    width: 28px;
    height: 28px;
    transition: all 0.2s ease;
    font-size: 28px;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      filter: grayscale(100%) brightness(0.6);
      opacity: 0.6;
      transition: all 0.2s ease;
    }

    &:not(img) {
      opacity: 0.6;
    }
  }

  .notification-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    border: 2px solid #ffffff;
  }

  .notification-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    background: #ef4444;
    color: white;
    border-radius: 9px;
    border: 2px solid #ffffff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .nav-text {
    margin-top: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #000000;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    transition: all 0.2s ease;
    font-family: 'PingFang SC', sans-serif;
  }
}
</style>
