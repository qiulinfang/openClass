<template>
  <div class="knowledge-graph-content">
    <!-- 第二列：章节目录/内容导航（中间） -->
    <div class="chapter-sidebar">
      <!-- 科目和版本信息 -->
      <div class="subject-header">
        <img src="/icons/book.svg" class="subject-icon" />
        <q-select
          v-model="selectedSubject"
          :options="subjectOptions"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          outlined
          dense
          class="subject-select"
          @update:model-value="onSubjectChange"
        >
          <template v-slot:selected>
            <div class="subject-selected">
              <span class="subject-text">{{ currentSubjectLabel }}</span>
            </div>
          </template>
        </q-select>
      </div>
      <div class="textbook-info">
        <q-select
          v-model="selectedTextbook"
          :options="textbookOptions"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          outlined
          dense
          class="textbook-select"
          @update:model-value="onTextbookChange"
        >
            <template v-slot:selected>
              <div class="textbook-selected">
                <span class="textbook-text">{{ selectedTextbookLabel }}</span>
              </div>
            </template>
          </q-select>
      </div>

      <!-- 章节目录列表 -->
      <div class="chapter-list">
        <div v-if="chapters.length === 0" class="empty-chapters">
          <q-icon name="menu_book" size="32px" color="grey-4" />
          <div class="empty-text">暂无章节数据</div>
        </div>
        <div 
          v-else
          v-for="(chapter, index) in chapters" 
          :key="index"
          class="chapter-item"
          :class="{ active: index === getCurrentChapter() }"
          @click="selectChapter(index)"
        >
          <span class="chapter-text">{{ chapter }}</span>
        </div>
      </div>
    </div>

    <!-- 第三列：核心内容/知识图谱（最右侧） -->
    <div class="main-content">
      <!-- 圆形知识图谱容器 -->
      <div class="circular-graphs-container" v-if="selectedChapterDetails" ref="circularContainerRef">
        <!-- 视口裁剪区域 -->
        <div class="viewport-clipper"
          :class="{ 'has-expanded': getCurrentChapterExpandedGraph() !== null }"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
          @click="handleBackgroundClick"
        >
          <!-- 椭圆轨迹指示器 -->
          <div class="circular-track"></div>
          <!-- 椭圆布局容器 -->
          <div 
            class="circular-layout" 
            ref="circularLayoutRef"
          >
            <!-- 右边框中心位置指示器 -->
            <div 
              class="right-border-indicator"
            >
              <div 
                v-for="subChapter in getSubChapters(selectedChapterDetails)" 
                :key="subChapter.id"
                class="indicator-dot"
                :class="{ 'active': getCurrentChapterExpandedGraph() === subChapter.id }"
                @click="handleIndicatorClick(subChapter.id)"
              >
                <img 
                  v-if="getCurrentChapterExpandedGraph() === subChapter.id" 
                  src="/icons/Indicator.svg" 
                  alt="Indicator" 
                  class="indicator-icon"
                />
              </div>
            </div>
            <div 
              v-for="(subChapter, index) in getSubChapters(selectedChapterDetails)" 
              :key="subChapter.id"
              class="graph-position"
              :style="getGraphPosition(index, getSubChapters(selectedChapterDetails).length)"
            >
              <!-- 知识图谱 -->
              <KnowledgeGraph
                :chapter-details="subChapter"
                :graph-index="index"
                :rotation="getGraphRotation(index)"
                :is-expanded="getCurrentChapterExpandedGraph() === subChapter.id"
                :has-expanded-graph="getCurrentChapterExpandedGraph() !== null"
                :rotation-direction="rotationDirection"
                :textbook-id="getCurrentTextbookId()"
                @expand="handleGraphExpand(subChapter.id)"
                class="knowledge-graph-wrapper"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态标识 - 只在选择了章节时显示 -->
      <div v-if="selectedChapterDetails" class="status-indicators">
        <div class="status-item">
          <img src="/icons/notLearnedStar.svg" alt="未学习" class="status-icon" />
          <span class="status-label">未学习</span>
        </div>
        <div class="status-item">
          <img src="/icons/learnedStar.svg" alt="已学习" class="status-icon" />
          <span class="status-label">已学习</span>
        </div>
        <div class="status-item">
          <img src="/icons/lastLearnedStar.svg" alt="上次学到" class="status-icon" />
          <span class="status-label">上次学到</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, onUnmounted } from 'vue'
import { apiService } from '../services/api-service'
import type { TextbookOption, ChapterNode } from '../types'
import KnowledgeGraph from '../components/knowledge-graph/KnowledgeGraph.vue'
import { useTextbookChapterState } from '../stores/textbookChapterState'

// 使用统一的章节状态管理
const {
  setCurrentTextbook,
  setCurrentChapter,
  getChapterRotation,
  setChapterRotation,
  getCurrentChapterExpandedGraph,
  setCurrentChapterExpandedGraph,
  clearTextbookStates,
  initializeChapterStates,
  getCurrentChapter,
  allStates
} = useTextbookChapterState()

// 响应式数据
const loading = ref(true)
const selectedChapterDetails = ref<ChapterNode | null>(null)

// 椭圆布局相关
const circularContainerRef = ref<HTMLElement>()
const circularLayoutRef = ref<HTMLElement>()

// 章节状态接口定义
// 旋转控制相关
const isDragging = ref(false) // 是否正在拖拽
const isActualDragging = ref(false) // 是否实际拖拽（超过阈值）
const isAnimating = ref(false) // 是否正在执行自动旋转动画
const startY = ref(0) // 开始触摸的Y坐标
const lastY = ref(0) // 上次触摸的Y坐标
const screenHeight = ref(window.innerHeight) // 屏幕高度
const lastRotationTime = ref(0) // 上次旋转时间戳，用于检测快速滑动

// 拖拽阈值常量
const DRAG_THRESHOLD = 5 // 像素，超过此距离才认为是实际拖拽

// 防抖定时器
const debounceTimer = ref<number | null>(null)

// 滑动速度检测
const swipeVelocity = ref(0) // 滑动速度（像素/毫秒）
const lastSwipeTime = ref(0) // 上次滑动时间戳
const swipeThreshold = 0.5 // 快速滑动的阈值（像素/毫秒）

// 展开时的旋转状态管理
const isExpandingRotation = ref(false) // 是否正在执行展开旋转动画
const expandingRotationStartAngle = ref(0) // 展开旋转起始角度
const expandingRotationTargetAngle = ref(0) // 展开旋转目标角度
const expandingRotationStartTime = ref(0) // 展开旋转开始时间

// 收缩动画状态管理
const isCollapsing = ref(false) // 是否正在执行收缩动画

// 旋转方向状态管理
const rotationDirection = ref<'clockwise' | 'counterclockwise' | null>(null) // 当前旋转方向

