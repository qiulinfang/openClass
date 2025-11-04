<template>
  <div class="photo-search-view">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <q-btn
        flat
        round
        dense
        icon="close"
        @click="handleExit"
        class="close-btn"
      />
    </div>

    <!-- 相机/图片预览区域 -->
    <div class="preview-area" v-if="!showCropView && !showResultView">
      <div class="camera-placeholder" v-if="!currentImage">
        <q-icon name="camera_alt" size="64px" color="grey-5" />
        <p class="placeholder-text">点击下方按钮拍照或选择图片</p>
      </div>
      <img
        v-else
        :src="currentImage.preview"
        alt="预览图片"
        class="preview-image"
      />
    </div>

    <!-- 图片裁剪区域 -->
    <div class="crop-area" v-if="showCropView && !showResultView">
      <div class="crop-container">
        <canvas
          ref="cropCanvas"
          class="crop-canvas"
          @mousedown="startCrop"
          @mousemove="updateCrop"
          @mouseup="endCrop"
          @touchstart="startCrop"
          @touchmove="updateCrop"
          @touchend="endCrop"
        ></canvas>
        <div
          v-if="cropRect"
          class="crop-overlay"
          :style="cropOverlayStyle"
        ></div>
      </div>
    </div>

    <!-- 题目结果区域 -->
    <div class="result-area" v-if="showResultView">
      <div class="question-display">
        <div class="question-title">识别到的题目</div>
        <div class="question-content" v-html="recognizedQuestion"></div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="bottom-toolbar">
      <!-- 相机模式：拍照/相册按钮 -->
      <template v-if="!showCropView && !showResultView">
        <q-btn
          color="primary"
          icon="camera_alt"
          label="拍照"
          @click="handleTakePhoto"
          :disable="isProcessing"
          class="action-btn"
        />
        <q-btn
          color="primary"
          icon="photo_library"
          label="相册"
          @click="handleSelectFromGallery"
          :disable="isProcessing"
          class="action-btn"
        />
      </template>

      <!-- 裁剪模式：搜索/重拍按钮 -->
      <template v-if="showCropView && !showResultView">
        <q-btn
          color="secondary"
          icon="refresh"
          label="重拍"
          @click="handleRetake"
          :disable="isProcessing"
          class="action-btn"
        />
        <q-btn
          color="primary"
          icon="search"
          label="搜索"
          @click="handleSearch"
          :disable="isProcessing"
          :loading="isSearching"
          class="action-btn"
        />
      </template>

      <!-- 结果模式：添加到列表/重新搜索按钮 -->
      <template v-if="showResultView">
        <q-btn
          color="secondary"
          icon="refresh"
          label="重新搜索"
          @click="handleRetake"
          :disable="isProcessing"
          class="action-btn"
        />
        <q-btn
          color="primary"
          icon="add"
          label="添加到列表"
          @click="handleAddToList"
          :disable="isProcessing || !recognizedQuestionData"
          :loading="isAdding"
          class="action-btn"
        />
      </template>
    </div>

    <!-- 文本搜题输入框 -->
    <div class="text-search-area" v-if="showTextSearch">
      <q-input
        v-model="searchText"
        placeholder="输入题目关键字"
        outlined
        dense
        class="search-input"
      >
        <template v-slot:append>
          <q-btn
            flat
            dense
            round
            icon="search"
            @click="handleTextSearch"
            :disable="!searchText.trim() || isProcessing"
            :loading="isSearching"
          />
        </template>
      </q-input>
    </div>

    <!-- 加载遮罩 -->
    <q-inner-loading :showing="isProcessing || isSearching || isAdding">
      <q-spinner-ios size="50px" color="primary" />
    </q-inner-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { androidBridge } from '@/services/android-bridge'
import { apiService } from '@/services/api-service'
import { useQuestionStore } from '@/stores/questionStore'
import { showMessage } from '@/utils'
import { photoSearchLogger } from '@/utils/photoSearchLogger'
import type { ExerciseItem } from '@/types'

const route = useRoute()
const router = useRouter()
const questionStore = useQuestionStore()

// 状态管理
const currentImage = ref<{
  file: File
  preview: string
  base64DataUrl?: string
} | null>(null)
const showCropView = ref(false)
const showResultView = ref(false)
const showTextSearch = ref(false)
const isProcessing = ref(false)
const isSearching = ref(false)
const isAdding = ref(false)
const searchText = ref('')

