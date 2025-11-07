<template>
  <div v-if="isOpen" class="photo-search-fullscreen">
    <!-- 左上角返回按钮 -->
    <q-btn flat round dense icon="arrow_back" class="back-btn" @click="handleClose" />

    <!-- 相机预览/图片显示区域 -->
    <div class="camera-preview-area">
      <!-- 实时相机预览 -->
      <video
        v-if="showCameraPreview"
        ref="videoElement"
        autoplay
        playsinline
        class="camera-video"
      ></video>

      <!-- 已选择的图片预览（框选模式） -->
      <div v-if="showCropView" class="crop-container">
        <canvas
          ref="cropCanvas"
          :class="[
            'crop-canvas',
            { 'is-dragging': isDragging, 'is-drawing': isCropping, 'is-resizing': isResizing },
          ]"
          :style="{ cursor: currentCursor }"
          @mousedown="startCrop"
          @mousemove="handleMouseMove"
          @mouseup="endCrop"
          @mouseleave="handleMouseLeave"
          @wheel="handleWheel"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        ></canvas>
        <!-- 灰色蒙版层（四个遮罩层覆盖框选区域外的部分） -->
        <template v-if="cropRect">
          <!-- 顶部遮罩 -->
          <div class="crop-mask crop-mask-top" :style="cropMaskTopStyle"></div>
          <!-- 底部遮罩 -->
          <div class="crop-mask crop-mask-bottom" :style="cropMaskBottomStyle"></div>
          <!-- 左侧遮罩 -->
          <div class="crop-mask crop-mask-left" :style="cropMaskLeftStyle"></div>
          <!-- 右侧遮罩 -->
          <div class="crop-mask crop-mask-right" :style="cropMaskRightStyle"></div>
        </template>
        <!-- 框选遮罩 -->
        <div v-if="cropRect" class="crop-overlay" :style="cropOverlayStyle">
          <!-- 四个角的 L 形标记 -->
          <div class="crop-corner crop-corner-nw"></div>
          <div class="crop-corner crop-corner-ne"></div>
          <div class="crop-corner crop-corner-sw"></div>
          <div class="crop-corner crop-corner-se"></div>
        </div>
      </div>

      <!-- 识别结果视图 -->
      <div v-if="showResultView" class="result-container">
        <q-splitter v-model="splitterModel" :limits="[20, 80]" class="result-splitter">
          <template v-slot:before>
            <div class="image-panel">
              <div class="panel-title">原始图片</div>
              <div class="image-wrapper">
                <img v-if="imagePreview" :src="imagePreview" alt="原始图片" class="result-image" />
                <div v-else class="no-image-placeholder">
                  <q-icon name="image" size="48px" color="grey-5" />
                  <p>暂无图片</p>
                </div>
              </div>
            </div>
          </template>

          <template v-slot:separator>
            <div class="splitter-handle">
              <div class="splitter-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          </template>

          <template v-slot:after>
            <div class="question-panel">
              <div class="panel-title">识别结果</div>
              <div class="question-list-wrapper">
                <QuestionList
                  v-if="photoQuestionData"
                  :search-query="''"
                  :selected-subject-filter="null"
                  @question-selected="handleQuestionSelected"
                />
                <div v-else-if="!isSearching" class="no-question-placeholder">
                  <q-icon name="quiz" size="48px" color="grey-5" />
                  <p>未识别到题目</p>
                </div>
                <div v-else class="loading-placeholder">
                  <q-spinner color="primary" size="48px" />
                  <p>正在识别题目...</p>
                </div>
              </div>
            </div>
          </template>
        </q-splitter>
      </div>
    </div>

    <!-- 左侧学科选择面板（居中） -->
    <div class="subject-selector-panel" v-if="!showResultView">
      <div class="subject-selector">
        <div
          class="subject-option"
          :class="{ active: selectedSubject === 'math' }"
          @click="selectedSubject = 'math'"
        >
          <span>搜数学</span>
        </div>
        <div
          class="subject-option"
          :class="{ active: selectedSubject === 'biology' }"
          @click="selectedSubject = 'biology'"
        >
          <span>搜生物</span>
        </div>
      </div>
    </div>

    <!-- 右侧操作按钮 -->
    <div class="action-buttons-panel" v-if="!showCropView && !showResultView">
      <div
        class="action-btn gallery-btn"
        :class="{ disabled: !selectedSubject }"
        @click="handleSelectFromGallery"
      >
        <q-icon name="photo_library" size="24px" />
      </div>
      <div
        class="action-btn camera-btn"
        :class="{ active: showCameraPreview, disabled: !selectedSubject }"
        @click="handleCapturePhoto"
      >
        <q-icon name="camera_alt" size="24px" />
      </div>
    </div>

    <!-- 框选模式下的操作按钮 -->
    <div class="crop-actions-panel" v-if="showCropView && !showResultView">
      <div class="crop-action-btn" @click="handleRetake">
        <q-icon name="refresh" size="24px" />
      </div>
      <div
        class="crop-action-btn search-btn"
        :class="{ active: isSearching, disabled: !cropRect }"
        @click="handleSearch"
      >
        <q-spinner v-if="isSearching" color="white" size="20px" />
        <q-icon v-else name="search" size="24px" />
      </div>
    </div>

    <!-- 提示信息（拍照搜题前，记得先选对应学科啦！） -->
    <div class="hint-overlay" v-if="!showCropView && !showResultView && !selectedSubject">
      <div class="hint-text">拍照搜题前，记得先选对应学科啦！</div>
    </div>

    <!-- ImagePicker 组件 -->
    <ImagePicker />

    <!-- 抽屉：拍照问答结果 -->
    <Transition name="drawer-slide">
      <div v-if="showDrawer" class="photo-qa-drawer" @click.self="handleCloseDrawer">
        <div class="drawer-content" @click.stop>
          <!-- 识别图片区域 -->
          <div class="drawer-image-section">
            <div class="image-tabs">
              <div
                class="tab-item"
                :class="{ active: activeTab === 'photo' }"
                @click="activeTab = 'photo'"
              >
                拍照搜题
              </div>
              <div
                class="tab-item"
                :class="{ active: activeTab === 'keyword' }"
                @click="activeTab = 'keyword'"
              >
                关键词搜题
              </div>
            </div>

            <!-- 拍照搜题内容 -->
            <div v-if="activeTab === 'photo'" class="recognized-problem">
              <div
                class="problem-text"
                v-if="photoQuestionData"
                v-html="renderQuestionContent(photoQuestionData)"
              ></div>
            </div>

            <!-- 关键词搜题内容 -->
            <div v-if="activeTab === 'keyword'" class="keyword-search-container">
              <div class="keyword-input-wrapper">
                <q-input
                  v-model="keywordText"
                  type="textarea"
                  class="keyword-input"
                  placeholder="可输入关键字进行精确搜题:&#10;输入题目的关键词,空格或逗号分隔多个关键词"
                  :rows="4"
                  outlined
                  autogrow
                  @keydown.ctrl.enter="handleKeywordSearch"
                  @keydown.meta.enter="handleKeywordSearch"
                />
                <q-btn
                  round
                  class="keyword-search-btn"
                  color="primary"
                  icon="search"
                  @click="handleKeywordSearch"
                  :loading="isKeywordSearching"
                  :disable="!keywordText.trim()"
                />
              </div>
              <!-- 关键词搜索结果展示 -->
              <div
                v-if="keywordQuestionData && activeTab === 'keyword'"
                class="keyword-search-result"
              >
                <div class="problem-text" v-html="renderQuestionContent(keywordQuestionData)"></div>
              </div>
            </div>
          </div>
          <!-- ChatView 区域 -->
          <div class="drawer-chat-section">
            <ChatView
              v-if="currentQuestionData"
              :key="currentQuestionData?.bmNo || 'default'"
              ref="chatViewRef"
              type="ai-exercise"
              :override-question="currentQuestionData"
            >
              <template #input>
                <PhotoSearchInput
                  :model-value="chatInputMessage"
                  :current-question="currentQuestionData"
                  :placeholder-text="'按住提问'"
                  :is-loading="isChatLoading"
                  @update:model-value="chatInputMessage = $event"
                  @send-message="handleChatSendMessage"
                  @retake="handleRetake"
                  @favorite="handleFavoriteInChat"
                  @add-to-practice="handleAddToPracticeInChat"
                  @blur="onChatInputBlur"
                />
              </template>
            </ChatView>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import QuestionList from './QuestionList.vue'