// 触摸事件处理函数
const handleTouchStart = (event: TouchEvent) => {
  if (!circularLayoutRef.value) return
  // 不在 touchstart 时设置 isDragging，只在 move 中设置
  isActualDragging.value = false // 初始为false，需要超过阈值才设为true
  startY.value = event.touches[0].clientY
  lastY.value = event.touches[0].clientY
  lastSwipeTime.value = Date.now()
  swipeVelocity.value = 0
  
  // 只在拖拽容器上阻止默认滚动行为，不阻止点击事件
  if (event.target === circularLayoutRef.value) {
    event.preventDefault()
  }
}

const handleTouchMove = (event: TouchEvent) => {
  if (!circularLayoutRef.value) return
  
  const currentY = event.touches[0].clientY
  const deltaY = currentY - lastY.value
  const currentTime = Date.now()
  
  // 计算移动距离，判断是否超过拖拽阈值
  const totalDeltaY = Math.abs(currentY - startY.value)
  if (totalDeltaY > DRAG_THRESHOLD && !isActualDragging.value) {
    isActualDragging.value = true
    isDragging.value = true // ✅ 只有在实际移动超过阈值时才设置 isDragging
  }
  
  // 只有实际拖拽时才执行旋转逻辑
  if (!isActualDragging.value) {
    lastY.value = currentY
    lastSwipeTime.value = currentTime
    return
  }
  
  // 计算滑动速度
  const timeDelta = currentTime - lastSwipeTime.value
  if (timeDelta > 0) {
    swipeVelocity.value = Math.abs(deltaY) / timeDelta
  }
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 360度
  // 快速滑动时增加旋转灵敏度
  const sensitivityMultiplier = swipeVelocity.value > swipeThreshold ? 1.5 : 1.0
  const rotationDelta = (deltaY / screenHeight.value * 2/ 3) * 360 * sensitivityMultiplier
  
  // 如果有知识图谱处于展开状态，先收缩它
  if (getCurrentChapterExpandedGraph() !== null) {
    setCurrentChapterExpandedGraph(null)
  }
  
  // 更新当前章节的旋转角度（向上滑动为正，向下滑动为负）
  const currentRotation = getChapterRotation(getCurrentChapter())
  setChapterRotation(getCurrentChapter(), currentRotation - rotationDelta)
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
  lastSwipeTime.value = currentTime
  
  // 只在拖拽容器上阻止默认滚动行为
  if (event.target === circularLayoutRef.value) {
    event.preventDefault()
  }
}

const handleTouchEnd = () => {
  // 保存实际拖拽状态，因为后面会重置
  const wasActuallyDragging = isActualDragging.value
  
  isDragging.value = false
  isActualDragging.value = false // 重置实际拖拽状态
  
  // 只有在实际拖拽时才执行自动定位逻辑
  if (wasActuallyDragging) {
    // 防抖处理，避免与点击事件冲突
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    
    debounceTimer.value = setTimeout(() => {
      // 滑动结束后，自动定位到160度最近的知识图谱
      autoPositionToNearestGraph()
    }, 100) // 100ms防抖
  }
}

// 重置拖拽状态（当有图谱展开时调用）
const resetDraggingState = () => {
  isDragging.value = false
}

// 自动定位到160度最近的知识图谱
const autoPositionToNearestGraph = () => {
  if (!selectedChapterDetails.value) return
  
  const subChapters = getSubChapters(selectedChapterDetails.value)
  if (subChapters.length === 0) return
  
  const currentRotation = getChapterRotation(getCurrentChapter())
  const targetAngle = 160 // 目标角度
  
  // 计算每个知识图谱当前的角度
  let nearestIndex = 0
  let minDistance = Infinity
  
  console.log('=== 自动定位到160度最近的知识图谱 ===')
  console.log(`目标角度: ${targetAngle}度`)
  console.log(`当前旋转角度: ${currentRotation}度`)
  console.log(`当前章节索引: ${getCurrentChapter()}`)
  console.log(`子章节总数: ${subChapters.length}`)
  console.log('--- 各章节角度和距离计算 ---')
  
  for (let i = 0; i < subChapters.length; i++) {
    const { currentAngle } = calculateCircularTrackAngle(i, subChapters.length)
    let angleInDegrees = (currentAngle * 180 / Math.PI) % 360
    if (angleInDegrees < 0) angleInDegrees += 360
    
    // 计算到目标角度的距离（考虑360度循环）
    const distance = Math.min(
      Math.abs(angleInDegrees - targetAngle),
      Math.abs(angleInDegrees - targetAngle + 360),
      Math.abs(angleInDegrees - targetAngle - 360)
    )
    
    // 打印每个章节的信息
    console.log(`章节 ${i}: ${subChapters[i].name || `ID:${subChapters[i].id}`}`)
    console.log(`  当前角度: ${angleInDegrees.toFixed(2)}度`)
    console.log(`  到160度距离: ${distance.toFixed(2)}度`)
    console.log(`  是否最近: ${distance < minDistance ? '是' : '否'}`)
    
    if (distance < minDistance) {
      minDistance = distance
      nearestIndex = i
    }
  }
  
  console.log('--- 最终结果 ---')
  console.log(`最近章节索引: ${nearestIndex}`)
  console.log(`最近章节: ${subChapters[nearestIndex].name || `ID:${subChapters[nearestIndex].id}`}`)
  console.log(`最小距离: ${minDistance.toFixed(2)}度`)
  
  // 计算需要旋转的角度来让最近的知识图谱到达160度位置
  const { currentAngle } = calculateCircularTrackAngle(nearestIndex, subChapters.length)
  let currentAngleInDegrees = (currentAngle * 180 / Math.PI) % 360
  if (currentAngleInDegrees < 0) currentAngleInDegrees += 360
  
  const rotationNeeded = targetAngle - currentAngleInDegrees
  
  console.log('--- 旋转计算 ---')
  console.log(`最近章节当前角度: ${currentAngleInDegrees.toFixed(2)}度`)
  console.log(`需要旋转角度: ${rotationNeeded.toFixed(2)}度`)
  console.log(`目标旋转角度: ${(currentRotation + rotationNeeded).toFixed(2)}度`)
  console.log('=== 开始执行动画 ===')
  
  // 立即设置展开状态，让展开动画开始
  setCurrentChapterExpandedGraph(subChapters[nearestIndex].id)
  
  // 只执行展开旋转动画，让它处理所有旋转逻辑（包括定位到目标位置）
  startExpandingRotation(subChapters[nearestIndex].id)
}


// 鼠标事件处理函数（可选功能）
const handleMouseDown = (event: MouseEvent) => {
  if (!circularLayoutRef.value) return
  
  // 不在 mousedown 时设置 isDragging，只在 move 中设置
  isActualDragging.value = false // 初始为false，需要超过阈值才设为true
  startY.value = event.clientY
  lastY.value = event.clientY
  
  // 阻止默认行为
}

