<template>
  <div class="photo-search-fullscreen">
    <!-- 左上角返回按钮 -->
    <q-btn flat round dense icon="arrow_back" class="back-btn" @click="handleClose" />

    <!-- 调试面板切换按钮（仅开发环境显示） -->
    <q-btn
      v-if="isDev"
      flat
      round
      dense
      icon="bug_report"
      class="debug-toggle-btn"
      :color="showDebugPanel ? 'primary' : 'grey'"
      @click="showDebugPanel = !showDebugPanel"
    />

    <!-- 调试面板（仅开发环境显示） -->
    <PhotoSearchDebugPanel
      v-if="isDev && showDebugPanel"
      :is-android="isAndroid"
      :has-android-bridge="hasAndroidBridge"
      :show-camera-preview="showCameraPreview"
      :show-crop-view="showCropView"
      :show-result-view="showResultView"
      :show-drawer="showDrawer"
      :active-tab="activeTab"
      :camera-stream="cameraStream"
      :video-element="videoElement"
      :current-image="currentImage"
      :image-preview="imagePreview"
      :cropped-image-base64="croppedImageBase64"
      :is-from-gallery="isFromGallery"
      :crop-rect="cropRect"
      :is-cropping="isCropping"
      :is-dragging="isDragging"
      :is-resizing="isResizing"
      :resize-handle="resizeHandle"
      :current-cursor="currentCursor"
      :image-scale="imageScale"
      :image-offset-x="imageOffsetX"
      :image-offset-y="imageOffsetY"
      :is-panning="isPanning"
      :is-pinching="isPinching"
      :image-draw-info="imageDrawInfo"
      :is-searching="isSearching"
      :is-keyword-searching="isKeywordSearching"
      :keyword-text="keywordText"
      :photo-question-data="photoQuestionData"
      :keyword-question-data="keywordQuestionData"
      :selected-subject="selectedSubject"
      :splitter-model="splitterModel"
      :chat-view-ref="chatViewRef"
      :is-chat-loading="isChatLoading"
      @close="showDebugPanel = false"
    />

    <!-- 相机预览/图片显示区域 -->
    <div class="camera-preview-area">
      <!-- 实时相机预览（Web环境使用video元素，Android环境使用原生PreviewView） -->
      <video
        v-if="showCameraPreview && !isAndroid"
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

    <!-- 框选内容临时面板（仅开发环境显示） -->
    <Transition name="crop-preview-panel">
      <div
        v-if="isDev && showCropView && cropRect && cropPreviewImage && showCropPreviewPanel"
        class="crop-preview-panel"
      >
        <div class="crop-preview-header">
          <span class="crop-preview-title">框选预览</span>
          <q-btn
            flat
            round
            dense
            icon="close"
            size="sm"
            class="crop-preview-close-btn"
            @click="closeCropPreviewPanel"
          />
        </div>
        <div class="crop-preview-content">
          <div class="crop-preview-image-wrapper">
            <img :src="cropPreviewImage" alt="框选预览" class="crop-preview-image" />
          </div>
          <!-- 框选预览信息 -->
          <div class="crop-preview-info">
            <div class="info-item">
              <span class="info-label">位置:</span>
              <span class="info-value"
                >({{ Math.round(cropRect.x) }}, {{ Math.round(cropRect.y) }})</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">尺寸:</span>
              <span class="info-value"
                >{{ Math.round(cropRect.width) }} × {{ Math.round(cropRect.height) }}</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">面积:</span>
              <span class="info-value">{{ Math.round(cropRect.width * cropRect.height) }} px²</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

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
          <!-- 图片标签页 -->
          <div class="image-tabs">
            <div
              class="tab-item"
              :class="{ active: activeTab === 'photo' }"
              @click="handleTabSwitch('photo')"
            >
              拍照搜题
            </div>
            <div
              class="tab-item"
              :class="{ active: activeTab === 'keyword' }"
              @click="handleTabSwitch('keyword')"
            >
              关键词搜题
            </div>
          </div>

          <!-- 拍照搜题内容 -->
          <div
            v-if="activeTab === 'photo'"
            class="photo-result-wrapper"
            :style="{ height: photoResultHeight + 'px' }"
          >
            <!-- 右上角操作按钮 -->
            <div v-if="photoQuestionData" class="result-actions">
              <!-- 收藏 -->
              <div class="action-item" @click="handleFavoriteInChat">
                <q-icon
                  :name="isFavoriteInChat ? 'star' : 'star_border'"
                  :class="{ favorited: isFavoriteInChat }"
                  size="20px"
                />
                <span class="action-text">收藏</span>
              </div>

              <!-- 加入练习 -->
              <div class="action-item" @click="handleAddToPracticeInChat">
                <q-icon name="description" size="20px" />
                <span class="action-text">加入练习</span>
              </div>
            </div>
            <div
              ref="photoResultRef"
              class="recognized-problem"
            >
              <div
                class="problem-text"
                v-if="photoQuestionData"
                v-html="renderQuestionContent(photoQuestionData)"
              ></div>
            </div>
            <div
              class="resize-handle resize-handle-photo"
              @mousedown="startResizePhoto"
              @touchstart="startResizePhoto"
            ></div>
          </div>

          <!-- 关键词搜题内容 -->
          <div v-if="activeTab === 'keyword'" class="keyword-search-container" :style="{ height: keywordInputHeight + 'px' }">
            <textarea
              ref="keywordInputRef"
              v-model="keywordText"
              class="keyword-input"
              placeholder="可输入关键字进行精确搜题:&#10;输入题目的关键词,空格或逗号分隔多个关键词"
              rows="4"
              @keydown.ctrl.enter="handleKeywordSearch"
              @keydown.meta.enter="handleKeywordSearch"
            ></textarea>
            <div
              class="resize-handle resize-handle-input"
              @mousedown="startResizeInput"
              @touchstart="startResizeInput"
            ></div>
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
            ref="keywordResultRef"
            class="keyword-result-wrapper"
            :style="{ height: keywordResultHeight + 'px' }"
          >
            <!-- 右上角操作按钮 -->
            <div class="result-actions">
              <!-- 收藏 -->
              <div class="action-item" @click="handleFavoriteInChat">
                <q-icon
                  :name="isFavoriteInChat ? 'star' : 'star_border'"
                  :class="{ favorited: isFavoriteInChat }"
                  size="20px"
                />
                <span class="action-text">收藏</span>
              </div>

              <!-- 加入练习 -->
              <div class="action-item" @click="handleAddToPracticeInChat">
                <q-icon name="description" size="20px" />
                <span class="action-text">加入练习</span>
              </div>
            </div>
            <div class="keyword-search-result">
              <div class="problem-text" v-html="renderQuestionContent(keywordQuestionData)"></div>
            </div>
            <div
              class="resize-handle resize-handle-result"
              @mousedown="startResizeResult"
              @touchstart="startResizeResult"
            ></div>
          </div>
          <!-- ChatView 区域（与拍照/关键词内容处于同一层级） -->
          <div class="drawer-chat-section">
            <ChatView
              v-if="currentQuestionData"
              ref="chatViewRef"
              type="ai-exercise"
              :compressed-height="160"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuestionList from '@/components/QuestionList.vue'