import ImagePicker from './chat/ImagePicker.vue'
import ChatView from './ChatView.vue'
import PhotoSearchInput from './PhotoSearchInput.vue'
import { apiService } from '@/services/api-service'
import { ImagePickerAdapterFactory } from '@/adapters/ImagePickerAdapterFactory'
import type { IImagePickerAdapter } from '@/adapters/IImagePickerAdapter'
import { showMessage } from '@/utils'
import type { ExerciseItem } from '@/types'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { cameraStreamService } from '@/services/camera-stream-service'

interface Props {
  modelValue: boolean
  imageData?: {
    base64DataUrl?: string
    filePath?: string
    width?: number
    height?: number
    fileSize?: number
  }
  subject?: string
}

const props = withDefaults(defineProps<Props>(), {
  subject: 'math',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  retake: []
  'question-selected': [question: ExerciseItem]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const adapter: IImagePickerAdapter = ImagePickerAdapterFactory.getAdapter()
const { renderMessageContent } = useMessageRenderer()

// 检测当前环境（使用适配器工厂统一判断）
const isAndroid = computed(() => ImagePickerAdapterFactory.getEnvironment() === 'android')

// 状态管理
const selectedSubject = ref<string>(props.subject || '')
const showCameraPreview = ref(true)
const showCropView = ref(false)
const showResultView = ref(false)
const showDrawer = ref(false) // 抽屉显示状态
const imagePreview = ref<string>('')
const photoQuestionData = ref<ExerciseItem | null>(null) // 拍照搜题的数据
const keywordQuestionData = ref<ExerciseItem | null>(null) // 关键词搜题的数据
const isSearching = ref(false)
// 注意：不再使用 originalQuestions，因为不再修改全局 questionStore
const croppedImageBase64 = ref<string>('') // 裁剪后的图片 base64，用于抽屉显示
const activeTab = ref<'photo' | 'keyword'>('photo') // 标签页状态
const keywordText = ref<string>('') // 关键词输入
const isKeywordSearching = ref(false) // 关键词搜索状态

// ChatView 相关状态
const chatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
const chatInputMessage = ref<string>('')
const isChatLoading = ref(false)

// 根据当前tab返回对应的题目数据
const currentQuestionData = computed(() => {
  const data = activeTab.value === 'photo' ? photoQuestionData.value : keywordQuestionData.value
  return data
})

// 相机相关
const videoElement = ref<HTMLVideoElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)

// 框选相关
const cropCanvas = ref<HTMLCanvasElement | null>(null)
const isFromGallery = ref(false) // 标记图片来源：true=相册，false=相机
const cropRect = ref<{
  x: number
  y: number
  width: number
  height: number
} | null>(null)
const isCropping = ref(false)
const isDragging = ref(false)
const isResizing = ref(false)
const resizeHandle = ref<'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null>(null)
const cropStartPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const resizeStartPos = ref({ x: 0, y: 0, rect: { x: 0, y: 0, width: 0, height: 0 } })
const RESIZE_HANDLE_SIZE = 10 // 调整手柄的检测区域大小

// 缩放和平移相关
const imageScale = ref(1) // 图片缩放比例
const imageOffsetX = ref(0) // 图片X偏移
const imageOffsetY = ref(0) // 图片Y偏移
const isPanning = ref(false) // 是否正在平移图片
const panStartPos = ref({ x: 0, y: 0 }) // 平移起始位置
const panStartOffset = ref({ x: 0, y: 0 }) // 平移起始偏移
const MIN_SCALE = 0.5 // 最小缩放比例
const MAX_SCALE = 5 // 最大缩放比例
const SCALE_STEP = 0.1 // 缩放步长

// 触摸缩放相关
const touchDistance = ref(0) // 双指距离
const touchCenter = ref({ x: 0, y: 0 }) // 双指中心点
const isPinching = ref(false) // 是否正在捏合
const pinchStartScale = ref(1) // 捏合开始时的缩放比例
const pinchStartOffset = ref({ x: 0, y: 0 }) // 捏合开始时的偏移
// 图片在 canvas 上的绘制信息（用于坐标映射）
const imageDrawInfo = ref<{
  drawX: number
  drawY: number
  drawWidth: number
  drawHeight: number
  originalWidth: number
  originalHeight: number
} | null>(null)
// 原始绘制信息（不受缩放和平移影响，用于计算缩放中心）
const originalDrawInfo = ref<{
  drawX: number
  drawY: number
  drawWidth: number
  drawHeight: number
} | null>(null)
const currentImage = ref<{
  file: File
  preview: string
  base64DataUrl?: string
} | null>(null)

// 分屏组件模型值
const splitterModel = ref(50)

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

// 灰色蒙版样式（四个遮罩层）
const getContainerSize = () => {
  if (!cropCanvas.value) return { width: 0, height: 0 }
  const container = cropCanvas.value.parentElement
  if (!container) return { width: 0, height: 0 }
  const rect = container.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

// 顶部遮罩样式
const cropMaskTopStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getContainerSize()
  return {
    top: '0',
    left: '0',
    width: `${width}px`,
    height: `${cropRect.value.y}px`,
  }
})

// 底部遮罩样式
const cropMaskBottomStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width, height } = getContainerSize()
  const bottomY = cropRect.value.y + cropRect.value.height
  return {
    top: `${bottomY}px`,
    left: '0',
    width: `${width}px`,
    height: `${height - bottomY}px`,
  }
})