const handleMouseMove = (event: MouseEvent) => {
  if (!circularLayoutRef.value) return
  
  const currentY = event.clientY
  const deltaY = currentY - lastY.value
  const currentTime = Date.now()
  
  // 计算移动距离，判断是否超过拖拽阈值
  const totalDeltaY = Math.abs(currentY - startY.value)
  if (totalDeltaY > DRAG_THRESHOLD && !isActualDragging.value) {
    isActualDragging.value = true
    isDragging.value = true // ✅ 只有在实际移动超过阈值时才设置 isDragging
  }
  
  // 只有实际拖拽时才执行旋转逻辑
  if (!isActualDragging.value) {
    lastY.value = currentY
    return
  }
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 360度
  const rotationDelta = (deltaY / screenHeight.value) * 360
  
  // 如果有知识图谱处于展开状态，先收缩它
  if (getCurrentChapterExpandedGraph() !== null) {
    setCurrentChapterExpandedGraph(null)
  }
  
  // 更新当前章节的旋转角度（向上滑动为正，向下滑动为负）
  const currentRotation = getChapterRotation(getCurrentChapter())
  setChapterRotation(getCurrentChapter(), currentRotation - rotationDelta)
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
}

const handleMouseUp = () => {
  // 保存实际拖拽状态，因为后面会重置
  const wasActuallyDragging = isActualDragging.value
  
  isDragging.value = false
  isActualDragging.value = false // 重置实际拖拽状态
  
  // 只有在实际拖拽时才执行自动定位逻辑
  if (wasActuallyDragging) {
    // 防抖处理，避免与点击事件冲突
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    
    debounceTimer.value = setTimeout(() => {
      // 滑动结束后，自动定位到160度最近的知识图谱
      autoPositionToNearestGraph()
    }, 100) // 100ms防抖
  }
}

// 椭圆轨迹指示器坐标系 - 统一的角度计算函数
const calculateCircularTrackAngle = (index: number, total: number) => {
  // 基础角度：第一节在椭圆轨迹指示器160度位置，逆时针排列
  // 160度转换为弧度：160 * Math.PI / 180
  const startAngle = (160 * Math.PI) / 180
  // 每个节点之间的角度间隔
  const angleStep = (2 * Math.PI) / total
  // 基础角度：从160度开始，按索引逆时针排列
  let baseAngle = startAngle + (angleStep * index)
  // 当前角度：基础角度 + 当前章节的旋转角度
  let currentAngle = baseAngle + (getChapterRotation(getCurrentChapter()) * Math.PI / 180)
  
  // 将角度标准化到 [0, 2π] 范围
  while (baseAngle >= 2 * Math.PI) baseAngle -= 2 * Math.PI
  while (baseAngle < 0) baseAngle += 2 * Math.PI
  while (currentAngle >= 2 * Math.PI) currentAngle -= 2 * Math.PI
  while (currentAngle < 0) currentAngle += 2 * Math.PI
  
  return { baseAngle, currentAngle }
}

// 椭圆轨迹指示器坐标系 - 统一的位置计算函数
const calculateCircularTrackPosition = (angle: number, radiusX: number = 569, radiusY: number = 400) => {
  // 使用椭圆轨迹指示器的坐标系：0度为正右方，逆时针为正
  const x = Math.cos(angle) * radiusX
  const y = Math.sin(angle) * radiusY
  return { x, y }
}

// 立即开始展开旋转动画（让其他节点立即开始旋转）
const startExpandingRotation = (graphId: string) => {
  // 1. 检查章节详情是否存在
  if (!selectedChapterDetails.value) return
  
  // 2. 获取子章节列表并查找目标图谱索引
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const targetIndex = subChapters.findIndex(chapter => chapter.id === graphId)
  
  // 3. 验证目标图谱是否存在
  if (targetIndex === -1) {
    return
  }
  
  // 4. 使用椭圆轨迹指示器坐标系计算目标图谱的当前角度
  const total = subChapters.length
  const { currentAngle } = calculateCircularTrackAngle(targetIndex, total)
  
  // 5. 定义椭圆轨迹指示器160度位置角度（160度 = 160 * π / 180 弧度）
  const circularTrack160Angle = (160 * Math.PI) / 180
  
  // 6. 计算角度差的绝对值 alpha
  const alpha = Math.abs(currentAngle - circularTrack160Angle)
  
  // 7. 判断目标知识图谱当前所在的半圆区域
  const currentAngleDegrees = (currentAngle * 180) / Math.PI
  let targetRotationDegrees = 0
  
  if (currentAngleDegrees > 180 && currentAngleDegrees <= 360) {
    // 上半圆：所有角度减少 alpha（逆时针转动）
    targetRotationDegrees = -(alpha * 180) / Math.PI
    rotationDirection.value = 'counterclockwise'
  } else {
    // 下半圆：所有角度增加 alpha（顺时针转动）
    targetRotationDegrees = (alpha * 180) / Math.PI
    rotationDirection.value = 'clockwise'
  }
  
  // 8. 设置展开旋转状态
  isExpandingRotation.value = true
  const currentChapterRotation = getChapterRotation(getCurrentChapter())
  expandingRotationStartAngle.value = currentChapterRotation
  expandingRotationTargetAngle.value = currentChapterRotation + targetRotationDegrees
  expandingRotationStartTime.value = performance.now()
  
  
  // 9. 开始展开旋转动画
  const animateExpandingRotation = (currentTime: number) => {
    const elapsed = currentTime - expandingRotationStartTime.value
    const duration = 500 // 动画持续时间
    const progress = Math.min(elapsed / duration, 1)
    
    // 使用更平滑的缓动函数实现流畅的动画效果
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
    const easedProgress = easeOutQuart(progress)
    
    // 计算当前角度（线性插值）
    const currentAngle = expandingRotationStartAngle.value + 
      (expandingRotationTargetAngle.value - expandingRotationStartAngle.value) * easedProgress
    
    // 更新当前章节的旋转角度
    setChapterRotation(getCurrentChapter(), currentAngle)
    
    // 如果动画未完成，继续下一帧
    if (progress < 1) {
      requestAnimationFrame(animateExpandingRotation)
    } else {
      // 动画完成，确保角度完全一致
      setChapterRotation(getCurrentChapter(), expandingRotationTargetAngle.value)
      
      console.log('=== 展开旋转动画完成 ===')
      console.log(`最终角度: ${expandingRotationTargetAngle.value.toFixed(2)}度`)
      console.log(`实际存储角度: ${getChapterRotation(getCurrentChapter()).toFixed(2)}度`)
      
      // 动画完成，立即结束展开旋转状态，让远离动画同步进行
      isExpandingRotation.value = false
    }
  }
  
  // 开始动画
  requestAnimationFrame(animateExpandingRotation)
}


