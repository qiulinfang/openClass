<template>
  <div class="photo-search-debug-panel">
    <q-card flat bordered class="debug-card">
      <q-card-section class="q-pa-sm">
        <div class="row items-center justify-between">
          <div class="text-subtitle2 text-weight-bold">🔧 调试面板</div>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="close"
            @click="$emit('close')"
          />
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-sm" style="max-height: 80vh; overflow-y: auto">
        <!-- 环境信息 -->
        <q-expansion-item
          icon="devices"
          label="环境信息"
          default-opened
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">运行环境:</span>
                <q-badge :color="isAndroid ? 'positive' : 'info'">
                  {{ isAndroid ? 'Android' : 'Web' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">Android Bridge:</span>
                <q-badge :color="hasAndroidBridge ? 'positive' : 'negative'">
                  {{ hasAndroidBridge ? '可用' : '不可用' }}
                </q-badge>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 视图状态 -->
        <q-expansion-item
          icon="view_module"
          label="视图状态"
          default-opened
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">相机预览:</span>
                <q-badge :color="showCameraPreview ? 'positive' : 'grey'">
                  {{ showCameraPreview ? '显示' : '隐藏' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">框选视图:</span>
                <q-badge :color="showCropView ? 'positive' : 'grey'">
                  {{ showCropView ? '显示' : '隐藏' }}
                </q-badge>
              </div>
              
              <div class="debug-item">
                <span class="debug-label">抽屉:</span>
                <q-badge :color="showDrawer ? 'positive' : 'grey'">
                  {{ showDrawer ? '打开' : '关闭' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">当前标签页:</span>
                <q-badge color="secondary">{{ activeTab }}</q-badge>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 相机状态 -->
        <q-expansion-item
          icon="camera_alt"
          label="相机状态"
          default-opened
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">相机流:</span>
                <q-badge :color="hasCameraStream ? 'positive' : 'grey'">
                  {{ hasCameraStream ? '运行中' : '未运行' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">Video元素:</span>
                <q-badge :color="hasVideoElement ? 'positive' : 'grey'">
                  {{ hasVideoElement ? '存在' : '不存在' }}
                </q-badge>
              </div>
              <div class="debug-item" v-if="cameraStreamInfo">
                <span class="debug-label">流信息:</span>
                <div class="debug-value">{{ cameraStreamInfo }}</div>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 图片状态 -->
        <q-expansion-item
          icon="image"
          label="图片状态"
          default-opened
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">当前图片:</span>
                <q-badge :color="hasCurrentImage ? 'positive' : 'grey'">
                  {{ hasCurrentImage ? '有' : '无' }}
                </q-badge>
              </div>
              <div class="debug-item" v-if="currentImageInfo">
                <span class="debug-label">图片信息:</span>
                <div class="debug-value">{{ currentImageInfo }}</div>
              </div>
              <div class="debug-item">
                <span class="debug-label">预览URL:</span>
                <q-badge :color="imagePreview ? 'positive' : 'grey'">
                  {{ imagePreview ? '有' : '无' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">裁剪图片:</span>
                <q-badge :color="croppedImageBase64 ? 'positive' : 'grey'">
                  {{ croppedImageBase64 ? '有' : '无' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">来源:</span>
                <q-badge :color="isFromGallery ? 'info' : 'secondary'">
                  {{ isFromGallery ? '相册' : '相机' }}
                </q-badge>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 框选状态 -->
        <q-expansion-item
          icon="crop"
          label="框选状态"
          default-opened
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">框选区域:</span>
                <q-badge :color="cropRect ? 'positive' : 'grey'">
                  {{ cropRect ? '有' : '无' }}
                </q-badge>
              </div>
              <div class="debug-item" v-if="cropRect">
                <span class="debug-label">位置:</span>
                <div class="debug-value">
                  x: {{ cropRect.x }}, y: {{ cropRect.y }}, w: {{ cropRect.width }}, h: {{ cropRect.height }}
                </div>
              </div>
              <div class="debug-item">
                <span class="debug-label">正在框选:</span>
                <q-badge :color="isCropping ? 'warning' : 'grey'">
                  {{ isCropping ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">正在拖拽:</span>
                <q-badge :color="isDragging ? 'warning' : 'grey'">
                  {{ isDragging ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">正在调整大小:</span>
                <q-badge :color="isResizing ? 'warning' : 'grey'">
                  {{ isResizing ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item" v-if="resizeHandle">
                <span class="debug-label">调整手柄:</span>
                <q-badge color="secondary">{{ resizeHandle }}</q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">光标样式:</span>
                <q-badge color="secondary">{{ currentCursor }}</q-badge>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 缩放状态 -->
        <q-expansion-item
          icon="zoom_in"
          label="缩放状态"
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">缩放比例:</span>
                <q-badge color="secondary">{{ imageScale.toFixed(2) }}</q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">X偏移:</span>
                <q-badge color="secondary">{{ imageOffsetX.toFixed(0) }}px</q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">Y偏移:</span>
                <q-badge color="secondary">{{ imageOffsetY.toFixed(0) }}px</q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">正在平移:</span>
                <q-badge :color="isPanning ? 'warning' : 'grey'">
                  {{ isPanning ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">正在捏合:</span>
                <q-badge :color="isPinching ? 'warning' : 'grey'">
                  {{ isPinching ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item" v-if="imageDrawInfo">
                <span class="debug-label">绘制信息:</span>
                <div class="debug-value">
                  drawX: {{ imageDrawInfo.drawX.toFixed(0) }}, 
                  drawY: {{ imageDrawInfo.drawY.toFixed(0) }}, 
                  drawW: {{ imageDrawInfo.drawWidth.toFixed(0) }}, 
                  drawH: {{ imageDrawInfo.drawHeight.toFixed(0) }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 搜索状态 -->
        <q-expansion-item
          icon="search"
          label="搜索状态"
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">拍照搜索中:</span>
                <q-badge :color="isSearching ? 'warning' : 'grey'">
                  {{ isSearching ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">关键词搜索中:</span>
                <q-badge :color="isKeywordSearching ? 'warning' : 'grey'">
                  {{ isKeywordSearching ? '是' : '否' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">关键词:</span>
                <q-badge :color="keywordText ? 'positive' : 'grey'">
                  {{ keywordText || '无' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">拍照题目数据:</span>
                <q-badge :color="photoQuestionData ? 'positive' : 'grey'">
                  {{ photoQuestionData ? '有' : '无' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">关键词题目数据:</span>
                <q-badge :color="keywordQuestionData ? 'positive' : 'grey'">
                  {{ keywordQuestionData ? '有' : '无' }}
                </q-badge>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <!-- 其他状态 -->
        <q-expansion-item
          icon="settings"
          label="其他状态"
          header-class="text-primary"
        >
          <q-card flat>
            <q-card-section class="q-pa-sm">
              <div class="debug-item">
                <span class="debug-label">选中科目:</span>
                <q-badge :color="selectedSubject ? 'positive' : 'grey'">
                  {{ selectedSubject || '无' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">分屏比例:</span>
                <q-badge color="secondary">{{ splitterModel }}%</q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">ChatView引用:</span>
                <q-badge :color="hasChatViewRef ? 'positive' : 'grey'">
                  {{ hasChatViewRef ? '有' : '无' }}
                </q-badge>
              </div>
              <div class="debug-item">
                <span class="debug-label">聊天加载中:</span>
                <q-badge :color="isChatLoading ? 'warning' : 'grey'">
                  {{ isChatLoading ? '是' : '否' }}
                </q-badge>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  // 环境信息
  isAndroid: boolean
  hasAndroidBridge: boolean
  
  // 视图状态
  showCameraPreview: boolean
  showCropView: boolean
  showDrawer: boolean
  activeTab: 'photo' | 'keyword'
  
  // 相机状态
  cameraStream: MediaStream | null
  videoElement: HTMLVideoElement | null
  
  // 图片状态
  currentImage: { file: File; preview: string; base64DataUrl?: string } | null
  imagePreview: string
  croppedImageBase64: string
  isFromGallery: boolean
  
  // 框选状态
  cropRect: { x: number; y: number; width: number; height: number } | null
  isCropping: boolean
  isDragging: boolean
  isResizing: boolean
  resizeHandle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null
  currentCursor: string
  
  // 缩放状态
  imageScale: number
  imageOffsetX: number
  imageOffsetY: number
  isPanning: boolean
  isPinching: boolean
  imageDrawInfo: {
    drawX: number
    drawY: number
    drawWidth: number
    drawHeight: number
    originalWidth: number
    originalHeight: number
  } | null
  
  // 搜索状态
  isSearching: boolean
  isKeywordSearching: boolean
  keywordText: string
  photoQuestionData: any
  keywordQuestionData: any
  
  // 其他状态
  selectedSubject: string
  splitterModel: number
  chatViewRef: any
  isChatLoading: boolean
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

// 计算属性
const hasCameraStream = computed(() => props.cameraStream !== null)
const hasVideoElement = computed(() => props.videoElement !== null)
const hasCurrentImage = computed(() => props.currentImage !== null)
const hasChatViewRef = computed(() => props.chatViewRef !== null)

const cameraStreamInfo = computed(() => {
  if (!props.cameraStream) return null
  const tracks = props.cameraStream.getVideoTracks()
  if (tracks.length === 0) return '无视频轨道'
  const track = tracks[0]
  const settings = track.getSettings()
  return `分辨率: ${settings.width}x${settings.height}, 帧率: ${settings.frameRate || 'N/A'}fps`
})

const currentImageInfo = computed(() => {
  if (!props.currentImage) return null
  const file = props.currentImage.file
  return `名称: ${file.name}, 大小: ${(file.size / 1024).toFixed(2)}KB, 类型: ${file.type}`
})
</script>

<style scoped lang="scss">
.photo-search-debug-panel {
  position: fixed;
  top: 60px;
  right: 10px;
  width: 400px;
  max-width: calc(100vw - 20px);
  z-index: 10000;
  pointer-events: auto;
}

.debug-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.debug-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  font-size: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.debug-label {
  min-width: 100px;
  font-weight: 500;
  color: #666;
  margin-right: 8px;
}

.debug-value {
  flex: 1;
  color: #333;
  word-break: break-all;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

:deep(.q-expansion-item__container) {
  border-bottom: 1px solid #e0e0e0;
}

:deep(.q-expansion-item__header) {
  padding: 8px 12px;
  min-height: 40px;
}

:deep(.q-expansion-item__content) {
  padding: 0;
}
</style>