// 图片裁剪相关
const cropCanvas = ref<HTMLCanvasElement | null>(null)
const cropRect = ref<{
  x: number
  y: number
  width: number
  height: number
} | null>(null)
const isCropping = ref(false)
const cropStartPos = ref({ x: 0, y: 0 })

// 识别结果
const recognizedQuestion = ref('')
const recognizedQuestionData = ref<ExerciseItem | null>(null)

// 获取科目参数（从路由或默认值）
const subject = computed(() => {
  const routeSubject = route.query.subject as string
  return routeSubject || 'math'
})

// 裁剪遮罩样式
const cropOverlayStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    left: `${cropRect.value.x}px`,
    top: `${cropRect.value.y}px`,
    width: `${cropRect.value.width}px`,
    height: `${cropRect.value.height}px`,
  }
})

// 处理退出
const handleExit = () => {
  photoSearchLogger.exit()
  router.back()
}

// 处理拍照
const handleTakePhoto = async () => {
  try {
    isProcessing.value = true
    photoSearchLogger.start(subject.value, 'camera')
    
    const result = await androidBridge.captureImageFromCamera()
    
    if (result.success && result.data) {
      const imageData = JSON.parse(result.data)
      if (imageData.base64DataUrl) {
        photoSearchLogger.captureImage('camera', true, undefined, imageData.base64DataUrl.length)
        
        // 将 base64 转换为 File 对象
        const file = await base64ToFile(imageData.base64DataUrl, 'photo.jpg')
        photoSearchLogger.convertBase64ToFile('photo.jpg', file.size, file.type)
        
        currentImage.value = {
          file,
          preview: imageData.base64DataUrl,
          base64DataUrl: imageData.base64DataUrl,
        }
        showCropView.value = true
        // 等待DOM更新后初始化裁剪
        setTimeout(() => {
          initCropCanvas()
        }, 100)
      } else {
        photoSearchLogger.captureImage('camera', false)
        showMessage('拍照失败', 'error')
      }
    } else {
      photoSearchLogger.captureImage('camera', false)
      showMessage('拍照失败', 'error')
    }
  } catch (error) {
    photoSearchLogger.error('拍照', error)
    console.error('拍照失败:', error)
    showMessage('拍照失败', 'error')
  } finally {
    isProcessing.value = false
  }
}

// 处理从相册选择
const handleSelectFromGallery = async () => {
  try {
    isProcessing.value = true
    photoSearchLogger.start(subject.value, 'gallery')
    
    const result = await androidBridge.selectImageFromGallery()
    
    if (result.success && result.data) {
      const imageData = JSON.parse(result.data)
      if (imageData.base64DataUrl) {
        photoSearchLogger.captureImage('gallery', true, undefined, imageData.base64DataUrl.length)
        
        // 将 base64 转换为 File 对象
        const file = await base64ToFile(imageData.base64DataUrl, 'photo.jpg')
        photoSearchLogger.convertBase64ToFile('photo.jpg', file.size, file.type)
        
        currentImage.value = {
          file,
          preview: imageData.base64DataUrl,
          base64DataUrl: imageData.base64DataUrl,
        }
        showCropView.value = true
        // 等待DOM更新后初始化裁剪
        setTimeout(() => {
          initCropCanvas()
        }, 100)
      } else {
        photoSearchLogger.captureImage('gallery', false)
        showMessage('选择图片失败', 'error')
      }
    } else {
      photoSearchLogger.captureImage('gallery', false)
      showMessage('选择图片失败', 'error')
    }
  } catch (error) {
    photoSearchLogger.error('选择图片', error)
    console.error('选择图片失败:', error)
    showMessage('选择图片失败', 'error')
  } finally {
    isProcessing.value = false
  }
}

// Base64 转 File
const base64ToFile = (base64: string, filename: string): Promise<File> => {
  return new Promise((resolve) => {
    const arr = base64.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    resolve(new File([u8arr], filename, { type: mime }))
  })
}