// 学科选择器
const selectedSubject = ref('')
const subjectOptions = ref([
  { value: 'math', label: '数学' },
  { value: 'chinese', label: '语文' },
  { value: 'english', label: '英语' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' },
  { value: 'biology', label: '生物' },
  { value: 'geography', label: '地理' },
  { value: 'history', label: '历史' },
  { value: 'politics', label: '政治' }
])

// 教材选择器
const selectedTextbook = ref('')
const textbookOptions = ref<TextbookOption[]>([])

// 计算属性：当前选中的教材标签
const selectedTextbookLabel = computed(() => {
  const option = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
  return option ? option.label : '请选择教材'
})

// 计算属性：当前科目标签
const currentSubjectLabel = computed(() => {
  const option = subjectOptions.value.find(opt => opt.value === selectedSubject.value)
  return option ? option.label : '数学'
})

// 获取当前教材的真实ID（教材版本ID）
const getCurrentTextbookId = () => {
  const option = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
  if (option) {
    // 从value中提取教材版本ID（最后一个-后面的部分）
    const parts = option.value.split('-')
    return parts[parts.length - 1] // 教材版本ID
  }
  return ''
}


// 章节数据
const chapters = ref<string[]>([])
const chapterStructure = ref<ChapterNode[]>([])

// 初始化图谱数据（完全重置）- 保留以备将来使用
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const initGraphData = () => {
  // 清空当前教材的章节级别状态
  const textbookId = selectedTextbook.value
  
  // 清空当前教材的章节状态
  clearTextbookStates(textbookId)
  
  // 重置当前选中的章节状态
  setCurrentChapter(0)
  selectedChapterDetails.value = null
}

// 初始化图谱数据（不重置已选择的章节）
const initGraphDataWithoutReset = () => {
  // 清空当前教材的章节级别状态
  const textbookId = selectedTextbook.value
  
  // 清空当前教材的章节状态
  clearTextbookStates(textbookId)
  
  // 不重置当前选中的章节状态，保持已选择的章节
}

// 缓存键名常量
const CACHE_KEYS = {
  TEXTBOOK_OPTIONS: 'knowledge_graph_textbook_options',
  CHAPTER_STRUCTURE: 'knowledge_graph_chapter_structure_',
  CACHE_TIMESTAMP: 'knowledge_graph_cache_timestamp'
}

// 缓存过期时间（24小时）
const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000

// 检查缓存是否过期
const isCacheExpired = (timestamp: number): boolean => {
  return Date.now() - timestamp > CACHE_EXPIRE_TIME
}

// 从localStorage获取缓存数据
const getCachedData = (key: string) => {
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const data = JSON.parse(cached)
      // 检查是否过期
      if (data.timestamp && isCacheExpired(data.timestamp)) {
        localStorage.removeItem(key)
        return null
      }
      return data.value
    }
  } catch (error) {
    console.warn('读取缓存数据失败:', error)
  }
  return null
}

// 保存数据到localStorage
const setCachedData = (key: string, value: unknown) => {
  try {
    const data = {
      value,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn('保存缓存数据失败:', error)
  }
}

// 清理过期的缓存数据
const cleanupExpiredCache = () => {
  try {
    const keys = Object.keys(localStorage)
    const knowledgeGraphKeys = keys.filter(key => 
      key.startsWith('knowledge_graph_')
    )
    
    let cleanedCount = 0
    knowledgeGraphKeys.forEach(key => {
      const cached = localStorage.getItem(key)
      if (cached) {
        try {
          const data = JSON.parse(cached)
          if (data.timestamp && isCacheExpired(data.timestamp)) {
            localStorage.removeItem(key)
            cleanedCount++
          }
        } catch {
          // 如果解析失败，删除这个键
          localStorage.removeItem(key)
          cleanedCount++
        }
      }
    })
    
    if (cleanedCount > 0) {
    }
  } catch (error) {
    console.warn('清理缓存失败:', error)
  }
}


// 获取缓存状态信息
const getCacheStatus = () => {
  try {
    const keys = Object.keys(localStorage)
    const knowledgeGraphKeys = keys.filter(key => key.startsWith('knowledge_graph_'))
    
    const status = {
      totalKeys: knowledgeGraphKeys.length,
      textbookOptions: !!getCachedData(CACHE_KEYS.TEXTBOOK_OPTIONS),
      chapterStructures: knowledgeGraphKeys.filter(key => key.startsWith(CACHE_KEYS.CHAPTER_STRUCTURE)).length
    }
    
    return status
  } catch (error) {
    console.warn('获取缓存状态失败:', error)
    return { totalKeys: 0, textbookOptions: false, chapterStructures: 0 }
  }
}

// 加载教材数据
const loadTextbookData = async () => {
  try {
    // 先尝试从缓存加载
    const cachedOptions = getCachedData(CACHE_KEYS.TEXTBOOK_OPTIONS)
    if (cachedOptions) {
      textbookOptions.value = cachedOptions
      
      // 设置默认选中的教材
      if (textbookOptions.value.length > 0) {
        selectedTextbook.value = textbookOptions.value[0].value
        
        // 加载默认教材的章节结构
        const defaultOption = textbookOptions.value[0]
        if (defaultOption.textbookId) {
          await loadChapterStructure(defaultOption.textbookId)
        }
      }
      console.log('textbookOptions.value', textbookOptions.value)
      return
    }

    // 缓存中没有数据，从API获取
    const versions = await apiService.getTextbookVersions()
    
    if (versions && versions.length > 0) {
      textbookOptions.value = apiService.convertToTextbookOptions(versions)
      
      // 缓存教材选项数据
      setCachedData(CACHE_KEYS.TEXTBOOK_OPTIONS, textbookOptions.value)
      
      // 设置默认选中的教材
      if (textbookOptions.value.length > 0) {
        selectedTextbook.value = textbookOptions.value[0].value
        
        // 加载默认教材的章节结构
        const defaultOption = textbookOptions.value[0]
        if (defaultOption.textbookId) {
          await loadChapterStructure(defaultOption.textbookId)
        }
      }
    } else {
      textbookOptions.value = []
    }
  } catch {
    // 加载教材数据失败
  }
}

// 根据学科筛选教材数据
const loadTextbookDataBySubject = async (subjectValue: string) => {
  try {
    // 先尝试从缓存加载
    const cachedOptions = getCachedData(CACHE_KEYS.TEXTBOOK_OPTIONS)
    if (cachedOptions) {
      
      // 根据学科筛选教材选项
      const subjectMap: { [key: string]: string } = {
        'math': '数学',
        'chinese': '语文', 
        'english': '英语',
        'physics': '物理',
        'chemistry': '化学',
        'biology': '生物',
        'geography': '地理',
        'history': '历史',
        'politics': '政治'
      }
      
      const subjectLabel = subjectMap[subjectValue] || '数学'
      textbookOptions.value = cachedOptions.filter((option: { subject: string }) => option.subject === subjectLabel)
      
      // 设置默认选中的教材
      if (textbookOptions.value.length > 0) {
        selectedTextbook.value = textbookOptions.value[0].value
        
        // 加载默认教材的章节结构
        const defaultOption = textbookOptions.value[0]
        if (defaultOption.textbookId) {
          await loadChapterStructure(defaultOption.textbookId)
        }
      } else {
        textbookOptions.value = []
        selectedTextbook.value = ''
      }
      return
    }

    // 缓存中没有数据，从API获取
    const versions = await apiService.getTextbookVersions()
    
    if (versions && versions.length > 0) {
      const allOptions = apiService.convertToTextbookOptions(versions)
      
      // 缓存所有教材选项数据
      setCachedData(CACHE_KEYS.TEXTBOOK_OPTIONS, allOptions)
      
      // 根据学科筛选教材选项
      const subjectMap: { [key: string]: string } = {
        'math': '数学',
        'chinese': '语文', 
        'english': '英语',
        'physics': '物理',
        'chemistry': '化学',
        'biology': '生物',
        'geography': '地理',
        'history': '历史',
        'politics': '政治'
      }
      
      const subjectLabel = subjectMap[subjectValue] || '数学'
      textbookOptions.value = allOptions.filter(option => option.subject === subjectLabel)
      
      // 设置默认选中的教材
      if (textbookOptions.value.length > 0) {
        selectedTextbook.value = textbookOptions.value[0].value
        
        // 加载默认教材的章节结构
        const defaultOption = textbookOptions.value[0]
        if (defaultOption.textbookId) {
          await loadChapterStructure(defaultOption.textbookId)
        }
      } else {
        textbookOptions.value = []
        selectedTextbook.value = ''
      }
    } else {
      textbookOptions.value = []
    }
    
  } catch {
    // 加载教材数据失败
  }
}

// 将阿拉伯数字转换为中文数字
const convertToChineseNumber = (str: string): string => {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  
  return str.replace(/第(\d+)章/g, (match, num) => {
    const number = parseInt(num)
    if (number >= 1 && number <= 9) {
      return `第${chineseNumbers[number]}章`
    } else if (number >= 10) {
      // 处理两位数的情况
      const tens = Math.floor(number / 10)
      const ones = number % 10
      if (tens === 1) {
        return ones === 0 ? '第十章' : `第十${chineseNumbers[ones]}章`
      } else {
        return ones === 0 ? `第${chineseNumbers[tens]}十章` : `第${chineseNumbers[tens]}十${chineseNumbers[ones]}章`
      }
    }
    return match
  })
}

// 加载章节结构
const loadChapterStructure = async (textbookId: string) => {
  try {
    // 先尝试从缓存加载章节结构
    const cacheKey = `${CACHE_KEYS.CHAPTER_STRUCTURE}${textbookId}`
    const cachedChapterData = getCachedData(cacheKey)
    
    if (cachedChapterData) {
      chapterStructure.value = cachedChapterData
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = cachedChapterData.map((chapter: { name: string }) => convertToChineseNumber(chapter.name))
      console.log('chapters.value', chapters.value)
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, cachedChapterData, getSubChapters)
      return
    }

    // 缓存中没有数据，从API获取
    const chapterData = await apiService.getTextbookStructure(textbookId)
    if (chapterData && chapterData.length > 0) {
      // 对章节进行排序：按照children[0].name的第一个数字排序
      const sortedChapterData = chapterData.sort((a, b) => {
        // 获取每个章节的第一个子章节名称
        const aFirstChild = a.children && a.children.length > 0 ? a.children[0].name : ''
        const bFirstChild = b.children && b.children.length > 0 ? b.children[0].name : ''
        
        // 提取第一个数字进行比较
        const aChapterNum = parseInt(aFirstChild.match(/^(\d+)/)?.[1] || '0')
        const bChapterNum = parseInt(bFirstChild.match(/^(\d+)/)?.[1] || '0')
        
        return aChapterNum - bChapterNum
      })
      
      chapterStructure.value = sortedChapterData
      
      // 缓存章节结构数据
      setCachedData(cacheKey, sortedChapterData)
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = sortedChapterData.map(chapter => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, sortedChapterData, getSubChapters)
    } else {
      chapterStructure.value = []
      chapters.value = []
    }
  } catch {
    chapterStructure.value = []
    chapters.value = []
  }
}