import ImagePicker from '@/components/chat/ImagePicker.vue'
import ChatView from '@/components/ChatView.vue'
import PhotoSearchDebugPanel from '@/components/debug/PhotoSearchDebugPanel.vue'
import { apiService } from '@/services/api-service'
import { ImagePickerAdapterFactory } from '@/adapters/ImagePickerAdapterFactory'
import type { IImagePickerAdapter } from '@/adapters/IImagePickerAdapter'
import { showMessage } from '@/utils'
import type { ExerciseItem } from '@/types'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { toggleExerciseFavorite, getFavoriteExercises } from '@/utils/storage/favorites'
import { useQuestionStore } from '@/stores/questionStore'

const route = useRoute()
const router = useRouter()

// 从路由 query 参数获取 subject
const getSubjectFromRoute = (): string => {
  const subject = route.query.subject
  if (typeof subject === 'string' && (subject === 'math' || subject === 'biology')) {
    return subject
  }
  return 'math'
}

const adapter: IImagePickerAdapter = ImagePickerAdapterFactory.getAdapter()
const { renderMessageContent } = useMessageRenderer()

// 开发环境检查（仅开发环境显示调试面板）
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// 日志工具函数
const logFlow = (action: string, data?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    action,
    ...data,
  }
  console.log(`[PhotoSearchView] ${action}`, logData)
}

// 检测当前环境（使用适配器工厂统一判断）
const isAndroid = computed(() => ImagePickerAdapterFactory.getEnvironment() === 'android')

// Android Bridge 可用性
const hasAndroidBridge = computed(() => {
  return typeof window !== 'undefined' && typeof window.AndroidBridge !== 'undefined'
})

// 状态管理
const selectedSubject = ref<string>(getSubjectFromRoute())
const showCameraPreview = ref(true)
const showCropView = ref(false)
const showResultView = ref(false)
const showDrawer = ref(false) // 抽屉显示状态
const showDebugPanel = ref(false) // 调试面板显示状态
const imagePreview = ref<string>('')
const photoQuestionData = ref<ExerciseItem | null>(null) // 拍照搜题的数据
const keywordQuestionData = ref<ExerciseItem | null>(null) // 关键词搜题的数据
const isSearching = ref(false)
// 注意：不再使用 originalQuestions，因为不再修改全局 questionStore
const croppedImageBase64 = ref<string>('') // 裁剪后的图片 base64，用于抽屉显示
const activeTab = ref<'photo' | 'keyword'>('photo') // 标签页状态
const keywordText = ref<string>('') // 关键词输入
const isKeywordSearching = ref(false) // 关键词搜索状态

// 关键词输入框和结果区域的高度调整
const keywordInputRef = ref<HTMLTextAreaElement | null>(null)
const keywordResultRef = ref<HTMLDivElement | null>(null)
const keywordInputHeight = ref(100) // 初始高度
const keywordResultHeight = ref(100) // 初始高度
const isResizingInput = ref(false)
const isResizingResult = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)

// 拍照搜题内容的高度调整
const photoResultRef = ref<HTMLDivElement | null>(null)
const photoResultHeight = ref(100) // 初始高度（与样式中的固定高度一致）
const isResizingPhoto = ref(false)

// ChatView 相关状态
const chatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
// ChatView 的加载状态（从 ChatView 内部获取）
const isChatLoading = computed(() => chatViewRef.value?.isLoading ?? false)

// 收藏状态管理（响应式）
const favoriteStatusMap = ref<Map<string, boolean>>(new Map())

// 初始化收藏状态
const initFavoriteStatus = () => {
  const favorites = getFavoriteExercises()
  favoriteStatusMap.value.clear()
  favorites.forEach((f) => {
    favoriteStatusMap.value.set(f.item.id, true)
  })
}

// 收藏状态计算属性
const isFavoriteInChat = computed(() => {
  if (currentQuestionData.value) {
    return favoriteStatusMap.value.get(currentQuestionData.value.id) ?? false
  }
  return false
})

// QuestionStore
const questionStore = useQuestionStore()