// 初始化裁剪画布
const initCropCanvas = () => {
  if (!cropCanvas.value || !currentImage.value) return

  const canvas = cropCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    // 设置画布大小
    const maxWidth = canvas.parentElement?.clientWidth || window.innerWidth
    const maxHeight = (canvas.parentElement?.clientHeight || window.innerHeight) - 200
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    
    // 绘制图片
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    
    // 初始化裁剪区域（全图）
    cropRect.value = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    }
    
    // 记录初始化裁剪画布
    photoSearchLogger.initCropCanvas(canvas.width, canvas.height, img.width, img.height, scale)
  }
  img.src = currentImage.value.preview
}

// 开始裁剪
const startCrop = (e: MouseEvent | TouchEvent) => {
  if (!cropCanvas.value) return
  
  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  cropStartPos.value = {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
  isCropping.value = true
}

// 更新裁剪
const updateCrop = (e: MouseEvent | TouchEvent) => {
  if (!isCropping.value || !cropCanvas.value || !cropRect.value) return
  
  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  const currentX = clientX - rect.left
  const currentY = clientY - rect.top
  
  const newRect = {
    x: Math.min(cropStartPos.value.x, currentX),
    y: Math.min(cropStartPos.value.y, currentY),
    width: Math.abs(currentX - cropStartPos.value.x),
    height: Math.abs(currentY - cropStartPos.value.y),
  }
  
  cropRect.value = newRect
  
  // 记录裁剪区域变化（节流，避免日志过多）
  if (!cropRectUpdateTimer.value) {
    cropRectUpdateTimer.value = setTimeout(() => {
      if (cropRect.value) {
        photoSearchLogger.cropRectChanged(cropRect.value)
      }
      cropRectUpdateTimer.value = null
    }, 300) // 300ms内只记录一次
  }
}

// 裁剪区域更新定时器（用于节流）
const cropRectUpdateTimer = ref<NodeJS.Timeout | null>(null)

// 结束裁剪
const endCrop = () => {
  isCropping.value = false
}

// 处理重拍
const handleRetake = () => {
  photoSearchLogger.retake()
  currentImage.value = null
  showCropView.value = false
  showResultView.value = false
  recognizedQuestion.value = ''
  recognizedQuestionData.value = null
  cropRect.value = null
}

// 处理搜索
const handleSearch = async () => {
  if (!currentImage.value || !cropRect.value || !cropCanvas.value) {
    showMessage('请先选择图片', 'warning')
    return
  }

  try {
    isSearching.value = true
    
    // 记录开始搜索
    photoSearchLogger.startSearch(cropRect.value, subject.value)
    
    // 获取裁剪后的图片
    const croppedFile = await getCroppedImage()
    if (!croppedFile) {
      photoSearchLogger.error('获取裁剪后的图片', new Error('裁剪失败'))
      showMessage('图片裁剪失败', 'error')
      return
    }

    // 调用图片识别API
    const question = await apiService.recognizeImage(croppedFile, subject.value)
    
    if (question) {
      photoSearchLogger.apiRecognizeImageResponse(true, question)
      recognizedQuestionData.value = question
      recognizedQuestion.value = question.title || question.question || ''
      showCropView.value = false
      showResultView.value = true
    } else {
      photoSearchLogger.apiRecognizeImageResponse(false)
      showMessage('未识别到题目，请尝试文本搜索', 'warning')
      showTextSearch.value = true
    }
  } catch (error) {
    photoSearchLogger.error('图片识别', error)
    console.error('图片识别失败:', error)
    showMessage('图片识别失败', 'error')
    showTextSearch.value = true
  } finally {
    isSearching.value = false
  }
}

// 获取裁剪后的图片
const getCroppedImage = (): Promise<File | null> => {
  return new Promise((resolve) => {
    if (!cropCanvas.value || !cropRect.value || !currentImage.value) {
      resolve(null)
      return
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }

    const sourceCanvas = cropCanvas.value
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) {
      resolve(null)
      return
    }

    // 计算裁剪区域在原图中的实际位置
    const scaleX = currentImage.value.file.size ? 1 : 1 // 简化处理，实际需要计算原图缩放比例
    const scaleY = 1

    canvas.width = cropRect.value.width
    canvas.height = cropRect.value.height

    // 从原图画布中提取裁剪区域
    ctx.drawImage(
      sourceCanvas,
      cropRect.value.x,
      cropRect.value.y,
      cropRect.value.width,
      cropRect.value.height,
      0,
      0,
      cropRect.value.width,
      cropRect.value.height
    )

    // 转换为 Blob 再转为 File
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
        photoSearchLogger.getCroppedImage(canvas.width, canvas.height, blob.size)
        resolve(file)
      } else {
        photoSearchLogger.error('获取裁剪后的图片', new Error('Blob转换失败'))
        resolve(null)
      }
    }, 'image/jpeg', 0.9)
  })
}