// 章节状态初始化已移至统一模块

// 性能监控工具
const performanceMonitor = {
  // 记录性能数据
  recordPerformance(operation: string, duration: number): void {
    const perfData = {
      operation,
      duration,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    }
    
    // 存储到localStorage用于分析
    const existingData = JSON.parse(localStorage.getItem('perfData') || '[]')
    existingData.push(perfData)
    
    // 只保留最近50条记录
    if (existingData.length > 50) {
      existingData.splice(0, existingData.length - 50)
    }
    
    localStorage.setItem('perfData', JSON.stringify(existingData))
  },
  
  // 获取性能统计
  getPerformanceStats(): {
    count: number
    average: number
    min: number
    max: number
    lastOperation: { operation: string; duration: number; timestamp: number }
  } | null {
    const perfData = JSON.parse(localStorage.getItem('perfData') || '[]')
    const authOperations = perfData.filter((d: { operation: string }) => d.operation.includes('认证'))
    
    if (authOperations.length === 0) return null
    
    const durations = authOperations.map((d: { duration: number }) => d.duration)
    return {
      count: authOperations.length,
      average: durations.reduce((a: number, b: number) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      lastOperation: authOperations[authOperations.length - 1]
    }
  }
}

// 智能会话管理器
const sessionManager = {
  // 检查会话是否有效
  async isSessionValid(): Promise<boolean> {
    const startTime = performance.now()
    
    try {
      // 检查本地存储的token和userId
      const token = localStorage.getItem('YANBAN_TOKEN')
      const userId = localStorage.getItem('studentUserId')
      
      if (!token || !userId || token === 'undefined' || userId === 'undefined') {
        return false
      }
      
      // 检查token是否为空字符串
      if (token.trim() === '' || userId.trim() === '') {
        return false
      }
      
      // 检查登录时间是否过期（24小时）
      const lastLoginTime = localStorage.getItem('lastLoginTime')
      if (lastLoginTime) {
        const now = Date.now()
        const loginTime = parseInt(lastLoginTime)
        const SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24小时
        
        if (now - loginTime > SESSION_TIMEOUT) {
          return false
        }
      }
      
      const endTime = performance.now()
      performanceMonitor.recordPerformance('会话验证', endTime - startTime)
      return true
    } catch {
      return false
    }
  },
  
  // 智能重新认证
  async ensureAuthentication(): Promise<boolean> {
    const startTime = performance.now()
    
    const isValid = await this.isSessionValid()
    if (isValid) {
      const endTime = performance.now()
      performanceMonitor.recordPerformance('智能认证-使用现有会话', endTime - startTime)
      return true
    }
    
    const result = await apiService.autoLogin(false)
    const endTime = performance.now()
    performanceMonitor.recordPerformance('智能认证-重新登录', endTime - startTime)
    return result
  },
  
  // 更新登录时间戳
  updateLoginTimestamp(): void {
    localStorage.setItem('lastLoginTime', Date.now().toString())
  }
}


// 初始化图谱
const initGraph = async () => {
  loading.value = true
  
  try {
    // 使用智能认证，只在必要时重新登录
    const authSuccess = await sessionManager.ensureAuthentication()
    
    if (!authSuccess) {
      return
    }
    
    
    // 设置默认学科
    selectedSubject.value = 'math'
    
    // 先加载教材数据
    await loadTextbookData()
    
    // 如果有教材数据，自动选择第一个教材并加载章节
    if (textbookOptions.value.length > 0) {
      const firstTextbook = textbookOptions.value[0]
      selectedTextbook.value = firstTextbook.value
      
      console.log('自动选择教材:', {
        selectedTextbook: selectedTextbook.value,
        firstTextbook: firstTextbook,
        textbookId: firstTextbook.textbookId
      })
      
      // 加载第一个教材的章节结构
      if (firstTextbook.textbookId && firstTextbook.textbookId !== 'default') {
        await loadChapterStructure(firstTextbook.textbookId)
        
        // 自动选择第一个章节
        if (chapterStructure.value.length > 0) {
          setCurrentChapter(0)
          selectedChapterDetails.value = chapterStructure.value[0]
          
          // 自动展开第一个图谱
          const firstSubChapter = getSubChapters(chapterStructure.value[0])
          if (firstSubChapter.length > 0) {
            setCurrentChapterExpandedGraph(firstSubChapter[0].id)
          }
        }
      }
    }
    
    // 初始化图谱数据（但不重置已选择的章节）
    initGraphDataWithoutReset()
    
    // 这里可以集成真实的图谱库，如 vis.js, d3.js, cytoscape.js 等
    // 目前使用简单的DOM渲染
    await nextTick()
    renderGraph()
    
    
  } catch (error) {
    // 初始化知识图谱失败
    console.error('❌ 图谱初始化失败:', error)
  } finally {
    loading.value = false
  }
}

// CSS动画方法
const initCSSAnimations = () => {
  // CSS动画初始化（如果需要的话）
  // 这里可以设置CSS动画的默认配置
}

const cleanupAnimations = () => {
  // 清理动画状态
  isAnimating.value = false
}

// 渲染图谱
const renderGraph = () => {
  const container = document.getElementById('knowledge-graph')
  if (!container) return

  // 清空容器内容
  container.innerHTML = ''
}


// 学科切换
const onSubjectChange = async (subjectValue: string) => {
  try {
    // 根据学科筛选教材选项
    await loadTextbookDataBySubject(subjectValue)
    
    // 如果有教材数据，自动选择第一个教材并加载章节
    if (textbookOptions.value.length > 0) {
      const firstTextbook = textbookOptions.value[0]
      selectedTextbook.value = firstTextbook.value
      
      // 加载第一个教材的章节结构
      if (firstTextbook.textbookId && firstTextbook.textbookId !== 'default') {
        await loadChapterStructure(firstTextbook.textbookId)
        
        // 自动选择第一个章节
        if (chapterStructure.value.length > 0) {
          setCurrentChapter(0)
          selectedChapterDetails.value = chapterStructure.value[0]
          
          // 自动展开第一个图谱
          const firstSubChapter = getSubChapters(chapterStructure.value[0])
          if (firstSubChapter.length > 0) {
            setCurrentChapterExpandedGraph(firstSubChapter[0].id)
          }
        }
      }
    }
    
    // 初始化图谱数据（但不重置已选择的章节）
    initGraphDataWithoutReset()
    
  } catch (error) {
    console.error('切换学科失败:', error)
  }
}

// 教材切换
const onTextbookChange = async (value: string) => {
  try {
    console.log('333')
    // 找到选中的教材选项
    const selectedOption = textbookOptions.value.find(opt => opt.value === value)
    if (!selectedOption) {
      return
    }
    
    // 设置当前教材到状态管理器
    if (selectedOption.textbookId) {
      setCurrentTextbook(selectedOption.textbookId)
    }
    
    // 根据教材ID加载章节结构
    if (selectedOption.textbookId && selectedOption.textbookId !== 'default') {
      await loadChapterStructure(selectedOption.textbookId)
      
      // 自动选择第一个章节
      if (chapterStructure.value.length > 0) {
        setCurrentChapter(0)
        selectedChapterDetails.value = chapterStructure.value[0]
      }
    }
    
    // 初始化图谱数据（但不重置已选择的章节）
    initGraphDataWithoutReset()
    
    renderGraph()
    
  } catch {
    // 切换教材失败
  }
}

// 选择章节
const selectChapter = (index: number) => {
  console.log('444')
  
  // 🔍 重复点击检测：检查是否点击的是当前已选中的章节
  const currentChapterIndex = getCurrentChapter()
  if (currentChapterIndex === index) {
    console.log('🔄 重复点击同一章节，跳过处理')
    return
  }
  
  setCurrentChapter(index)
  
  // 打印所有状态
  console.log('📊 All States:', Array.from(allStates.value.entries()))
  
  // 获取选中章节的详细信息
  if (chapterStructure.value && chapterStructure.value.length > index) {
    console.log('666', chapterStructure.value[index])
    selectedChapterDetails.value = chapterStructure.value[index]
    // 输出新章节的角度分布
    nextTick(() => {
      logAngleDistribution()
    })
  }
}

// 处理知识图谱展开状态
const handleGraphExpand = (graphId: string) => {
  // 如果正在执行展开旋转动画、收缩动画或拖拽操作，禁用点击切换功能
  if (isExpandingRotation.value || isCollapsing.value || isDragging.value) {
    return
  }
  
  // 如果点击的是当前展开的图谱，保持展开状态
  if (getCurrentChapterExpandedGraph() === graphId) {
    // 不执行收缩逻辑，保持展开状态
    return
  } else {
    // 重置拖拽状态，确保展开时不会有滚动干扰
    resetDraggingState()
    
    // 立即设置展开状态，让膨胀动画立即开始
    setCurrentChapterExpandedGraph(graphId)
    
    // 立即开始展开旋转动画，让其他节点立即开始旋转
    startExpandingRotation(graphId)
  }
}

// 处理指示器点击事件
const handleIndicatorClick = (graphId: string) => {
  // 如果正在执行展开旋转动画、收缩动画或拖拽操作，禁用点击功能
  if (isExpandingRotation.value || isCollapsing.value || isDragging.value) {
    return
  }
  // 如果点击的是当前展开的图谱，保持展开状态
  if (getCurrentChapterExpandedGraph() === graphId) {
    // 不执行收缩逻辑，保持展开状态
    return
  } else {
    // 重置拖拽状态，确保展开时不会有滚动干扰
    resetDraggingState()
    
    // 立即设置展开状态，让膨胀动画立即开始
    setCurrentChapterExpandedGraph(graphId)
    
    // 立即开始展开旋转动画，让其他节点立即开始旋转
    startExpandingRotation(graphId)
  }
}

// 处理背景点击事件
const handleBackgroundClick = (event: MouseEvent) => {
  // 如果当前没有展开的图谱，不需要处理
  if (getCurrentChapterExpandedGraph() === null) {
    return
  }
  
  // 如果正在执行展开旋转动画或收缩动画，禁用背景点击收缩功能
  if (isExpandingRotation.value || isCollapsing.value) {
    return
  }
  
  // 检查点击的目标元素
  const target = event.target as HTMLElement
  
  // 如果点击的是视口裁剪区域或其子元素（背景），保持展开状态
  if (target.closest('.viewport-clipper')) {
    // 点击视口裁剪区域时，保持当前展开状态不变
    // 移除不必要的状态重置逻辑，避免opacity闪烁
    return
  }
}


// 获取子章节（x.x格式的小节）
const getSubChapters = (chapterDetails: ChapterNode | null) => {
  if (!chapterDetails || !chapterDetails.children) {
    return []
  }
  
  // 过滤出level=1的子章节（x.x格式）
  const subChapters = chapterDetails.children.filter(child => child.level === 1)
  
  // 按节的顺序排序：提取名称中的数字进行排序
  const sortedSubChapters = subChapters.sort((a, b) => {
    // 提取名称中的数字进行比较（如"1.1"、"1.2"、"2.1"等）
    const aMatch = a.name.match(/(\d+)\.(\d+)/)
    const bMatch = b.name.match(/(\d+)\.(\d+)/)
    
    if (aMatch && bMatch) {
      const aChapter = parseInt(aMatch[1])
      const aSection = parseInt(aMatch[2])
      const bChapter = parseInt(bMatch[1])
      const bSection = parseInt(bMatch[2])
      
      // 先按章排序，再按节排序
      if (aChapter !== bChapter) {
        return aChapter - bChapter
      }
      return aSection - bSection
    }
    
    // 如果无法提取数字，按名称排序
    return a.name.localeCompare(b.name)
  })
  
  // 为每个章节添加章节练习节点
  const exerciseNode: ChapterNode = {
    id: `${chapterDetails.id}_exercise`,
    name: '章节练习',
    parentId: chapterDetails.id,
    label: '章节练习',
    level: 1, // 确保是x.x层级
    isRoot: false,
    updateTime: new Date().toISOString(),
    children: []
  }
  
  // 将章节练习节点添加到子章节列表的末尾
  return [...sortedSubChapters, exerciseNode]
}

/**
 * 计算知识图谱在椭圆轨迹中的位置和样式
 * 
 * @param index 当前知识图谱的索引
 * @param total 知识图谱的总数量
 * @returns CSS样式对象，包含位置、缩放、透明度和动画属性
 */
const getGraphPosition = (index: number, total: number) => {
  
  // 获取基础数据
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const currentExpandedGraph = getCurrentChapterExpandedGraph()
  const expandedIndex = currentExpandedGraph ? 
    subChapters.findIndex(chapter => chapter.id === currentExpandedGraph) : -1
  
  // 计算基础角度 - 使用当前章节的旋转角度
  const { currentAngle } = calculateCircularTrackAngle(index, total)
  const angle = currentAngle
  
  // 展开状态的位置调整逻辑
  const isRapidScrolling = isDragging.value && (Date.now() - lastRotationTime.value) < 100
  
  if (currentExpandedGraph !== null && expandedIndex !== -1 && !isDragging.value && !isRapidScrolling) {
    if (index === expandedIndex) {
      // 展开的知识图谱保持在椭圆轨迹上，移动到160度位置
      const { x, y } = calculateCircularTrackPosition(angle, 569, 400)
      return {
        transform: `translate(${x}px, ${y}px)`,
        position: 'absolute' as const,
        left: '50%',
        top: '50%',
        marginLeft: '-237px',
        marginTop: '-237px',
        opacity: 0.9, // 展开的知识图谱保持完全不透明
        zIndex: 100, // 展开的知识图谱获得最高层级
        transition: isDragging.value ? 'none' : 
                    isExpandingRotation.value ? 'none' :
                    isCollapsing.value ? 'none' :
                    'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }
    } else {
      // 其他知识图谱在轨道上平滑移动且不展开
      const { currentAngle: expandedAngle } = calculateCircularTrackAngle(expandedIndex, total)
      let angleDiff = Math.abs(angle - expandedAngle)
      
      // 处理椭圆轨迹首尾相接的边界情况（角度跨越0度/360度）
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff
      }
      
      // 定义影响范围：影响展开图谱前后2-3个节点（约120度范围）
      const influenceRange = (2 * Math.PI) / 3 // 120度
      
      if (angleDiff < influenceRange) {
        // 计算距离因子：距离越近，推开角度越大
        const distanceFactor = 1 - (angleDiff / influenceRange)
        // 使用二次缓动函数实现距离越近推得越远的效果
        const maxPushAngle = (32 * Math.PI) / 180 // 最大推开角度150度
        const pushAngle = maxPushAngle * Math.pow(distanceFactor, 2)
        
        
        // 判断旋转方向：上半圆顺时针，下半圆逆时针
        let rotationDirection = 1
        if (angle > Math.PI && angle <= 2 * Math.PI) {
          rotationDirection = 1  // 上半圆：顺时针
        } else {
          rotationDirection = -1 // 下半圆：逆时针
        }
        
        // 应用推开旋转，让其他节点沿轨道移动
        const adjustedAngle = angle + (rotationDirection * pushAngle)
        
        const { x, y } = calculateCircularTrackPosition(adjustedAngle, 569, 400)
        
        // 计算缩放和透明度 - 距离展开图谱越近，透明度越低
        const scale = 1 - (distanceFactor * 0.1) // 减少缩放幅度
        const opacity = 0.5 + (distanceFactor * 0.1) // 距离越近越透明，范围0.3-0.5
        
        // 计算动画延迟 - 距离越近延迟越短，移动更同步
        const animationDelay = distanceFactor * 0.03
        
        return {
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          marginLeft: '-237px',
          marginTop: '-237px',
          opacity: opacity,
          zIndex: 1000 - index, // 反向层级：前面的节点层级更高，确保可点击
          // 与定位动画同步：减少延迟时间，让远离动画与定位动画同时进行
          transition: isDragging.value ? 'none' : 
            isExpandingRotation.value ? 'none' :
            isCollapsing.value ? 'none' :
            `transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${animationDelay}s, 
             opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${animationDelay}s`
        }
      } else {
        // 距离展开图谱较远的节点，保持当前位置但变为半透明
        const { x, y } = calculateCircularTrackPosition(angle, 569, 400)
        return {
          transform: `translate(${x}px, ${y}px)`, // 移除缩小比例，保持原始大小
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          marginLeft: '-237px',
          marginTop: '-237px',
          opacity: 0.4, // 距离较远的节点也变为半透明
          zIndex: 1000 - index, // 反向层级：前面的节点层级更高，确保可点击
          transition: isDragging.value ? 'none' : 
            isExpandingRotation.value ? 'none' :
            isCollapsing.value ? 'none' :
            `transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s`
        }
      }
    }
  }
  
  // 默认椭圆轨迹位置计算
  const { x, y } = calculateCircularTrackPosition(angle, 569, 400)
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    marginLeft: '-237px',
    marginTop: '-237px',
    opacity: 0.8, // 确保默认状态下完全可见
    zIndex: 1000 - index, // 反向层级：前面的节点层级更高，确保可点击
    transition: isDragging.value ? 'none' : 
                isAnimating.value ? 'none' : 
                isExpandingRotation.value ? 'none' :
                isCollapsing.value ? 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' :
                'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  }
}

// 计算知识图谱的旋转角度（椭圆轨迹指示器坐标系 - 保持水平，不旋转内容）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getGraphRotation = (_index: number) => {
  // 在椭圆轨迹指示器坐标系中，知识图谱内容保持水平，不进行旋转
  // 只有位置会随容器旋转而改变，内容本身保持水平状态
  return 0
}