// 左侧遮罩样式
const cropMaskLeftStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    top: `${cropRect.value.y}px`,
    left: '0',
    width: `${cropRect.value.x}px`,
    height: `${cropRect.value.height}px`,
  }
})

// 右侧遮罩样式
const cropMaskRightStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getContainerSize()
  const rightX = cropRect.value.x + cropRect.value.width
  return {
    top: `${cropRect.value.y}px`,
    left: `${rightX}px`,
    width: `${width - rightX}px`,
    height: `${cropRect.value.height}px`,
  }
})

// 启动相机预览
// Android环境：使用实时相机流预览
// Web环境：使用Web相机预览
const startCamera = async () => {
  if (isAndroid.value) {
    // Android环境：启动实时相机流
    try {
      if (!videoElement.value) {
        await nextTick()
      }
      
      if (!videoElement.value) {
        console.error('Video element not found')
        return
      }

      showCameraPreview.value = true
      const status = await cameraStreamService.startStream(videoElement.value, {
        width: 1920,
        height: 1080,
        frameRate: 30,
        bitrate: 4000000,
      })

      if (!status.isRunning) {
        showMessage(status.error || '启动相机流失败', 'error')
        showCameraPreview.value = false
      }
    } catch (error) {
      console.error('启动Android相机流失败:', error)
      showMessage('无法启动相机流，请检查权限设置', 'warning')
      showCameraPreview.value = false
    }
  } else {
    // Web环境：启动相机预览（集成在对话框内）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 后置摄像头
        },
      })
      cameraStream.value = stream
      await nextTick()
      if (videoElement.value) {
        videoElement.value.srcObject = stream
      }
    } catch (error) {
      console.error('启动相机失败:', error)
      showMessage('无法访问相机，请检查权限设置', 'warning')
      showCameraPreview.value = false
    }
  }
}

// 停止相机预览
const stopCamera = async () => {
  if (isAndroid.value) {
    // Android环境：停止实时相机流
    try {
      await cameraStreamService.stopStream()
    } catch (error) {
      console.error('停止Android相机流失败:', error)
    }
  } else {
    // Web环境：停止Web相机预览
    if (cameraStream.value) {
      cameraStream.value.getTracks().forEach((track) => track.stop())
      cameraStream.value = null
    }
    if (videoElement.value) {
      videoElement.value.srcObject = null
    }
  }
}