// 处理文本搜索
const handleTextSearch = async () => {
  if (!searchText.value.trim()) {
    showMessage('请输入搜索关键词', 'warning')
    return
  }

  try {
    isSearching.value = true
    
    photoSearchLogger.textSearch(searchText.value.trim(), subject.value)
    
    const question = await apiService.searchQuestionByText(searchText.value.trim(), subject.value)
    
    if (question) {
      photoSearchLogger.textSearchResponse(true, question)
      recognizedQuestionData.value = question
      recognizedQuestion.value = question.title || question.question || ''
      showCropView.value = false
      showResultView.value = true
      showTextSearch.value = false
    } else {
      photoSearchLogger.textSearchResponse(false)
      showMessage('未搜索到题目', 'warning')
    }
  } catch (error) {
    photoSearchLogger.error('文本搜索', error)
    console.error('文本搜索失败:', error)
    showMessage('文本搜索失败', 'error')
  } finally {
    isSearching.value = false
  }
}

// 处理添加到列表
const handleAddToList = async () => {
  if (!recognizedQuestionData.value) {
    showMessage('没有可添加的题目', 'warning')
    return
  }

  try {
    isAdding.value = true
    
    // 获取当前题目列表ID
    const questions = questionStore.questions
    const exercisesId = questions.map(q => q.bmNo || q.id).join(',')

    // 记录开始添加到列表
    photoSearchLogger.startAddToList(recognizedQuestionData.value, subject.value, exercisesId)

    // 构建添加请求
    const questionData = {
      ...recognizedQuestionData.value,
      exercisesId,
    }

    const success = await apiService.addQuestionToList(questionData, subject.value)
    
    if (success) {
      photoSearchLogger.apiAddToListResponse(true)
      showMessage('题目已添加到列表', 'success')
      
      // 刷新题目列表
      photoSearchLogger.refreshQuestionList(subject.value)
      await questionStore.fetchQuestions(subject.value, false)
      
      // 跳转到习题解答页面
      photoSearchLogger.navigateBack(subject.value)
      router.push({ name: 'exerciseSolve', query: { subject: subject.value } })
    } else {
      photoSearchLogger.apiAddToListResponse(false)
      showMessage('添加题目失败', 'error')
    }
  } catch (error) {
    photoSearchLogger.error('添加题目', error)
    console.error('添加题目失败:', error)
    showMessage('添加题目失败', 'error')
  } finally {
    isAdding.value = false
  }
}

// 组件挂载时初始化
onMounted(() => {
  // 记录页面加载
  photoSearchLogger.pageMounted(subject.value)
  
  // 如果路由中有科目参数，使用它
  if (route.query.subject) {
    // 可以在这里做其他初始化
  }
})

// 组件卸载时清理
onUnmounted(() => {
  // 清理资源
  if (cropRectUpdateTimer.value) {
    clearTimeout(cropRectUpdateTimer.value)
    cropRectUpdateTimer.value = null
  }
  currentImage.value = null
  cropRect.value = null
})
</script>

<style lang="scss" scoped>
.photo-search-view {
  width: 100%;
  height: 100vh;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px;
  z-index: 1000;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent);
}

.close-btn {
  color: white;
}

.preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
}

.camera-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.placeholder-text {
  margin-top: 16px;
  font-size: 16px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.crop-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
  position: relative;
}

.crop-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crop-canvas {
  max-width: 100%;
  max-height: 100%;
  cursor: crosshair;
  touch-action: none;
}

.crop-overlay {
  position: absolute;
  border: 2px dashed #4caf50;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.result-area {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: #f5f5f5;
}

.question-display {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.question-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #333;
}

.question-content {
  font-size: 16px;
  line-height: 1.6;
  color: #666;
}

.bottom-toolbar {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.action-btn {
  flex: 1;
  max-width: 200px;
  height: 48px;
}

.text-search-area {
  position: absolute;
  bottom: 100px;
  left: 16px;
  right: 16px;
  z-index: 100;
}

.search-input {
  background: white;
  border-radius: 8px;
}
</style>