// 椭圆轨迹指示器坐标系角度分布总览函数
const logAngleDistribution = () => {
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const total = subChapters.length
  
  for (let i = 0; i < total; i++) {
    // 使用统一的椭圆轨迹指示器坐标系计算角度
    calculateCircularTrackAngle(i, total)
    
    // 使用统一的椭圆轨迹指示器坐标系计算位置
    calculateCircularTrackPosition(calculateCircularTrackAngle(i, total).currentAngle, 569, 400)
  }
}

// 组件挂载时初始化
onMounted(() => {
  // 清理过期的缓存数据
  cleanupExpiredCache()
  
  // 获取缓存状态信息
  getCacheStatus()
  
  
  initGraph()
  initCSSAnimations()
  
  // 输出角度分布总览
  nextTick(() => {
    logAngleDistribution()
  })
  
  
  // 更新屏幕高度
  const updateScreenHeight = () => {
    screenHeight.value = window.innerHeight
  }
  
  window.addEventListener('resize', updateScreenHeight)
  
  // 清理函数
  onUnmounted(() => {
    window.removeEventListener('resize', updateScreenHeight)
    
    // 清理防抖定时器
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
  })
})


onUnmounted(() => {
  cleanupAnimations()
})
</script>

<style lang="scss" scoped>
.knowledge-graph-content {
  display: flex;
  height: 100vh;
  background: url('/icons/background.svg') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
}

