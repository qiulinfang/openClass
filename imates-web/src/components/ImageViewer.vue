<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="handleUpdate"
    class="image-viewer-dialog"
    :maximized="true"
    transition-show="fade"
    transition-hide="fade"
  >
    <div class="preview-overlay" @click="handleClose">
      <!-- 关闭按钮 -->
      <q-btn
        flat
        round
        dense
        icon="close"
        color="white"
        class="close-btn"
        @click.stop="handleClose"
      />

      <!-- 图片预览区域 -->
      <div class="preview-content" @click.stop>
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="alt || '图片预览'"
          class="preview-image"
        />
      </div>
    </div>
  </q-dialog>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  imageUrl: string
  alt?: string
}

const props = withDefaults(defineProps<Props>(), {
  alt: '图片预览'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const handleUpdate = (value: boolean) => {
  emit('update:modelValue', value)
}

const handleClose = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.image-viewer-dialog {
  z-index: 9999;
}

.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  cursor: pointer;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

.preview-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 20px;
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  user-select: none;
  pointer-events: none;
}
</style>