// 根据当前tab返回对应的题目数据
const currentQuestionData = computed(() => {
  const data = activeTab.value === 'photo' ? photoQuestionData.value : keywordQuestionData.value
  return data
})

// 同步题目数据到 questionStore
const syncQuestionToStore = async (question: ExerciseItem) => {
  if (!question) {
    return
  }

  try {
    const questions = questionStore.questions
    // 检查题目是否已经在 questions 数组中
    const questionIndex = questions.findIndex(
      (q) => q.bmNo === question.bmNo
    )

    if (questionIndex >= 0) {
      // 如果题目已存在，直接选择它
      await questionStore.selectQuestion(questionIndex)
  } else {
      // 如果题目不存在，添加到数组开头，然后选择它
      questionStore.questions.unshift(question)
      await questionStore.selectQuestion(0)
  }
  } catch (error) {
    console.error('同步题目到 questionStore 失败:', error)
  }
}

// 处理 tab 切换，同步当前 tab 的题目到 questionStore
const handleTabSwitch = async (tab: 'photo' | 'keyword') => {
  // 切换 tab
  activeTab.value = tab
  
  // 同步当前 tab 的题目到 questionStore
  const currentQuestion = tab === 'photo' ? photoQuestionData.value : keywordQuestionData.value
  if (currentQuestion) {
    logFlow('Tab 切换，同步题目到 questionStore', {
      tab,
      questionId: currentQuestion.id,
    })
    await syncQuestionToStore(currentQuestion)
  }
}

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

// 缩放和平移相关（已禁用缩放功能，保留变量用于兼容性）
const imageScale = ref(1) // 图片缩放比例（固定为1，不支持缩放）
const imageOffsetX = ref(0) // 图片X偏移（固定为0，不支持平移）
const imageOffsetY = ref(0) // 图片Y偏移（固定为0，不支持平移）
const isPanning = ref(false) // 是否正在平移图片（已禁用，始终为false）
const isPinching = ref(false) // 是否正在捏合（已禁用，始终为false）
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

// 框选预览相关
const cropPreviewImage = ref<string>('') // 框选区域的预览图
const showCropPreviewPanel = ref(true) // 是否显示预览面板

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
// Android环境：使用原生相机预览层（PreviewView）
// Web环境：使用Web相机预览（video元素）
const startCamera = async () => {
  logFlow('启动相机预览', {
    isAndroid: isAndroid.value,
    hasAndroidBridge: hasAndroidBridge.value,
  })
  if (isAndroid.value) {
    // Android环境：使用原生相机预览层
    try {
      if (!window.AndroidBridge) {
        throw new Error('Android Bridge not available')
      }
      window.AndroidBridge.startNativeCameraPreview()
      showCameraPreview.value = true
      logFlow('Android原生相机预览启动成功')
    } catch (error) {
      console.error('启动Android原生相机预览失败:', error)
      logFlow('Android原生相机预览启动失败', { error })
      showMessage('无法启动相机预览，请检查权限设置', 'warning')
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
      logFlow('Web相机预览启动成功', {
        hasStream: !!stream,
        hasVideoElement: !!videoElement.value,
      })
    } catch (error) {
      console.error('启动相机失败:', error)
      logFlow('Web相机预览启动失败', { error })
      showMessage('无法访问相机，请检查权限设置', 'warning')
      showCameraPreview.value = false
    }
  }
}

// 停止相机预览
const stopCamera = async () => {
  logFlow('停止相机预览', {
    isAndroid: isAndroid.value,
    hasStream: !!cameraStream.value,
    hasVideoElement: !!videoElement.value,
  })
  if (isAndroid.value) {
    // Android环境：停止原生相机预览
    try {
      if (window.AndroidBridge) {
        window.AndroidBridge.stopNativeCameraPreview()
        logFlow('Android原生相机预览停止成功')
      }
    } catch (error) {
      console.error('停止Android原生相机预览失败:', error)
      logFlow('Android原生相机预览停止失败', { error })
    }
  } else {
    // Web环境：停止Web相机预览
    if (cameraStream.value) {
      const trackCount = cameraStream.value.getTracks().length
      cameraStream.value.getTracks().forEach((track) => track.stop())
      cameraStream.value = null
      logFlow('Web相机流停止成功', { trackCount })
    }
    if (videoElement.value) {
      videoElement.value.srcObject = null
      logFlow('Video元素已清空')
    }
  }
}

// 从相机拍照
const captureFromCamera = async (): Promise<string | null> => {
  if (isAndroid.value) {
    // Android环境：使用原生拍照接口
    return new Promise((resolve, reject) => {
      if (!window.AndroidBridge) {
        reject(new Error('Android Bridge not available'))
        return
      }

      const callbackId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      // 注册成功回调
      const successHandler = (id: string, base64Data: string) => {
        if (id === callbackId) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          // 清理回调
          if (window.onNativeCameraCaptureSuccess === successHandler) {
            delete window.onNativeCameraCaptureSuccess
          }
          if (window.onNativeCameraCaptureFailed === errorHandler) {
            delete window.onNativeCameraCaptureFailed
          }
          resolve(base64Data)
        }
      }

      // 注册失败回调
      const errorHandler = (id: string, error: string) => {
        if (id === callbackId) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          // 清理回调
          if (window.onNativeCameraCaptureSuccess === successHandler) {
            delete window.onNativeCameraCaptureSuccess
          }
          if (window.onNativeCameraCaptureFailed === errorHandler) {
            delete window.onNativeCameraCaptureFailed
          }
          reject(new Error(error))
        }
      }

      // 设置回调
      window.onNativeCameraCaptureSuccess = successHandler
      window.onNativeCameraCaptureFailed = errorHandler

      // 设置超时
      timeoutId = setTimeout(() => {
        // 清理回调
        if (window.onNativeCameraCaptureSuccess === successHandler) {
          delete window.onNativeCameraCaptureSuccess
        }
        if (window.onNativeCameraCaptureFailed === errorHandler) {
          delete window.onNativeCameraCaptureFailed
        }
        reject(new Error('拍照超时'))
      }, 10000)

      // 调用原生拍照接口
      try {
        window.AndroidBridge.capturePhotoFromNative(callbackId)
      } catch (error) {
        // 清理回调
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        if (window.onNativeCameraCaptureSuccess === successHandler) {
          delete window.onNativeCameraCaptureSuccess
        }
        if (window.onNativeCameraCaptureFailed === errorHandler) {
          delete window.onNativeCameraCaptureFailed
        }
        reject(error)
      }
    })
  } else {
    // Web环境：从video元素截图
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
}