// 第二列：章节目录/内容导航（中间）
.chapter-sidebar {
  width: 30%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  position: relative;
  
  .subject-header {
    flex-shrink: 0;
    margin-top: 16px;
  }
  
  .textbook-info {
    flex-shrink: 0;
  }
  
  .chapter-list {
    flex: 1;
    overflow-y: auto;
    margin-top: 16px;
  }
}

.subject-header {
  padding: 15px 15px;
  margin: 2px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border-radius: 12px;
  font-family: 'PingFang SC', sans-serif;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 85px;
  
  .subject-icon {
    width: 85px;
    height: 85px;
  }

    .subject-select {
      width: fit-content;
      
      .subject-selected {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        
        .subject-text {
          font-size: 36px;
          font-weight: 500;
          color: #ffffff;
      }
    }
  }
}

.textbook-info {
  padding: 6px 5px;
  margin: 14px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border-radius: 12px;
  font-family: 'PingFang SC', sans-serif;
  border: 1px solid rgba(227, 224, 235, 0.3);
  background: rgba(255, 255, 255, 0.1);
  min-height: 40px;
  display: flex;
  align-items: center;
  
  .textbook-select {
    width: 100%;
    
    .q-field__control {
      border-radius: 6px;
      border: none;
      background: transparent;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      &:focus {
        border: none;
        box-shadow: none;
      }
    }
    
    .q-field__native {
      padding: 8px 12px;
      color: #FFFFFF;
    }
  }
  
  .textbook-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  
  .textbook-text {
    font-size: 19px;
    color: #FFFFFF;
    font-weight: 350;
  }
  
  .textbook-arrow {
    color: #FFFFFF;
    font-size: 18px;
    transition: transform 0.2s ease;
  }
}