// 从相机拍照
const captureFromCamera = async (): Promise<string | null> => {
  if (!videoElement.value) return null

  try {
    const videoWidth = videoElement.value.videoWidth
    const videoHeight = videoElement.value.videoHeight

    // 检查视频尺寸是否有效
    if (!videoWidth || !videoHeight || videoWidth === 0 || videoHeight === 0) {
      console.error('视频尺寸无效，相机可能未启动')
      return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoWidth
    canvas.height = videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(videoElement.value, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch (error) {
    console.error('拍照失败:', error)
    return null
  }
}

// 处理拍照
// 所有环境都从实时相机流中截图（相机已在对话框打开时启动）
const handleCapturePhoto = async () => {
  if (!selectedSubject.value) {
    showMessage('请先选择学科', 'warning')
    return
  }

  try {
    // 直接从实时相机流中截图（相机已在对话框打开时启动）
    const base64DataUrl = await captureFromCamera()
    if (!base64DataUrl) {
      showMessage('拍照失败', 'error')
      return
    }

    // 转换为 File 对象
    const file = await base64ToFile(base64DataUrl, 'photo.jpg')

    currentImage.value = {
      file,
      preview: base64DataUrl,
      base64DataUrl,
    }
    imagePreview.value = base64DataUrl

    // 标记图片来源为相机
    isFromGallery.value = false

    // 进入框选模式（隐藏相机预览，画面直接呈现，但相机流继续运行）
    showCameraPreview.value = false
    showCropView.value = true
    await nextTick()
    initCropCanvas()
  } catch (error) {
    console.error('拍照处理失败:', error)
    showMessage('拍照处理失败', 'error')
  }
}

// 处理从相册选择
const handleSelectFromGallery = async () => {
  if (!selectedSubject.value) {
    showMessage('请先选择学科', 'warning')
    return
  }
  try {
    // 直接调用适配器打开相册，不显示选择对话框
    const imageInfo = await adapter.selectFromGallery()

    if (imageInfo && imageInfo.base64DataUrl) {
      // 停止相机预览
      stopCamera()
      showCameraPreview.value = false

      // 转换为 File 对象
      const file = await base64ToFile(imageInfo.base64DataUrl, 'photo.jpg')

      currentImage.value = {
        file,
        preview: imageInfo.base64DataUrl,
        base64DataUrl: imageInfo.base64DataUrl,
      }
      imagePreview.value = imageInfo.base64DataUrl

      // 标记图片来源为相册
      isFromGallery.value = true

      // 进入框选模式
      showCropView.value = true
      await nextTick()
      initCropCanvas()
    }
  } catch (error) {
    console.error('选择图片失败:', error)
    showMessage('选择图片失败', 'error')
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

// 绘制图片到画布（支持缩放和平移）
const drawImage = () => {
  if (!cropCanvas.value || !currentImage.value || !originalDrawInfo.value) return

  const canvas = cropCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    const { drawX, drawY, drawWidth, drawHeight } = originalDrawInfo.value!

    // 计算应用缩放后的尺寸和位置（以中心为缩放点）
    const scaledWidth = drawWidth * imageScale.value
    const scaledHeight = drawHeight * imageScale.value
    const centerX = drawX + drawWidth / 2
    const centerY = drawY + drawHeight / 2
    const scaledX = centerX - scaledWidth / 2 + imageOffsetX.value
    const scaledY = centerY - scaledHeight / 2 + imageOffsetY.value

    // 清空画布
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制图片（应用缩放和平移）
    ctx.drawImage(img, scaledX, scaledY, scaledWidth, scaledHeight)

    // 更新绘制信息（用于坐标映射）
    if (imageDrawInfo.value) {
      imageDrawInfo.value = {
        ...imageDrawInfo.value,
        drawX: scaledX,
        drawY: scaledY,
        drawWidth: scaledWidth,
        drawHeight: scaledHeight,
      }
    }
  }
  img.src = currentImage.value.preview
}

// 初始化裁剪画布
const initCropCanvas = () => {
  if (!cropCanvas.value || !currentImage.value) return

  const canvas = cropCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 重置缩放和平移
  imageScale.value = 1
  imageOffsetX.value = 0
  imageOffsetY.value = 0

  // 设置画布大小为全屏（与容器相同）
  const container = canvas.parentElement
  if (container) {
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
  } else {
    // 如果没有容器，使用窗口尺寸
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  const img = new Image()
  img.onload = () => {
    const canvasAspect = canvas.width / canvas.height
    const imgAspect = img.width / img.height

    let drawWidth = canvas.width
    let drawHeight = canvas.height
    let drawX = 0
    let drawY = 0

    // 根据图片来源决定使用 cover 还是 contain 模式
    if (isFromGallery.value) {
      // 从相册加载：使用 contain 模式，完整显示图片，保持宽高比
      if (imgAspect > canvasAspect) {
        // 图片更宽，以宽度为准，上下留白
        drawWidth = canvas.width
        drawHeight = drawWidth / imgAspect
        drawY = (canvas.height - drawHeight) / 2
      } else {
        // 图片更高，以高度为准，左右留白
        drawHeight = canvas.height
        drawWidth = drawHeight * imgAspect
        drawX = (canvas.width - drawWidth) / 2
      }
    } else {
      // 从相机拍摄：使用 cover 模式，填充整个 canvas
      if (imgAspect > canvasAspect) {
        // 图片更宽，以高度为准，左右裁剪
        drawHeight = canvas.height
        drawWidth = drawHeight * imgAspect
        drawX = (canvas.width - drawWidth) / 2
      } else {
        // 图片更高，以宽度为准，上下裁剪
        drawWidth = canvas.width
        drawHeight = drawWidth / imgAspect
        drawY = (canvas.height - drawHeight) / 2
      }
    }

    // 保存原始绘制信息（不受缩放和平移影响）
    originalDrawInfo.value = {
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    }

    // 保存图片绘制信息（用于坐标映射）
    imageDrawInfo.value = {
      drawX,
      drawY,
      drawWidth,
      drawHeight,
      originalWidth: img.width,
      originalHeight: img.height,
    }

    // 绘制图片
    drawImage()

    // 初始化时不创建裁剪框，等待用户绘制
    cropRect.value = null
  }
  img.src = currentImage.value.preview
}

// 判断点是否在裁剪框内
const isPointInCropRect = (x: number, y: number): boolean => {
  if (!cropRect.value) return false
  return (
    x >= cropRect.value.x &&
    x <= cropRect.value.x + cropRect.value.width &&
    y >= cropRect.value.y &&
    y <= cropRect.value.y + cropRect.value.height
  )
}

// 检测鼠标位置在哪个调整区域
const getResizeHandle = (
  x: number,
  y: number,
): 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null => {
  if (!cropRect.value) return null

  const rect = cropRect.value
  const size = RESIZE_HANDLE_SIZE

  // 检测四个角
  const isNearNW = Math.abs(x - rect.x) < size && Math.abs(y - rect.y) < size
  const isNearNE = Math.abs(x - (rect.x + rect.width)) < size && Math.abs(y - rect.y) < size
  const isNearSW = Math.abs(x - rect.x) < size && Math.abs(y - (rect.y + rect.height)) < size
  const isNearSE =
    Math.abs(x - (rect.x + rect.width)) < size && Math.abs(y - (rect.y + rect.height)) < size

  if (isNearNW) return 'nw'
  if (isNearNE) return 'ne'
  if (isNearSW) return 'sw'
  if (isNearSE) return 'se'

  // 检测四个边
  const isNearTop = Math.abs(y - rect.y) < size && x >= rect.x && x <= rect.x + rect.width
  const isNearBottom =
    Math.abs(y - (rect.y + rect.height)) < size && x >= rect.x && x <= rect.x + rect.width
  const isNearLeft = Math.abs(x - rect.x) < size && y >= rect.y && y <= rect.y + rect.height
  const isNearRight =
    Math.abs(x - (rect.x + rect.width)) < size && y >= rect.y && y <= rect.y + rect.height

  if (isNearTop) return 'n'
  if (isNearBottom) return 's'
  if (isNearLeft) return 'w'
  if (isNearRight) return 'e'

  return null
}

// 获取调整手柄对应的光标样式
const getCursorForHandle = (
  handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null,
): string => {
  if (!handle) return 'default'

  const cursorMap: Record<string, string> = {
    n: 'n-resize',
    s: 's-resize',
    e: 'e-resize',
    w: 'w-resize',
    nw: 'nw-resize',
    ne: 'ne-resize',
    sw: 'sw-resize',
    se: 'se-resize',
  }

  return cursorMap[handle] || 'default'
}

// 开始裁剪（绘制、拖动或调整大小）
const startCrop = (e: MouseEvent | TouchEvent) => {
  if (!cropCanvas.value) return

  // 阻止默认行为，避免页面滚动等
  e.preventDefault()

  // 如果是触摸事件且有两个手指，不处理（交给触摸手势处理）
  if ('touches' in e && e.touches.length === 2) {
    return
  }

  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const clickX = clientX - rect.left
  const clickY = clientY - rect.top

  // 如果图片已放大，且点击不在裁剪框内，则进入平移模式
  if (imageScale.value > 1) {
    const inCropRect = cropRect.value && isPointInCropRect(clickX, clickY)
    const inResizeHandle = cropRect.value ? getResizeHandle(clickX, clickY) !== null : false
    if (!inCropRect && !inResizeHandle) {
      isPanning.value = true
      panStartPos.value = { x: clickX, y: clickY }
      panStartOffset.value = { x: imageOffsetX.value, y: imageOffsetY.value }
      return
    }
  }

  // 首先检测是否在调整区域
  const handle = cropRect.value ? getResizeHandle(clickX, clickY) : null
  if (handle && cropRect.value) {
    // 调整大小模式
    isResizing.value = true
    resizeHandle.value = handle
    resizeStartPos.value = {
      x: clickX,
      y: clickY,
      rect: {
        x: cropRect.value.x,
        y: cropRect.value.y,
        width: cropRect.value.width,
        height: cropRect.value.height,
      },
    }
  } else if (cropRect.value && isPointInCropRect(clickX, clickY)) {
    // 拖动模式：计算拖动偏移量
    isDragging.value = true
    dragOffset.value = {
      x: clickX - cropRect.value.x,
      y: clickY - cropRect.value.y,
    }
  } else {
    // 绘制模式：开始绘制新的裁剪框
    isCropping.value = true
    cropStartPos.value = {
      x: clickX,
      y: clickY,
    }
    // 清除旧框，开始绘制新框
    cropRect.value = {
      x: clickX,
      y: clickY,
      width: 0,
      height: 0,
    }
  }
}

// 更新裁剪（绘制、拖动或调整大小）
const updateCrop = (e: MouseEvent | TouchEvent) => {
  if (!cropCanvas.value) return

  // 如果是触摸事件且有两个手指，不处理（交给触摸手势处理）
  if ('touches' in e && e.touches.length === 2) {
    return
  }

  // 如果正在平移图片
  if (isPanning.value) {
    e.preventDefault()
    const canvas = cropCanvas.value
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const currentX = clientX - rect.left
    const currentY = clientY - rect.top

    const deltaX = currentX - panStartPos.value.x
    const deltaY = currentY - panStartPos.value.y

    imageOffsetX.value = panStartOffset.value.x + deltaX
    imageOffsetY.value = panStartOffset.value.y + deltaY

    // 限制平移范围，防止图片移出画布太远
    if (imageDrawInfo.value) {
      const { drawWidth, drawHeight } = imageDrawInfo.value
      const maxOffsetX = Math.max(0, (drawWidth * imageScale.value - canvas.width) / 2)
      const maxOffsetY = Math.max(0, (drawHeight * imageScale.value - canvas.height) / 2)
      imageOffsetX.value = Math.max(-maxOffsetX, Math.min(maxOffsetX, imageOffsetX.value))
      imageOffsetY.value = Math.max(-maxOffsetY, Math.min(maxOffsetY, imageOffsetY.value))
    }

    drawImage()
    return
  }

  // 只在拖动、绘制或调整大小状态下更新
  if (!isDragging.value && !isCropping.value && !isResizing.value) return

  // 阻止默认行为
  e.preventDefault()

  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const currentX = clientX - rect.left
  const currentY = clientY - rect.top

  if (isResizing.value && cropRect.value && resizeHandle.value) {
    // 调整大小模式
    const start = resizeStartPos.value
    const deltaX = currentX - start.x
    const deltaY = currentY - start.y
    const originalRect = start.rect

    // 初始化新矩形
    const newRect = {
      x: originalRect.x,
      y: originalRect.y,
      width: originalRect.width,
      height: originalRect.height,
    }

    // 根据调整的手柄更新裁剪框
    switch (resizeHandle.value) {
      case 'nw': // 左上角
        newRect.x = Math.max(0, originalRect.x + deltaX)
        newRect.y = Math.max(0, originalRect.y + deltaY)
        newRect.width = originalRect.width - deltaX
        newRect.height = originalRect.height - deltaY
        break
      case 'ne': // 右上角
        newRect.y = Math.max(0, originalRect.y + deltaY)
        newRect.width = originalRect.width + deltaX
        newRect.height = originalRect.height - deltaY
        break
      case 'sw': // 左下角
        newRect.x = Math.max(0, originalRect.x + deltaX)
        newRect.width = originalRect.width - deltaX
        newRect.height = originalRect.height + deltaY
        break
      case 'se': // 右下角
        newRect.width = originalRect.width + deltaX
        newRect.height = originalRect.height + deltaY
        break
      case 'n': // 上边
        newRect.y = Math.max(0, originalRect.y + deltaY)
        newRect.height = originalRect.height - deltaY
        break
      case 's': // 下边
        newRect.height = originalRect.height + deltaY
        break
      case 'w': // 左边
        newRect.x = Math.max(0, originalRect.x + deltaX)
        newRect.width = originalRect.width - deltaX
        break
      case 'e': // 右边
        newRect.width = originalRect.width + deltaX
        break
    }

    // 确保最小尺寸
    if (newRect.width < 20) {
      if (
        resizeHandle.value === 'w' ||
        resizeHandle.value === 'nw' ||
        resizeHandle.value === 'sw'
      ) {
        newRect.x = originalRect.x + originalRect.width - 20
      }
      newRect.width = 20
    }
    if (newRect.height < 20) {
      if (
        resizeHandle.value === 'n' ||
        resizeHandle.value === 'nw' ||
        resizeHandle.value === 'ne'
      ) {
        newRect.y = originalRect.y + originalRect.height - 20
      }
      newRect.height = 20
    }

    // 限制在画布范围内
    newRect.x = Math.max(0, Math.min(newRect.x, canvas.width))
    newRect.y = Math.max(0, Math.min(newRect.y, canvas.height))
    newRect.width = Math.min(newRect.width, canvas.width - newRect.x)
    newRect.height = Math.min(newRect.height, canvas.height - newRect.y)

    cropRect.value = newRect
  } else if (isDragging.value && cropRect.value) {
    // 拖动模式：移动裁剪框
    const newX = currentX - dragOffset.value.x
    const newY = currentY - dragOffset.value.y

    // 限制在画布范围内
    const maxX = canvas.width - cropRect.value.width
    const maxY = canvas.height - cropRect.value.height

    cropRect.value = {
      ...cropRect.value,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    }
  } else if (isCropping.value) {
    // 绘制模式：更新裁剪框大小
    const newRect = {
      x: Math.max(0, Math.min(cropStartPos.value.x, currentX)),
      y: Math.max(0, Math.min(cropStartPos.value.y, currentY)),
      width: Math.abs(currentX - cropStartPos.value.x),
      height: Math.abs(currentY - cropStartPos.value.y),
    }

    // 限制在画布范围内
    newRect.width = Math.min(newRect.width, canvas.width - newRect.x)
    newRect.height = Math.min(newRect.height, canvas.height - newRect.y)

    cropRect.value = newRect
  }
}

// 结束裁剪（绘制、拖动或调整大小）
const endCrop = () => {
  isCropping.value = false
  isDragging.value = false
  isResizing.value = false
  isPanning.value = false
  resizeHandle.value = null

  // 如果绘制出的框太小，清除它（允许重新绘制）
  if (cropRect.value && cropRect.value.width < 10 && cropRect.value.height < 10) {
    cropRect.value = null
  }
}

// 当前光标样式
const currentCursor = ref('crosshair')

// 处理鼠标移动（更新光标样式或更新裁剪）
const handleMouseMove = (e: MouseEvent) => {
  if (!cropCanvas.value) return

  // 如果正在拖动、绘制或调整大小，则更新裁剪
  if (isDragging.value || isCropping.value || isResizing.value) {
    updateCrop(e)
    return
  }

  // 否则更新光标样式
  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const handle = cropRect.value ? getResizeHandle(x, y) : null
  if (handle) {
    currentCursor.value = getCursorForHandle(handle)
  } else if (cropRect.value && isPointInCropRect(x, y)) {
    currentCursor.value = 'move'
  } else {
    currentCursor.value = 'crosshair'
  }
}

// 处理鼠标离开
const handleMouseLeave = () => {
  if (!isDragging.value && !isCropping.value && !isResizing.value && !isPanning.value) {
    endCrop()
  }
  currentCursor.value = 'crosshair'
}

// 处理滚轮缩放
const handleWheel = (e: WheelEvent) => {
  if (!cropCanvas.value || !originalDrawInfo.value) return

  e.preventDefault()

  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // 计算缩放增量
  const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, imageScale.value + delta))

  // 如果缩放比例没有变化，直接返回
  if (newScale === imageScale.value) return

  // 计算鼠标位置相对于图片中心的比例
  const { drawX, drawY, drawWidth, drawHeight } = originalDrawInfo.value
  const centerX = drawX + drawWidth / 2
  const centerY = drawY + drawHeight / 2
  const relativeX = (mouseX - centerX) / drawWidth
  const relativeY = (mouseY - centerY) / drawHeight

  // 计算缩放后的偏移，使鼠标指向的点保持在同一位置
  const oldScaledWidth = drawWidth * imageScale.value
  const oldScaledHeight = drawHeight * imageScale.value
  const newScaledWidth = drawWidth * newScale
  const newScaledHeight = drawHeight * newScale

  imageOffsetX.value += (oldScaledWidth - newScaledWidth) * relativeX
  imageOffsetY.value += (oldScaledHeight - newScaledHeight) * relativeY

  imageScale.value = newScale

  // 限制平移范围
  const maxOffsetX = Math.max(0, (drawWidth * newScale - canvas.width) / 2)
  const maxOffsetY = Math.max(0, (drawHeight * newScale - canvas.height) / 2)
  imageOffsetX.value = Math.max(-maxOffsetX, Math.min(maxOffsetX, imageOffsetX.value))
  imageOffsetY.value = Math.max(-maxOffsetY, Math.min(maxOffsetY, imageOffsetY.value))

  drawImage()
}

// 计算两点之间的距离
const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

// 处理触摸开始
const handleTouchStart = (e: TouchEvent) => {
  if (!cropCanvas.value) return

  e.preventDefault()

  if (e.touches.length === 2) {
    // 双指捏合开始
    isPinching.value = true
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    const canvas = cropCanvas.value
    const rect = canvas.getBoundingClientRect()

    touchDistance.value = getDistance(
      touch1.clientX,
      touch1.clientY,
      touch2.clientX,
      touch2.clientY
    )
    touchCenter.value = {
      x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
      y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
    }
    pinchStartScale.value = imageScale.value
    pinchStartOffset.value = { x: imageOffsetX.value, y: imageOffsetY.value }
  } else if (e.touches.length === 1) {
    // 单指触摸，交给 startCrop 处理
    startCrop(e)
  }
}

// 处理触摸移动
const handleTouchMove = (e: TouchEvent) => {
  if (!cropCanvas.value || !originalDrawInfo.value) return

  e.preventDefault()

  if (e.touches.length === 2 && isPinching.value) {
    // 双指捏合缩放
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    const canvas = cropCanvas.value

    const newDistance = getDistance(
      touch1.clientX,
      touch1.clientY,
      touch2.clientX,
      touch2.clientY
    )
    const scaleRatio = newDistance / touchDistance.value
    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, pinchStartScale.value * scaleRatio)
    )

    // 计算双指中心点相对于图片中心的比例
    const { drawX, drawY, drawWidth, drawHeight } = originalDrawInfo.value
    const centerX = drawX + drawWidth / 2
    const centerY = drawY + drawHeight / 2
    const relativeX = (touchCenter.value.x - centerX) / drawWidth
    const relativeY = (touchCenter.value.y - centerY) / drawHeight

    // 计算缩放后的偏移
    const oldScaledWidth = drawWidth * pinchStartScale.value
    const oldScaledHeight = drawHeight * pinchStartScale.value
    const newScaledWidth = drawWidth * newScale
    const newScaledHeight = drawHeight * newScale

    imageOffsetX.value =
      pinchStartOffset.value.x + (oldScaledWidth - newScaledWidth) * relativeX
    imageOffsetY.value =
      pinchStartOffset.value.y + (oldScaledHeight - newScaledHeight) * relativeY

    imageScale.value = newScale

    // 限制平移范围
    const maxOffsetX = Math.max(0, (drawWidth * newScale - canvas.width) / 2)
    const maxOffsetY = Math.max(0, (drawHeight * newScale - canvas.height) / 2)
    imageOffsetX.value = Math.max(-maxOffsetX, Math.min(maxOffsetX, imageOffsetX.value))
    imageOffsetY.value = Math.max(-maxOffsetY, Math.min(maxOffsetY, imageOffsetY.value))

    drawImage()
  } else if (e.touches.length === 1) {
    // 单指触摸，交给 updateCrop 处理
    updateCrop(e)
  }
}

// 处理触摸结束
const handleTouchEnd = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    // 所有手指都离开
    isPinching.value = false
    endCrop()
  } else if (e.touches.length === 1 && isPinching.value) {
    // 从双指变为单指，结束捏合，开始单指操作
    isPinching.value = false
    touchDistance.value = 0
  }
}

