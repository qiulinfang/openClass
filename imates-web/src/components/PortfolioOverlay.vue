<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="portfolio-overlay-root" @click.self="close">
        <div class="portfolio-container">
          <header class="portfolio-header">
            <h3 class="portfolio-title">作品集</h3>
            <button class="close-btn" @click="close">
              <q-icon name="close" size="24px" />
            </button>
          </header>

          <div class="portfolio-content">
            <div class="portfolio-grid">
              <div
                v-for="(img, index) in images"
                :key="index"
                class="portfolio-item"
                @click="handleImageClick(index)"
              >
                <div class="image-wrapper">
                  <img :src="img.url" :alt="img.alt" class="portfolio-thumb" />
                  <div class="image-hover-overlay">
                    <q-icon name="zoom_in" size="32px" color="white" />
                  </div>
                </div>
                <p class="image-caption">{{ img.alt || `作品 ${index + 1}` }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface ImageItem {
  url: string
  alt?: string
}

interface Props {
  modelValue: boolean
  images: ImageItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'image-click': [index: number]
}>()

const close = () => {
  emit('update:modelValue', false)
}

const handleImageClick = (index: number) => {
  emit('image-click', index)
}
</script>

<style scoped lang="scss">
.portfolio-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.portfolio-container {
  width: 80%;
  max-width: 800px;
  background: #ffffff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.portfolio-header {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}

.portfolio-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #0f172a;
    transform: rotate(90deg);
  }
}

.portfolio-content {
  padding: 24px;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.portfolio-item {
  cursor: pointer;
  
  .image-wrapper {
    position: relative;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    overflow: hidden;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    .portfolio-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s;
    }

    .image-hover-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
    }
  }

  .image-caption {
    margin: 10px 0 0;
    text-align: center;
    font-size: 14px;
    color: #475569;
    font-weight: 500;
  }

  &:hover {
    .image-wrapper {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
      border-color: #cbd5e1;

      .portfolio-thumb {
        transform: scale(1.05);
      }

      .image-hover-overlay {
        opacity: 1;
      }
    }

    .image-caption {
      color: #0f172a;
    }
  }
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .portfolio-container {
  animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scale-up {
  from {
    transform: scale(0.9);
  }
  to {
    transform: scale(1);
  }
}
</style>
