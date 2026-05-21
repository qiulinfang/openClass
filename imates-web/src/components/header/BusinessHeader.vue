<template>
  <header class="business-header">
    <div class="toolbar-left">
      <slot name="left">
        <div v-if="showBack" class="back-btn" @click="handleBack">
          <img :src="backIcon || goBackIcon" alt="返回" class="back-icon" />
          <span v-if="backText" class="back-text">{{ backText }}</span>
        </div>
      </slot>
    </div>
    <div class="header-title">
      <slot name="title">{{ title }}</slot>
    </div>
    <div class="toolbar-right">
      <slot name="right"></slot>
    </div>
  </header>
</template>

<script setup lang="ts">
import goBackIcon from '/icons/goback.svg'

interface Props {
  title?: string
  showBack?: boolean
  backIcon?: string
  backText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  showBack: true,
})

const emit = defineEmits<{
  back: []
}>()

const handleBack = () => {
  emit('back')
}
</script>

<style lang="scss" scoped>
.business-header {
  height: 56px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f002e;
  color: #ffffff;
  position: relative;
  flex-shrink: 0;
  width: 100%;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-left {
  position: absolute;
  left: 24px;
  z-index: 10;
  display: flex;
  align-items: center;
}

.toolbar-right {
  position: absolute;
  right: 24px;
  z-index: 10;
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  background: transparent;
  transition: background-color 0.15s ease;
  gap: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.back-icon {
  width: 25px;
  height: 25px;
}

.back-text {
  font-size: 16px;
  color: #ffffff;
}
</style>