// 处理重拍
const handleRetake = () => {
  currentImage.value = null
  imagePreview.value = ''
  showCropView.value = false
  showResultView.value = false
  showDrawer.value = false // 关闭抽屉
  cropRect.value = null
  imageDrawInfo.value = null
  originalDrawInfo.value = null
  photoQuestionData.value = null
  isCropping.value = false
  isDragging.value = false
  isPanning.value = false
  isPinching.value = false
  imageScale.value = 1
  imageOffsetX.value = 0
  imageOffsetY.value = 0

  // 注意：不再需要恢复原始题目列表，因为我们没有修改全局 questionStore

  // 重新显示相机预览（相机已在对话框打开时启动，无需重新启动）
  showCameraPreview.value = true

  emit('retake')
}

// 处理搜索
const handleSearch = async () => {
  if (!currentImage.value || !cropRect.value || !cropCanvas.value) {
    showMessage('请先选择图片区域', 'warning')
    return
  }

  try {
    isSearching.value = true

    // 获取裁剪后的图片
    const croppedFile = await getCroppedImage()
    if (!croppedFile) {
      showMessage('图片裁剪失败', 'error')
      return
    }

    // 获取裁剪后图片的 base64，用于抽屉显示
    const reader = new FileReader()
    croppedImageBase64.value = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(croppedFile)
    })

    // 调用图片识别API
    const question = await apiService.recognizeImage(croppedFile, selectedSubject.value)

    if (question) {
      photoQuestionData.value = question

      // 注意：不再修改全局 questionStore，避免场景污染
      // 题目通过 ChatView 的 overrideQuestion prop 传递，不会影响其他页面

      // 隐藏框选视图，显示抽屉
      showCropView.value = false
      showDrawer.value = true
      activeTab.value = 'photo' // 默认显示拍照搜题标签
    } else {
      showMessage('未识别到题目', 'warning')
    }
  } catch (error) {
    console.error('图片识别失败:', error)
    showMessage('图片识别失败', 'error')
  } finally {
    isSearching.value = false
  }
}