.chapter-list {
  flex: 1;
  overflow-y: auto;
  
  .empty-chapters {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: #9ca3af;
    
    .empty-text {
      margin-top: 12px;
      font-size: 14px;
    }
  }
  
  .chapter-item {
    padding: 11px 15px;
    margin: 2px 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    border-radius: 12px;
    font-family: 'PingFang SC', sans-serif;
    
    &.active {
      background-color: #e0dbff;
      
      .chapter-text {
        color: #393548;
      }
    }
    
    &:hover:not(.active) {
      background: #f3f4f6;
    }
    
    .chapter-text {
      font-size: 19px;
      font-weight: 500;
      color: #9E9AAD;
    }
  }
}

// 第三列：核心内容/知识图谱（最右侧）
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// 圆形知识图谱容器
.circular-graphs-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 视口裁剪区域
.viewport-clipper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  // 移除 clip-path，显示完整视口区域
  
  // 当有图谱展开时，移除视觉反馈
}

// 椭圆轨迹指示器
.circular-track {
  position: absolute;
  width: 1139px;
  height: 800px;
  left: 106%;
  top: 38%;
  margin-left: -569px;
  margin-top: -400px;
  border-radius: 50%;
}


// 椭圆布局容器 - 不再需要旋转，只作为定位容器
.circular-layout {
  position: relative;
  width: 1239px;
  height: 900px;
  left: 106%;
  top: 38%;
  margin-left: -619px;
  margin-top: -450px;
  cursor: grab;
  user-select: none;
  touch-action: none; // 禁用默认触摸行为
  z-index: 100; // 设置基础层级
  
  &:active {
    cursor: grabbing;
  }
  
  // 当有图谱展开时，禁用滚动交互
  &.scroll-disabled {
    cursor: default;
    
    &:active {
      cursor: default;
    }
  }
}

// 右边框中心位置指示器
.right-border-indicator {
  position: absolute;
  right: 55%;
  top: 40%;
  z-index: 1000; // 提高层级，确保在最上层
  height: 30%;
  width: 40px;
  background: transparent;
  pointer-events: auto; // 启用点击事件
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: center;
  
  .indicator-dot {
    width: 21px;
    height: 21px;
    background: rgba(139, 92, 246, 0.3);
    border-radius: 50%;
    transition: all 0.3s ease;
    cursor: pointer; // 添加指针样式
    position: relative;
    z-index: 1001; // 确保圆点在最上层
    
    &:hover {
      background: rgba(139, 92, 246, 0.5);
      transform: scale(1.1);
    }
    
    &.active {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6d28d9 100%);
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
      position: relative;
    }
  }
  
  .indicator-icon {
    position: absolute;
    left: -30px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    z-index: 10;
  }
}

// 知识图谱位置容器
.graph-position {
  position: absolute;
  width: 475px;
  height: 475px;
  transform-origin: center center;
}

// 知识图谱包装器
.knowledge-graph-wrapper {
  width: 100%;
  height: 100%;
  transform-origin: center center;
}



// 底部状态标识样式
.status-indicators {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 16px 24px;
  
  .status-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    
    .status-icon {
      width: 30px;
      height: 30px;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }
    
    .status-label {
      font-size: 15px;
      color: #FFFFFF;
      font-weight: 500;
    }
  }
}



// 响应式设计
@media (max-width: 768px) {
  .chapter-sidebar {
    width: 240px;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}
</style>
