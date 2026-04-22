<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fullscreen-overlay">
      <div class="overlay-header" v-if="showHeader">
        <div class="header-left">
          <slot name="header-left">
            <div class="back-btn" @click="close">
              <q-icon name="arrow_back" size="24px" />
            </div>
          </slot>
        </div>
        <div class="header-center">
          <slot name="header-center">
            <div class="overlay-title">{{ title }}</div>
          </slot>
        </div>
        <div class="header-right">
          <slot name="header-right">
            <button class="close-btn" @click="close">
              <q-icon name="close" size="24px" />
            </button>
          </slot>
        </div>
      </div>
      
      <div class="overlay-content">
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  showHeader?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  showHeader: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<style lang="scss" scoped>
.fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.overlay-header {
  height: 54px;
  background: #0f002e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.header-left, .header-right {
  width: 200px;
  display: flex;
  align-items: center;
}

.header-right {
  justify-content: flex-end;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.overlay-title {
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.back-btn, .close-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
}

.overlay-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
</style>