// 获取裁剪后的图片
const getCroppedImage = (): Promise<File | null> => {
  return new Promise((resolve) => {
    if (!cropCanvas.value || !cropRect.value || !currentImage.value || !imageDrawInfo.value) {
      resolve(null)
      return
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }

    const img = new Image()
    img.onload = () => {
      // 将 canvas 上的裁剪区域坐标映射回原始图片坐标
      const { drawX, drawY, drawWidth, drawHeight, originalWidth, originalHeight } =
        imageDrawInfo.value!

      // 计算 canvas 上的裁剪区域相对于图片绘制区域的位置
      const cropXInImage = cropRect.value!.x - drawX
      const cropYInImage = cropRect.value!.y - drawY
      const cropWidthInImage = cropRect.value!.width
      const cropHeightInImage = cropRect.value!.height

      // 将绘制区域的坐标映射回原始图片坐标
      const scaleX = originalWidth / drawWidth
      const scaleY = originalHeight / drawHeight

      const sourceX = Math.max(0, cropXInImage * scaleX)
      const sourceY = Math.max(0, cropYInImage * scaleY)
      const sourceWidth = Math.min(originalWidth - sourceX, cropWidthInImage * scaleX)
      const sourceHeight = Math.min(originalHeight - sourceY, cropHeightInImage * scaleY)

      // 设置输出 canvas 尺寸（保持裁剪区域的宽高比）
      canvas.width = cropRect.value!.width
      canvas.height = cropRect.value!.height

      // 从原始图片裁剪
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      // 转换为 Blob 再转为 File
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
            resolve(file)
          } else {
            resolve(null)
          }
        },
        'image/jpeg',
        0.9,
      )
    }
    img.onerror = () => {
      resolve(null)
    }
    img.src = currentImage.value.preview
  })
}