// 处理拍照
// Android环境：使用原生拍照接口
// Web环境：从video元素截图（相机已在对话框打开时启动）
const handleCapturePhoto = async () => {
  logFlow('拍照开始', {
    selectedSubject: selectedSubject.value,
    isAndroid: isAndroid.value,
    hasStream: !!cameraStream.value,
  })
  if (!selectedSubject.value) {
    logFlow('拍照失败：未选择学科')
    showMessage('请先选择学科', 'warning')
    return
  }

  try {
    // 直接从实时相机流中截图（相机已在对话框打开时启动）
    const base64DataUrl = await captureFromCamera()
    if (!base64DataUrl) {
      logFlow('拍照失败：未获取到图片数据')
      showMessage('拍照失败', 'error')
      return
    }

    logFlow('拍照成功，开始处理图片', {
      base64Length: base64DataUrl.length,
      isFromGallery: false,
    })

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

    logFlow('拍照处理完成，进入框选模式', {
      hasImage: !!currentImage.value,
      imageSize: file.size,
      showCameraPreview: showCameraPreview.value,
      showCropView: showCropView.value,
    })
  } catch (error) {
    console.error('拍照处理失败:', error)
    logFlow('拍照处理失败', { error })
    const errorMessage = error instanceof Error ? error.message : '拍照处理失败'
    showMessage(errorMessage, 'error')
  }
}

// 处理从相册选择
const handleSelectFromGallery = async () => {
  logFlow('从相册选择开始', {
    selectedSubject: selectedSubject.value,
    adapterType: adapter.constructor.name,
  })
  if (!selectedSubject.value) {
    logFlow('从相册选择失败：未选择学科')
    showMessage('请先选择学科', 'warning')
    return
  }
  try {
    // 直接调用适配器打开相册，不显示选择对话框
    const imageInfo = await adapter.selectFromGallery()

    if (imageInfo && imageInfo.base64DataUrl) {
      logFlow('从相册选择成功，开始处理图片', {
        base64Length: imageInfo.base64DataUrl.length,
        isFromGallery: true,
      })

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

      logFlow('从相册选择处理完成，进入框选模式', {
        hasImage: !!currentImage.value,
        imageSize: file.size,
        showCameraPreview: showCameraPreview.value,
        showCropView: showCropView.value,
      })
    } else {
      logFlow('从相册选择失败：未获取到图片数据')
    }
  } catch (error) {
    console.error('选择图片失败:', error)
    logFlow('从相册选择失败', { error })
    const errorMessage = error instanceof Error ? error.message : '选择图片失败'
    showMessage(errorMessage, 'error')
  }
}

// 确保 base64 字符串是完整的 data URL 格式
// 第1步：检查输入是否已经是 data URL 格式
// 第2步：如果不是，添加 data:image/jpeg;base64, 前缀
const ensureDataUrl = (base64: string): string => {
  if (!base64 || typeof base64 !== 'string') {
    return base64
  }

  // 如果已经是 data URL 格式，直接返回
  if (base64.startsWith('data:image/')) {
    return base64
  }

  // 否则添加前缀
  return `data:image/jpeg;base64,${base64}`
}

// Base64 转 File
const base64ToFile = (base64: string, filename: string): Promise<File> => {
  return new Promise((resolve, reject) => {
    try {
      // 验证输入
      if (!base64 || typeof base64 !== 'string') {
        reject(new Error('Base64 字符串无效：输入为空或不是字符串'))
        return
      }

      // 分离 data URL 前缀和 base64 数据
      const arr = base64.split(',')
      if (arr.length < 2) {
        // 如果没有逗号分隔，可能是纯 base64 字符串（没有 data:image 前缀）
        // 尝试直接使用整个字符串作为 base64 数据
        let base64Data = base64.trim()
        // 清理 base64 字符串：移除空格、换行符等无效字符
        base64Data = base64Data.replace(/\s/g, '')

        // 验证 base64 字符串格式
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
          reject(new Error('Base64 字符串格式无效：包含非法字符'))
          return
        }

        try {
          const bstr = atob(base64Data)
          let n = bstr.length
          const u8arr = new Uint8Array(n)
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
          }
          resolve(new File([u8arr], filename, { type: 'image/jpeg' }))
        } catch (decodeError) {
          reject(
            new Error(
              `Base64 解码失败: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`,
            ),
          )
        }
        return
      }

      // 有 data URL 前缀的情况
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
      let base64Data = arr[1].trim()

      // 清理 base64 字符串：移除空格、换行符等无效字符
      base64Data = base64Data.replace(/\s/g, '')

      // 验证 base64 字符串格式
      if (!base64Data || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        reject(new Error('Base64 字符串格式无效：包含非法字符或为空'))
        return
      }

      // 解码 base64
      const bstr = atob(base64Data)
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      resolve(new File([u8arr], filename, { type: mime }))
    } catch (error) {
      reject(
        new Error(`Base64 转 File 失败: ${error instanceof Error ? error.message : String(error)}`),
      )
    }
  })
}

