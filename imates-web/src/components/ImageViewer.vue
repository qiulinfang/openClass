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

        <button
          type="button"
          class="save-btn"
          @click.stop="handleSave"
          title="保存到本地"
        >
          <img :src="downloadIcon" alt="下载" class="save-icon" />
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
import downloadIcon from '/icons/download.svg'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'

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

const getExtFromDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
  if (!match) return 'png'
  const mime = match[1]
  const ext = mime.split('/')[1]
  return ext || 'png'
}

const dataUrlToBlob = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) throw new Error('invalid data url')
  const header = dataUrl.slice(0, commaIndex)
  const base64 = dataUrl.slice(commaIndex + 1)
  const mimeMatch = header.match(/^data:([^;]+);base64$/)
  const mime = mimeMatch?.[1] || 'application/octet-stream'
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const blobToDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read blob failed'))
    reader.readAsDataURL(blob)
  })
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

const fetchAsBlob = async (url: string) => {
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`fetch failed: ${resp.status}`)
  }
  return await resp.blob()
}

const handleSave = async () => {
  const url = props.imageUrl
  if (!url) return

  try {
    // Android WebView：优先走原生保存到相册
    if (androidBridge.isAndroidBridgeAvailable() && androidBridge.saveBase64ImageToGallery) {
      let dataUrl = url
      if (!dataUrl.startsWith('data:image/')) {
        const blob = await fetchAsBlob(url)
        dataUrl = await blobToDataUrl(blob)
      }

      const ext = getExtFromDataUrl(dataUrl)
      const filename = `image_${Date.now()}.${ext}`
      const result = androidBridge.saveBase64ImageToGallery(dataUrl, filename)
      if (result?.success) {
        showMessage('已保存到相册', 'success')
        return
      }
      // 原生失败则继续走 Web 下载兜底
    }

    // Web：下载
    if (url.startsWith('data:image/')) {
      const ext = getExtFromDataUrl(url)
      const filename = `image_${Date.now()}.${ext}`
      downloadBlob(dataUrlToBlob(url), filename)
      showMessage('开始下载', 'success')
      return
    }

    const blob = await fetchAsBlob(url)
    const type = blob.type || ''
    const ext = type.startsWith('image/') ? type.split('/')[1] : 'png'
    const filename = `image_${Date.now()}.${ext}`
    downloadBlob(blob, filename)
    showMessage('开始下载', 'success')
  } catch (e) {
    // 兜底：直接打开图片地址
    try {
      window.open(props.imageUrl, '_blank', 'noopener')
      showMessage('已在新窗口打开，请长按/右键保存', 'info')
    } catch (err) {
      showMessage('保存失败', 'error')
    }
  }
}
</script>

<style scoped lang="scss">
.image-viewer-root {
  // 确保图片预览层级高于其他自定义对话框（如 Modal，遮罩层 z-index=9000）
  position: fixed;
  inset: 0;
  z-index: 999999;
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

.save-btn {
  position: absolute;
  top: 20px;
  right: 68px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.05);
}

.save-icon {
  width: 20px;
  height: 20px;
  display: block;
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