// 处理题目选中
const handleQuestionSelected = (question: ExerciseItem) => {
  emit('question-selected', question)
}

// 处理关键词搜索
const handleKeywordSearch = async () => {
  if (!keywordText.value.trim()) {
    showMessage('请输入题目关键字再搜索', 'warning')
    return
  }

  try {
    isKeywordSearching.value = true

    // 调用关键词搜索API
    const question = await apiService.searchQuestionByText(
      keywordText.value.trim(),
      selectedSubject.value,
    )

    if (question) {
      keywordQuestionData.value = question

      // 注意：不再修改全局 questionStore，避免场景污染
      // 题目通过 ChatView 的 overrideQuestion prop 传递，不会影响其他页面

      // 如果抽屉未打开，则打开抽屉
      if (!showDrawer.value) {
        showDrawer.value = true
      }

      // 保持在关键词标签页显示结果
      // activeTab 保持在 'keyword'，不切换
    } else {
      showMessage('未搜索到相关题目', 'warning')
    }
  } catch (error) {
    console.error('关键词搜索失败:', error)
    showMessage('关键词搜索失败', 'error')
  } finally {
    isKeywordSearching.value = false
  }
}

// 渲染题目内容（支持Markdown和公式）
const renderQuestionContent = (question: ExerciseItem): string => {
  const content = question.question || question.title || ''
  return renderMessageContent(content)
}

// 处理关闭抽屉
const handleCloseDrawer = () => {
  showDrawer.value = false
  activeTab.value = 'photo'
  keywordText.value = ''

  // 重置相关状态
  showCropView.value = false
  showResultView.value = false
  currentImage.value = null
  imagePreview.value = ''
  cropRect.value = null
  imageDrawInfo.value = null
  photoQuestionData.value = null
  keywordQuestionData.value = null
  croppedImageBase64.value = ''

  // 恢复原始题目列表
  restoreOriginalQuestions()

  // 重新显示相机预览（相机已在对话框打开时启动，无需重新启动）
  showCameraPreview.value = true
}

// 处理关闭
const handleClose = () => {
  stopCamera()
  restoreOriginalQuestions()
  showDrawer.value = false
  isOpen.value = false
}

// 恢复状态（不再需要恢复原始题目列表，因为我们没有修改全局 questionStore）
const restoreOriginalQuestions = () => {
  // 注意：不再需要恢复原始题目列表，因为我们没有修改全局 questionStore
  photoQuestionData.value = null
  keywordQuestionData.value = null
}

// ChatView 相关处理函数
// 由于 ChatView 的 sendMessage 使用内部的 inputMessage
// 我们需要通过 ref 访问 ChatView 的内部状态并同步
const handleChatSendMessage = async () => {
  if (!chatInputMessage.value.trim() || isChatLoading.value) {
    return
  }

  if (!chatViewRef.value) {
    return
  }

  try {
    isChatLoading.value = true

    // 通过 ref 访问 ChatView 暴露的接口
    if (chatViewRef.value) {
      // 同步输入消息到 ChatView
      chatViewRef.value.inputMessage = chatInputMessage.value.trim()
      // 调用 ChatView 的 sendMessage 方法
      await chatViewRef.value.sendMessage()
      // 清空输入
      chatInputMessage.value = ''
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    showMessage('发送消息失败', 'error')
  } finally {
    isChatLoading.value = false
  }
}

const handleFavoriteInChat = () => {
  // 收藏功能已在 PhotoSearchInput 中实现
  // 这里可以添加额外的逻辑，如刷新UI等
}

const handleAddToPracticeInChat = async () => {
  // 加入练习功能已在 PhotoSearchInput 中实现
  // 这里可以添加额外的逻辑，如刷新UI等
}

const onChatInputBlur = () => {
  // 输入框失焦处理
}

// 监听对话框打开/关闭
watch(isOpen, (newValue) => {
  if (newValue) {
    // 打开时启动相机预览（Android环境使用实时相机流，Web环境使用Web相机预览）
    selectedSubject.value = props.subject || ''
    
    // 所有环境都启动相机预览
    startCamera()

    // 如果有传入的图片数据，直接进入框选模式
    if (props.imageData?.base64DataUrl) {
      imagePreview.value = props.imageData.base64DataUrl
      currentImage.value = {
        file: new File([], 'photo.jpg'),
        preview: props.imageData.base64DataUrl,
        base64DataUrl: props.imageData.base64DataUrl,
      }
      showCameraPreview.value = false
      showCropView.value = true
      nextTick(() => {
        initCropCanvas()
        recognizeImage()
      })
    }
  } else {
    // 关闭时停止相机并重置状态
    stopCamera()
    showCameraPreview.value = false
    showCropView.value = false
    showResultView.value = false
    showDrawer.value = false
    currentImage.value = null
    imagePreview.value = ''
    cropRect.value = null
    imageDrawInfo.value = null
    originalDrawInfo.value = null
    isCropping.value = false
    isDragging.value = false
    isPanning.value = false
    isPinching.value = false
    imageScale.value = 1
    imageOffsetX.value = 0
    imageOffsetY.value = 0
    croppedImageBase64.value = ''
    restoreOriginalQuestions()
  }
})

// 监听 imageData 变化
watch(
  () => props.imageData,
  (newData) => {
    if (newData?.base64DataUrl && isOpen.value) {
      imagePreview.value = newData.base64DataUrl
    }
  },
  { immediate: true },
)

// 识别图片（用于从外部传入图片数据的情况）
const recognizeImage = async () => {
  if (!props.imageData?.base64DataUrl) {
    return
  }

  try {
    isSearching.value = true

    // 将 base64 转换为 File 对象
    const file = await base64ToFile(props.imageData.base64DataUrl, 'photo.jpg')

    // 调用图片识别API
    const question = await apiService.recognizeImage(file, selectedSubject.value)

    if (question) {
      photoQuestionData.value = question

      // 注意：不再修改全局 questionStore，避免场景污染

      showCropView.value = false
      showResultView.value = true
    } else {
      showMessage('未识别到题目', 'warning')
    }
  } catch (error) {
    console.error('图片识别失败:', error)
    showMessage('图片识别失败', 'error')
  } finally {
    isSearching.value = false
  }
}

// 组件卸载时清理
onUnmounted(() => {
  stopCamera()
  restoreOriginalQuestions()
})
</script>

<style lang="scss" scoped>
.photo-search-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  z-index: 10000;
  overflow: hidden;
}