// 绘制图片到画布（不支持缩放和平移）
const drawImage = () => {
  if (!cropCanvas.value || !currentImage.value || !originalDrawInfo.value) return

  const canvas = cropCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (!currentImage.value) {
    return
  }

  const img = new Image()
  img.onload = () => {
    if (!originalDrawInfo.value) {
      return
    }

    const { drawX, drawY, drawWidth, drawHeight } = originalDrawInfo.value

    // 清空画布
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制图片（不应用缩放和平移）
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

    // 更新绘制信息（用于坐标映射）
    if (imageDrawInfo.value) {
      imageDrawInfo.value = {
        ...imageDrawInfo.value,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      }
    }
  }
  img.onerror = (error) => {
    logFlow('绘制图片失败：图片加载失败', { error })
  }
  // 确保 preview 是完整的 data URL 格式
  img.src = ensureDataUrl(currentImage.value.preview)
}

// 初始化裁剪画布
const initCropCanvas = () => {
  if (!cropCanvas.value || !currentImage.value) {
    logFlow('初始化裁剪画布失败：缺少必要元素', {
      hasCropCanvas: !!cropCanvas.value,
      hasCurrentImage: !!currentImage.value,
    })
    return
  }

  logFlow('初始化裁剪画布开始', {
    hasImage: !!currentImage.value,
    imageSize: currentImage.value.file?.size,
  })

  const canvas = cropCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    logFlow('初始化裁剪画布失败：无法获取2D上下文')
    return
  }

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

    logFlow('初始化裁剪画布完成', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      imageWidth: img.width,
      imageHeight: img.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
      isFromGallery: isFromGallery.value,
    })
  }
  img.onerror = (error) => {
    if (currentImage.value) {
      logFlow('初始化裁剪画布失败：图片加载失败', {
        previewType: typeof currentImage.value.preview,
        previewLength: currentImage.value.preview?.length,
        previewStart: currentImage.value.preview?.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      })
    } else {
      logFlow('初始化裁剪画布失败：图片加载失败', { error })
    }
  }
  // 确保 preview 是完整的 data URL 格式
  if (currentImage.value) {
    img.src = ensureDataUrl(currentImage.value.preview)
  }
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

  // 如果是触摸事件且有两个手指，不处理（忽略双指操作）
  if ('touches' in e && e.touches.length === 2) {
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
    // 更新预览图
    if (showCropPreviewPanel.value) {
      updateCropPreview()
    }
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
    // 更新预览图
    if (showCropPreviewPanel.value) {
      updateCropPreview()
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
    // 更新预览图
    if (showCropPreviewPanel.value) {
      updateCropPreview()
    }
  }
}

// 结束裁剪（绘制、拖动或调整大小）
const endCrop = () => {
  isCropping.value = false
  isDragging.value = false
  isResizing.value = false
  resizeHandle.value = null

  // 如果绘制出的框太小，清除它（允许重新绘制）
  if (cropRect.value && cropRect.value.width < 10 && cropRect.value.height < 10) {
    cropRect.value = null
    cropPreviewImage.value = ''
  } else {
    // 更新预览图
    updateCropPreview()
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
    // 更新预览图
    updateCropPreview()
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
  if (!isDragging.value && !isCropping.value && !isResizing.value) {
    endCrop()
  }
  currentCursor.value = 'crosshair'
}

// 处理触摸开始
const handleTouchStart = (e: TouchEvent) => {
  if (!cropCanvas.value) return

  e.preventDefault()

  // 只处理单指触摸，用于框选功能
  if (e.touches.length === 1) {
    startCrop(e)
  }
  // 双指触摸被忽略（不支持缩放）
}

// 处理触摸移动
const handleTouchMove = (e: TouchEvent) => {
  if (!cropCanvas.value) return

  e.preventDefault()

  // 只处理单指触摸，用于框选功能
  if (e.touches.length === 1) {
    updateCrop(e)
  }
  // 双指触摸被忽略（不支持缩放）
}

// 处理触摸结束
const handleTouchEnd = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    // 所有手指都离开
    endCrop()
  }
}

// 处理重拍
const handleRetake = async () => {
  logFlow('重拍开始', {
    hasImage: !!currentImage.value,
    hasCropRect: !!cropRect.value,
    showCropView: showCropView.value,
    showDrawer: showDrawer.value,
  })
  currentImage.value = null
  imagePreview.value = ''
  showCropView.value = false
  showResultView.value = false
  showDrawer.value = false // 关闭抽屉
  cropRect.value = null
  cropPreviewImage.value = ''
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
  showCropPreviewPanel.value = true // 重置预览面板显示状态

  // 重新初始化并显示相机预览
  showCameraPreview.value = true
  await startCamera()

  logFlow('重拍完成，恢复相机预览', {
    showCameraPreview: showCameraPreview.value,
    showCropView: showCropView.value,
  })
}

