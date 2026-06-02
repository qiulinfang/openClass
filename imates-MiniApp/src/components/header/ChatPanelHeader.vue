<template>
  <view class="chat-panel-header">
    <!-- Tab 切换 -->
    <slot name="tabs">
      <view class="chat-tabs">
        <view class="tab-list">
          <view
            v-for="tab in tabs"
            :key="tab.value"
            :class="['tab-item', { 'tab-active': modelValue === tab.value }]"
            @click="emit('update:modelValue', tab.value)"
          >
            <text>{{ tab.label }}</text>
          </view>
        </view>
      </view>
    </slot>
    <!-- 关闭按钮 -->
    <BaseButton
      v-if="showCloseButton"
      @click="emit('close')"
      class="close-button"
      variant="ghost"
      size="sm"
      label="✕"
    />
  </view>
</template>

<script setup lang="ts">
import BaseButton from '../base/Button.vue'
interface TabOption {
  label: string
  value: string
}

defineProps<{
  modelValue: string
  tabs: TabOption[]
  showCloseButton?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  close: []
}>()
</script>

<style scoped>
.chat-panel-header {
  background: #e8e9ff;
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
}

/* Tab 列表 */
.tab-list {
  display: flex;
  gap: 2px;
}

/* 每个 Tab 项 */
.tab-item {
  position: relative;
  padding: 8px 18px;
  color: #a19cb6;
  text-decoration: none;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  width: 100px;
}

/* 激活的 Tab 项 */
.tab-item.tab-active {
  background-image: url('/icons/sessionbackfround.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center center;
  color: #504b64;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  height: 40px;
  line-height: 24px;
  width: 100px;
}

/* 激活 Tab 底部下划线 */
.tab-item.tab-active::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 30%;
  height: 3px;
  background: #6e55ff;
  border-radius: 2px;
}

/* Tab hover */
.tab-item:hover:not(.tab-active) {
  opacity: 0.85;
  background: transparent;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
}
</style>