// 返回按钮
.back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10001;
  background: rgba(0, 0, 0, 0.5);
  color: white;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

// 相机预览区域
.camera-preview-area {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

// 框选容器
.crop-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.crop-canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: crosshair;
  touch-action: none;
  user-select: none;

  &.is-dragging {
    cursor: move;
  }

  &.is-drawing {
    cursor: crosshair;
  }
}

// 灰色蒙版样式
.crop-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.5); /* 灰色半透明蒙版 */
  pointer-events: none;
  z-index: 1;
}

.crop-overlay {
  position: absolute;
  background: transparent; /* 框选区域透明，显示清晰的图片 */
  pointer-events: none;
  z-index: 2; /* 确保框选区域在蒙版之上 */
}

/* 裁剪框四个角的 L 形标记 */
.crop-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  pointer-events: none;
}

/* 左上角 L 形 */
.crop-corner-nw {
  top: 0;
  left: 0;
  border-top: 4px solid white;
  border-left: 4px solid white;
}

/* 右上角 L 形 */
.crop-corner-ne {
  top: 0;
  right: 0;
  border-top: 4px solid white;
  border-right: 4px solid white;
}

/* 左下角 L 形 */
.crop-corner-sw {
  bottom: 0;
  left: 0;
  border-bottom: 4px solid white;
  border-left: 4px solid white;
}

/* 右下角 L 形 */
.crop-corner-se {
  bottom: 0;
  right: 0;
  border-bottom: 4px solid white;
  border-right: 4px solid white;
}

// 结果视图
.result-container {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
}

.result-splitter {
  height: 100%;
}

.image-panel,
.question-panel {
  background: white;
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.panel-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.image-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #fafafa;
  border-radius: 4px;
  min-height: 200px;
}

.result-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.no-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.3);
  padding: 32px;
}

.question-list-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.no-question-placeholder,
.loading-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(0, 0, 0, 0.3);
  padding: 32px;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.splitter-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #e0e0e0;
  cursor: col-resize;
  transition: background 0.2s;

  &:hover {
    background: #bdbdbd;
  }
}

.splitter-dots {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .dot {
    width: 4px;
    height: 4px;
    background: #666;
    border-radius: 50%;
  }
}

// 左侧学科选择面板
.subject-selector-panel {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10001;
  border-radius: 12px;
}

.subject-selector {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: #848483;
}

.subject-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &.active {
    background: #7a55ff;
    color: white;
  }
}

// 右侧操作按钮面板
.action-buttons-panel {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10001;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  &.active {
    background: #7a55ff;
    color: white;

    &:hover {
      background: #7a55ff;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:hover {
      transform: none;
      background: rgba(255, 255, 255, 0.9);
    }
  }
}

// 框选模式下的操作按钮
.crop-actions-panel {
  position: absolute;
  right: 20px;
  bottom: 40px;
  z-index: 10001;
  display: flex;
  gap: 16px;
  align-items: center;
}

.crop-action-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  &.active {
    background: #7a55ff;
    color: white;

    &:hover {
      background: #7a55ff;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:hover {
      transform: none;
      background: rgba(255, 255, 255, 0.9);
    }
  }
}

// 提示信息
.hint-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
}

.hint-text {
  background: #7a55ff;
  color: white;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}

// 抽屉样式
.photo-qa-drawer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10002;
  display: flex;
  align-items: flex-end;
}

.drawer-content {
  width: 100%;
  height: 90vh;
  max-height: 90vh;
  background: white;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

// 抽屉动画
.drawer-slide-enter-active {
  transition: all 0.3s ease-out;
}

.drawer-slide-leave-active {
  transition: all 0.3s ease-in;
}

.drawer-slide-enter-from {
  opacity: 0;

  .drawer-content {
    transform: translateY(100%);
  }
}

.drawer-slide-leave-to {
  opacity: 0;

  .drawer-content {
    transform: translateY(100%);
  }
}

// 识别图片区域
.drawer-image-section {
  flex-shrink: 0;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  max-height: 40vh;
  overflow-y: auto;
}

.image-tabs {
  display: flex;
  width: 100%;
  padding: 12px 16px 0;
  gap: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.tab-item {
  flex: 1;
  padding: 8px 16px;
  font-size: 14px;
  color: #666;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-radius: 8px;
  text-align: center;

  &.active {
    color: #333;
    background: white;
    font-weight: 600;
    border-bottom: 2px solid white;
    margin-bottom: -1px;
    z-index: 1;
  }

  &:not(.active) {
    border-bottom: 1px solid #e0e0e0;
  }
}

.recognized-problem {
  padding: 16px;
  max-height: calc(40vh - 60px);
  overflow-y: auto;
}

.problem-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;

  // Markdown 内容样式
  :deep(p) {
    margin: 0 0 8px 0;
    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(ul),
  :deep(ol) {
    margin: 8px 0;
    padding-left: 24px;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(strong) {
    font-weight: 600;
  }

  :deep(em) {
    font-style: italic;
  }

  :deep(code) {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }

  :deep(pre) {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;

    code {
      background: transparent;
      padding: 0;
    }
  }

  // MathJax 公式样式处理
  :deep(.mjx-math) {
    display: inline-block;
    margin: 0 2px;
  }

  :deep(.mjx-display) {
    margin: 12px 0;
    text-align: center;
  }
}

.problem-image {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 8px;
  max-height: 200px;
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
    border-radius: 4px;
  }
}

// 关键词搜题容器
.keyword-search-container {
  padding: 16px;
  background: white;
}

.keyword-search-result {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.keyword-input-wrapper {
  position: relative;
  width: 100%;
}

.keyword-input {
  width: 100%;

  :deep(.q-field__control) {
    border: 1px solid rgba(156, 39, 176, 0.3);
    border-radius: 8px;
    background: white;
    min-height: 120px;

    &:hover {
      border-color: rgba(156, 39, 176, 0.5);
    }
  }

  :deep(.q-field__native) {
    padding: 12px 60px 12px 12px;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
    resize: none;
  }

  :deep(.q-field__placeholder) {
    color: #999;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-line;
  }

  :deep(.q-field--focused .q-field__control) {
    border-color: rgba(156, 39, 176, 0.6);
  }
}

.keyword-search-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  background: #9c27b0;
  box-shadow: 0 2px 8px rgba(156, 39, 176, 0.3);
  z-index: 10;

  &:hover {
    background: rgba(156, 39, 176, 0.9);
  }

  :deep(.q-icon) {
    color: white;
    font-size: 20px;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// ChatView 区域
.drawer-chat-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