// 处理搜索
const handleSearch = async () => {
  logFlow('搜索开始', {
    hasImage: !!currentImage.value,
    hasCropRect: !!cropRect.value,
    hasCropCanvas: !!cropCanvas.value,
    selectedSubject: selectedSubject.value,
  })
  if (!currentImage.value || !cropRect.value || !cropCanvas.value) {
    logFlow('搜索失败：未选择图片区域')
    showMessage('请先选择图片区域', 'warning')
    return
  }

  try {
    isSearching.value = true

    // 获取裁剪后的图片
    logFlow('开始裁剪图片')
    const croppedFile = await getCroppedImage()
    if (!croppedFile) {
      logFlow('搜索失败：图片裁剪失败')
      showMessage('图片裁剪失败', 'error')
      return
    }

    logFlow('图片裁剪成功', {
      croppedFileSize: croppedFile.size,
      croppedFileName: croppedFile.name,
    })

    // 获取裁剪后图片的 base64，用于抽屉显示
    const reader = new FileReader()
    croppedImageBase64.value = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(croppedFile)
    })

    logFlow('开始调用图片识别API', {
      subject: selectedSubject.value,
      imageSize: croppedFile.size,
    })

    // 调用图片识别API
    const question = await apiService.recognizeImage(croppedFile, selectedSubject.value)

    if (question) {
      logFlow('图片识别成功', {
        questionId: question.id,
        hasQuestion: !!question.question,
        hasTitle: !!question.title,
      })
      photoQuestionData.value = question

      // 同步题目到 questionStore
      await syncQuestionToStore(question)

      // 隐藏框选视图，显示抽屉
      showCropView.value = false
      showDrawer.value = true
      activeTab.value = 'photo' // 默认显示拍照搜题标签

      logFlow('搜索完成，显示结果', {
        showCropView: showCropView.value,
        showDrawer: showDrawer.value,
        activeTab: activeTab.value,
      })
    } else {
      logFlow('搜索失败：未识别到题目')
      showMessage('未识别到题目', 'warning')
    }
  } catch (error) {
    console.error('图片识别失败:', error)
    logFlow('搜索失败：图片识别异常', { error })
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
    // 确保 preview 是完整的 data URL 格式
    img.src = ensureDataUrl(currentImage.value.preview)
  })
}

// 处理题目选中
const handleQuestionSelected = (question: ExerciseItem) => {
  // 题目选中后可以在这里处理，比如跳转到题目详情页
  logFlow('题目已选中', { questionId: question.id })
}

// 更新框选预览图
const updateCropPreview = () => {
  if (!cropCanvas.value || !cropRect.value || !currentImage.value || !imageDrawInfo.value) {
    cropPreviewImage.value = ''
    return
  }

  // 使用 requestAnimationFrame 优化性能，避免频繁更新
  requestAnimationFrame(() => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        cropPreviewImage.value = ''
        return
      }

      // 设置预览图尺寸（最大 200px）
      if (!cropRect.value) {
        cropPreviewImage.value = ''
        return
      }

      const cropRectValue = cropRect.value
      const maxSize = 200
      const aspectRatio = cropRectValue.width / cropRectValue.height
      let previewWidth = cropRectValue.width
      let previewHeight = cropRectValue.height

      if (previewWidth > maxSize || previewHeight > maxSize) {
        if (aspectRatio > 1) {
          previewWidth = maxSize
          previewHeight = maxSize / aspectRatio
        } else {
          previewHeight = maxSize
          previewWidth = maxSize * aspectRatio
        }
      }

      canvas.width = previewWidth
      canvas.height = previewHeight

      // 从主 canvas 中提取框选区域
      const mainCanvas = cropCanvas.value
      if (!mainCanvas) {
        cropPreviewImage.value = ''
        return
      }

      const mainCtx = mainCanvas.getContext('2d')
      if (!mainCtx) {
        cropPreviewImage.value = ''
        return
      }

      // 获取框选区域的图像数据
      const imageData = mainCtx.getImageData(
        Math.max(0, Math.floor(cropRectValue.x)),
        Math.max(0, Math.floor(cropRectValue.y)),
        Math.min(mainCanvas.width - Math.floor(cropRectValue.x), Math.floor(cropRectValue.width)),
        Math.min(mainCanvas.height - Math.floor(cropRectValue.y), Math.floor(cropRectValue.height)),
      )

      // 创建临时 canvas 用于缩放
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = imageData.width
      tempCanvas.height = imageData.height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        cropPreviewImage.value = ''
        return
      }
      tempCtx.putImageData(imageData, 0, 0)

      // 使用 drawImage 进行缩放绘制
      ctx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight)

      // 转换为 base64
      cropPreviewImage.value = canvas.toDataURL('image/jpeg', 0.9)
    } catch (error) {
      console.error('更新框选预览失败:', error)
      cropPreviewImage.value = ''
    }
  })
}

// 关闭预览面板
const closeCropPreviewPanel = () => {
  showCropPreviewPanel.value = false
}

// 监听框选区域变化，更新预览
watch(
  () => cropRect.value,
  (newRect) => {
    if (newRect && showCropView.value) {
      // 延迟更新，避免频繁计算
      setTimeout(() => {
        if (showCropPreviewPanel.value) {
          updateCropPreview()
        }
      }, 100)
    } else {
      cropPreviewImage.value = ''
    }
  },
  { deep: true },
)


// 处理关键词搜索
const handleKeywordSearch = async () => {
  logFlow('关键词搜索开始', {
    keyword: keywordText.value.trim(),
    selectedSubject: selectedSubject.value,
  })
  if (!keywordText.value.trim()) {
    logFlow('关键词搜索失败：关键词为空')
    showMessage('请输入题目关键字再搜索', 'warning')
    return
  }

  try {
    isKeywordSearching.value = true

    logFlow('开始调用关键词搜索API', {
      keyword: keywordText.value.trim(),
      subject: selectedSubject.value,
    })

    // 调用关键词搜索API
    const question = await apiService.searchQuestionByText(
      keywordText.value.trim(),
      selectedSubject.value,
    )

    if (question) {
      logFlow('关键词搜索成功', question)
      keywordQuestionData.value = question

      // 同步题目到 questionStore
      await syncQuestionToStore(question)

      // 如果抽屉未打开，则打开抽屉
      if (!showDrawer.value) {
        showDrawer.value = true
      }

      // 保持在关键词标签页显示结果
      // activeTab 保持在 'keyword'，不切换

      logFlow('关键词搜索完成，显示结果', {
        showDrawer: showDrawer.value,
        activeTab: activeTab.value,
      })
    } else {
      logFlow('关键词搜索失败：未搜索到相关题目')
      showMessage('未搜索到相关题目', 'warning')
    }
  } catch (error) {
    console.error('关键词搜索失败:', error)
    logFlow('关键词搜索失败：搜索异常', { error })
    showMessage('关键词搜索失败', 'error')
  } finally {
    isKeywordSearching.value = false
  }
}

