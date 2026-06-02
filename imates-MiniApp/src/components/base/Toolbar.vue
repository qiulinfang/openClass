<template>
  <view class="app-header">
    <!-- 左侧插槽内容 -->
    <view class="toolbar-left">
      <slot name="left"></slot>
    </view>

    <view class="app-toolbar">
      <!-- 居中的功能导航 -->
      <view class="toolbar-center">
        <view class="function-nav">
          <view
            v-for="navItem in props.navItems"
            :key="navItem.key"
            class="nav-item"
            :class="{ active: navItem.key === props.modelValue, disabled: navItem.disabled }"
            @click="!navItem.disabled && handleNavClick(navItem.key)"
          >
            <image v-if="navItem.icon && navItem.key === props.modelValue" :src="navItem.icon" mode="aspectFit" class="nav-icon" />
            <text>{{ navItem.label }}</text>
          </view>
        </view>

        <!-- 右侧插槽内容 -->
        <view class="toolbar-right">
          <slot name="right"></slot>
        </view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
// 导航项配置接口
interface NavItem {
  key: string
  label: string
  icon?: string
  disabled?: boolean
}

// Props 定义 - 简化接口，直接接收导航项数组和当前激活的key
const props = withDefaults(defineProps<{
  // 导航项数组
  navItems?: NavItem[]
  // 当前激活的导航项key (v-model)
  modelValue?: string
}>(), {
  navItems: () => [],
  modelValue: ''
})

// 定义 emits
const emit = defineEmits<{
  navClick: [navKey: string]
  'update:modelValue': [value: string]
}>()

// 处理导航点击
const handleNavClick = (navKey: string) => {
  emit('navClick', navKey)
  emit('update:modelValue', navKey)
}

// 定义插槽
defineSlots<{
  left?: () => void
  right?: () => void
}>()
</script>

<style lang="scss" scoped>
// SCSS 变量定义（与原组件保持一致）
$header-height: 56px;
$border-color: #e5e7eb;
$border-width: 1px;
$scrollbar-width: 6px;
$scrollbar-track-color: #f1f1f1;
$scrollbar-thumb-color: #c1c1c1;
$scrollbar-thumb-hover-color: #a8a8a8;
$border-radius: 3px;
$background-color: #ffffff;
$panel-background: #fafbfc;

// 断点变量
$mobile-breakpoint: 768px;
$tablet-breakpoint: 1024px;
$desktop-breakpoint: 1025px;

// 混入 - 滚动样式
@mixin scrollable-area {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

// 混入 - 自定义滚动条
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: $scrollbar-width;
  }

  &::-webkit-scrollbar-track {
    background: $scrollbar-track-color;
    border-radius: $border-radius;
  }

  &::-webkit-scrollbar-thumb {
    background: $scrollbar-thumb-color;
    border-radius: $border-radius;

    &:hover {
      background: $scrollbar-thumb-hover-color;
    }
  }
}

// 混入 - 全高度布局
@mixin full-height-flex {
  height: 100%;
  display: flex;
  flex-direction: column;
}

// 混入 - 隐藏移动端滚动条
@mixin hide-mobile-scrollbar {
  scrollbar-width: none; // Firefox
  -ms-overflow-style: none; // IE and Edge

  &::-webkit-scrollbar {
    display: none; // Chrome, Safari, Opera
  }
}

// 主要样式（从原组件复制）
.app-header {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  border-bottom: none;
  box-shadow: none;
  background-color: #0f002e; /* 深紫色背景 */
  flex-shrink: 0;
  position: relative;
}

.app-toolbar {
  height: $header-height;
  min-height: $header-height;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 16px;
}

.toolbar-left {
  position: absolute;
  left: 24px;
  top: 11px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}


.toolbar-center {
  flex: 1;
  display: flex;
  position: relative;
  justify-content: center;
  align-items: center;
}

.toolbar-right {
  position: absolute;
  right: -12px;
  display: flex;
  align-items: center;
  gap: 8px;
}


.function-nav {
  display: flex;
  align-items: center;
}

.nav-item {
  font-size: 14px;
  color: #9792ac; /* 浅灰色文字 */
  cursor: pointer;
  // 用高度+左右 padding 控制宽度，不再让它随文字无限变窄
  position: relative;
  display: inline-flex; /* 以内联块的形式，让背景宽度只包裹内容 */
  align-items: center;
  justify-content: center;
  min-width: 110px; /* 适配你的 sessionbackground.svg 宽度，可按实际调整 */
  height: 36px; /* 对应底图高度，可按实际调整 */
  box-sizing: border-box;
  font-weight: 500;

  // 激活状态 - 使用 sessionbackground.svg 作为背景
  &.active {
    background-image: url('/icons/sessionbackfround.png');
    background-repeat: no-repeat;
    background-size: 100% 100%; // 背景完整铺满 nav-item
    background-position: center;
    color: #504b64;
    font-weight: 600;
    &::after {
      content: '';
      position: absolute;
      bottom: 1px;
      left: 50%;
      transform: translateX(-50%);
      width: 30%;
      height: 3px;
      background: #6e55ff; /* 亮紫色下划线 */
      border-radius: 2px;
    }
    .nav-icon {
      filter: none;
      width: 20px;
    }
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}


// 确保所有边框颜色一致
* {
  border-color: $border-color !important;
}

@media (max-width: $mobile-breakpoint) {
  .function-nav {
    gap: 12px;
    padding: 0 8px;
  }

  .nav-item {
    font-size: 12px;
    min-width: 80px;
    height: 32px;
  }

  .toolbar-left {
    left: 16px;
  }

  .toolbar-right {
    right: -8px;
  }
}
</style>