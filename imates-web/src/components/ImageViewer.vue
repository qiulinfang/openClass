<template>
  <!-- 使用 Teleport 将预览层挂到 body，避免受父级对话框影响 -->
  <Teleport to="body">
    <div v-if="modelValue" class="image-viewer-root">
      <div class="preview-overlay" @click="handleClose">
        <!-- 关闭按钮 -->
        <button
          type="button"
          class="close-btn"
          @click.stop="handleClose"
        >
          ✕
        </button>

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
    </div>
  </Teleport>
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

const handleClose = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.image-viewer-root {
  // 确保图片预览层级高于其他自定义对话框（如 Modal，遮罩层 z-index=9000）
  position: fixed;
  inset: 0;
  z-index: 10000;
}

.preview-overlay {
  position: absolute;
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
  color: #ffffff;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
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