// 全局拖动事件处理函数
const handleResizeMove = (e: MouseEvent | TouchEvent) => {
  if (isResizingInput.value) {
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = currentY - resizeStartY.value
    const newHeight = Math.max(80, Math.min(400, resizeStartHeight.value + deltaY))
    keywordInputHeight.value = newHeight
  } else if (isResizingResult.value) {
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = currentY - resizeStartY.value
    const newHeight = Math.max(80, Math.min(500, resizeStartHeight.value + deltaY))
    keywordResultHeight.value = newHeight
  } else if (isResizingPhoto.value) {
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = currentY - resizeStartY.value
    const newHeight = Math.max(80, Math.min(500, resizeStartHeight.value + deltaY))
    photoResultHeight.value = newHeight
  }
}

// 全局拖动结束事件处理函数
const handleResizeEnd = () => {
  isResizingInput.value = false
  isResizingResult.value = false
  isResizingPhoto.value = false
}

// 开始调整关键词输入框高度
const startResizeInput = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isResizingInput.value = true
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  resizeStartY.value = clientY
  resizeStartHeight.value = keywordInputHeight.value
}

// 开始调整关键词搜索结果高度
const startResizeResult = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isResizingResult.value = true
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  resizeStartY.value = clientY
  resizeStartHeight.value = keywordResultHeight.value
}

// 开始调整拍照搜题内容高度
const startResizePhoto = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isResizingPhoto.value = true
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  resizeStartY.value = clientY
  resizeStartHeight.value = photoResultHeight.value
}

// 渲染题目内容（支持Markdown和公式）
const renderQuestionContent = (question: ExerciseItem): string => {
  const content = question.question || question.title || ''
  return renderMessageContent(content)
}

// 处理关闭抽屉
const handleCloseDrawer = async () => {
  const wasFromGallery = isFromGallery.value
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

  // 重新显示相机预览
  showCameraPreview.value = true

  // 如果是从相册打开的，需要重新启动相机
  if (wasFromGallery) {
    logFlow('从相册打开，关闭抽屉时重新启动相机')
    await startCamera()
    isFromGallery.value = false // 重置标记
  }

  logFlow('关闭抽屉完成，恢复相机预览', {
    showDrawer: showDrawer.value,
    showCameraPreview: showCameraPreview.value,
    wasFromGallery,
    isFromGallery: isFromGallery.value,
  })
}

// 处理关闭
const handleClose = () => {
  logFlow('关闭页面')
  cleanup()
  router.back()
  logFlow('页面已关闭')
}

const handleFavoriteInChat = () => {
  if (!currentQuestionData.value) {
    showMessage('没有可收藏的题目', 'warning')
    return
  }

  const wasFavorite = isFavoriteInChat.value
  const success = toggleExerciseFavorite(currentQuestionData.value)
  if (success) {
    // 更新响应式收藏状态
    favoriteStatusMap.value.set(currentQuestionData.value.id, !wasFavorite)
    showMessage(!wasFavorite ? '已收藏' : '已取消收藏', 'success')
  } else {
    showMessage('操作失败，请重试', 'error')
  }
}

const handleAddToPracticeInChat = async () => {
  if (!currentQuestionData.value) {
    showMessage('没有可添加的题目', 'warning')
    return
  }

  try {
    // 获取当前题目列表ID
    const questions = questionStore.questions
    const exercisesId = questions.map((q) => q.bmNo || q.id).join(',')

    // 构建添加请求
    const questionData = {
      ...currentQuestionData.value,
      exercisesId,
    }

    const { getSubject } = await import('../services/auth-storage-service')
    const subject = (getSubject()?.toLowerCase() || 'math') as 'math' | 'biology'
    const success = await apiService.addQuestionToList(questionData, subject)

    if (success) {
      showMessage('题目已添加到列表', 'success')
      // 刷新题目列表
      await questionStore.fetchQuestions(subject, false)
    } else {
      showMessage('添加题目失败', 'error')
    }
  } catch (error) {
    console.error('添加题目失败:', error)
    showMessage('添加题目失败', 'error')
  }
}

// 组件挂载时初始化
const initialize = () => {
  const subject = getSubjectFromRoute()
  logFlow('页面初始化开始', {
    subject,
    isAndroid: isAndroid.value,
    hasAndroidBridge: hasAndroidBridge.value,
  })
  selectedSubject.value = subject
  // 初始化收藏状态
  initFavoriteStatus()
  // 所有环境都启动相机预览
  startCamera()
  logFlow('页面初始化完成', {
    selectedSubject: selectedSubject.value,
    showCameraPreview: showCameraPreview.value,
  })
}

// 组件卸载前清理
const cleanup = () => {
  logFlow('组件清理开始', {
    hasImage: !!currentImage.value,
    hasCropRect: !!cropRect.value,
    showCameraPreview: showCameraPreview.value,
    showCropView: showCropView.value,
    showResultView: showResultView.value,
    showDrawer: showDrawer.value,
  })
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
  photoQuestionData.value = null
  keywordQuestionData.value = null
  logFlow('组件清理完成')
}

// 监听路由 query 中的 subject 变化
watch(
  () => route.query.subject,
  (newSubject) => {
    if (typeof newSubject === 'string' && (newSubject === 'math' || newSubject === 'biology')) {
      selectedSubject.value = newSubject
    }
  },
  { immediate: true },
)

// 组件挂载时初始化
onMounted(() => {
  logFlow('页面挂载')
  initialize()
  
  // 添加全局拖动事件监听器
  window.addEventListener('mousemove', handleResizeMove)
  window.addEventListener('mouseup', handleResizeEnd)
  window.addEventListener('touchmove', handleResizeMove)
  window.addEventListener('touchend', handleResizeEnd)
})

// 组件卸载时清理
onUnmounted(() => {
  logFlow('页面卸载')
  cleanup()
  
  // 清理 questionStore 中的当前题目
  questionStore.clearCurrentQuestion()
  
  // 移除全局拖动事件监听器
  window.removeEventListener('mousemove', handleResizeMove)
  window.removeEventListener('mouseup', handleResizeEnd)
  window.removeEventListener('touchmove', handleResizeMove)
  window.removeEventListener('touchend', handleResizeEnd)
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
  background: transparent;
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
}

.debug-toggle-btn {
  position: absolute;
  top: 16px;
  left: 64px;
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
  background: transparent;

  // 保持黑色背景，不再设置透明背景
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
  padding: 12px;
  margin: 12px;
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
  padding: 8px;
  background: #e0e0e0;
  border-radius: 24px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin: 0;
}

.tab-item {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  color: #666;
  background: transparent;
  cursor: pointer;
  position: relative;
  text-align: center;
  z-index: 1;

  &.active {
    color: #7a55ff;
    background: white;
    font-weight: 500;
    border-radius: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  &:not(.active) {
    color: #666;
  }
}

.photo-result-wrapper {
  position: relative;
  box-sizing: border-box;
  margin-top: 10px;
}

.result-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 12px;
  z-index: 10;
  padding: 4px 8px;
  border-radius: 8px;
  }

.recognized-problem {
  position: relative;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 8px;
  margin-top: 0;
  padding-top: 0;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding-bottom: 8px; // 为 resize-handle 留出空间
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
  position: relative;
  padding: 0;
  background: white;
  margin: 10px 0;
}

.keyword-result-wrapper {
  position: relative;
  box-sizing: border-box;
}

.keyword-search-result {
  position: relative;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 8px 110px 8px 8px;
  margin-top: 0;
  padding-top: 0;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding-bottom: 8px; // 为 resize-handle 留出空间
}

.keyword-input {
  width: 100%;
  border: 1px solid #7A7CFF;
  border-radius: 16px;
  background: white;
  height: 100%;
  padding: 12px 60px 12px 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  resize: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
  outline: none;

  &::placeholder {
    color: #999;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-line;
  }

  &:hover {
    border-color: #6A6CE8;
    box-shadow: 
      0 4px 16px rgba(122, 124, 255, 0.2),
      0 2px 4px rgba(122, 124, 255, 0.15);
  }

  &:focus {
    border-color: #5A5CD8;
    box-shadow: 
      0 4px 16px rgba(122, 124, 255, 0.25),
      0 2px 4px rgba(122, 124, 255, 0.15);
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

// 拖动调整手柄
.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  z-index: 20;
  background: transparent;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 4px;
    background: #ccc;
    border-radius: 2px;
    transition: background 0.2s ease;
  }

  &:hover::after,
  &:active::after {
    background: #7A7CFF;
  }
}

.resize-handle-input {
  border-radius: 0 0 16px 16px;
}

.resize-handle-result {
  border-radius: 0 0 8px 8px;
}

.resize-handle-photo {
  border-radius: 0 0 8px 8px;
}

// ChatView 区域
.drawer-chat-section {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 0; // 配合 flex: 1 使用，确保占据剩余空间
}

// PhotoSearch ChatInput 布局
.photo-search-chat-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  width: 100%;
  box-sizing: border-box;
}

.result-actions .action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
  user-select: none;

  &:hover {
    opacity: 0.7;
  }

  &:active {
    opacity: 0.5;
  }

  .q-icon {
    color: #666;
    transition: color 0.2s;
  }

  .q-icon.favorited {
    color: #ffc107;
  }

  .action-text {
    font-size: 12px;
    color: #666;
    line-height: 1;
  }
}

.photo-search-chat-input {
  flex: 1;
  min-width: 0;
}

// 框选预览面板
.crop-preview-panel {
  position: fixed;
  top: 80px;
  left: 20px;
  width: 280px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10003;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.crop-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.crop-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.crop-preview-close-btn {
  width: 24px;
  height: 24px;
  padding: 0;

  :deep(.q-icon) {
    font-size: 18px;
    color: #666;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.crop-preview-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.crop-preview-image-wrapper {
  width: 100%;
  height: 200px;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e0e0e0;
}

.crop-preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.crop-preview-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: #666;
  font-weight: 500;
}

.info-value {
  color: #333;
  font-family: 'Courier New', monospace;
}

// 预览面板动画
.crop-preview-panel-enter-active {
  transition: all 0.3s ease-out;
}

.crop-preview-panel-leave-active {
  transition: all 0.3s ease-in;
}

.crop-preview-panel-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.crop-preview-panel-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

// 移动端适配
@media (max-width: 768px) {
  .crop-preview-panel {
    top: 60px;
    left: 10px;
    right: 10px;
    width: auto;
    max-width: 300px;
  }

  .crop-preview-image-wrapper {
    height: 150px;
  }
}
</style>
