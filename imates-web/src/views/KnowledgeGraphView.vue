<template>
  <div class="knowledge-graph-layout">
    <!-- 第一列：功能箱/侧边栏（最左侧） -->
    <div class="function-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <!-- 展开/收起按钮 -->
      <div class="sidebar-toggle">
        <q-btn 
          flat 
          dense 
          round 
          class="toggle-btn"
          @click="toggleSidebar"
        >
          <q-icon name="menu" size="20px" color="grey-6" />
        </q-btn>
      </div>

      <!-- 功能菜单 -->
      <div class="function-menu" v-show="!sidebarCollapsed">
        <div class="nav-item" :class="{ active: false }">
          <q-icon name="apps" size="24px" color="grey-6" />
          <span class="nav-text">功能箱</span>
        </div>
        <div class="nav-item active">
          <q-icon name="account_tree" size="24px" color="white" />
          <span class="nav-text">知识图谱</span>
        </div>
      </div>
    </div>

    <!-- 第二列：章节目录/内容导航（中间） -->
    <div class="chapter-sidebar" :class="{ collapsed: chapterCollapsed }">
      <!-- 收起按钮 -->
      <div class="chapter-toggle">
        <q-btn 
          flat 
          dense 
          round 
          class="toggle-btn"
          @click="toggleChapter"
        >
          <q-icon name="chevron_left" size="20px" color="grey-6" />
        </q-btn>
      </div>

      <!-- 科目和版本信息 -->
      <div class="subject-info" v-show="!chapterCollapsed">
        <div class="subject-header">
          <q-icon name="menu_book" size="20px" color="grey-7" />
          <span class="subject-text">{{ currentSubjectLabel }}</span>
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
                <q-icon name="keyboard_arrow_down" size="16px" color="grey-6" />
              </div>
            </template>
          </q-select>
        </div>
      </div>

      <!-- 章节目录列表 -->
      <div class="chapter-list" v-show="!chapterCollapsed">
        <div v-if="chapters.length === 0" class="empty-chapters">
          <q-icon name="menu_book" size="32px" color="grey-4" />
          <div class="empty-text">暂无章节数据</div>
        </div>
        <div 
          v-else
          v-for="(chapter, index) in chapters" 
          :key="index"
          class="chapter-item"
          :class="{ active: index === selectedChapter }"
          @click="selectChapter(index)"
        >
          <span class="chapter-text">{{ chapter }}</span>
          <div class="chapter-progress" v-if="index === selectedChapter">
            <q-linear-progress 
              :value="0.6" 
              color="primary" 
              size="2px"
              class="progress-bar"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 第三列：核心内容/知识图谱（最右侧） -->
    <div class="main-content">
      <!-- 圆形知识图谱容器 -->
      <div class="circular-graphs-container" v-if="selectedChapterDetails" ref="circularContainerRef">
        <!-- 视口裁剪区域 -->
        <div class="viewport-clipper"
          :class="{ 'has-expanded': expandedGraphId !== null }"
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
            :class="{ 'scroll-disabled': expandedGraphId !== null }"
            ref="circularLayoutRef"
          >
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
                :is-expanded="expandedGraphId === subChapter.id"
                :has-expanded-graph="expandedGraphId !== null"
                :rotation-direction="rotationDirection"
                @expand="handleGraphExpand(subChapter.id)"
                class="knowledge-graph-wrapper"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态标识 -->
      <div class="status-indicators">
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

// 响应式数据
const loading = ref(true)
const selectedChapter = ref(0)
const selectedChapterDetails = ref<ChapterNode | null>(null)

// 布局控制
const sidebarCollapsed = ref(false)
const chapterCollapsed = ref(false)

// 椭圆布局相关
const circularContainerRef = ref<HTMLElement>()
const circularLayoutRef = ref<HTMLElement>()

// 旋转控制相关
const chapterRotationAngles = ref<Map<number, number>>(new Map()) // 各章节的旋转角度（度）
const isDragging = ref(false) // 是否正在拖拽
const isAnimating = ref(false) // 是否正在执行自动旋转动画
const startY = ref(0) // 开始触摸的Y坐标
const lastY = ref(0) // 上次触摸的Y坐标
const screenHeight = ref(window.innerHeight) // 屏幕高度
const lastRotationTime = ref(0) // 上次旋转时间戳，用于检测快速滑动

// 获取指定章节的旋转角度，如果不存在则返回0
const getChapterRotation = (chapterIndex: number): number => {
  return chapterRotationAngles.value.get(chapterIndex) ?? 0
}

// 设置指定章节的旋转角度
const setChapterRotation = (chapterIndex: number, angle: number) => {
  chapterRotationAngles.value.set(chapterIndex, angle)
}

// 展开时的旋转状态管理
const isExpandingRotation = ref(false) // 是否正在执行展开旋转动画
const expandingRotationStartAngle = ref(0) // 展开旋转起始角度
const expandingRotationTargetAngle = ref(0) // 展开旋转目标角度
const expandingRotationStartTime = ref(0) // 展开旋转开始时间

// 收缩动画状态管理
const isCollapsing = ref(false) // 是否正在执行收缩动画

// 旋转方向状态管理
const rotationDirection = ref<'clockwise' | 'counterclockwise' | null>(null) // 当前旋转方向

// 全局展开状态管理
const expandedGraphId = ref<string | null>(null) // 当前展开的知识图谱ID

// 触摸事件处理函数
const handleTouchStart = (event: TouchEvent) => {
  if (!circularLayoutRef.value) return
  
  // 如果有知识图谱处于展开状态，禁用滚动
  if (expandedGraphId.value !== null) {
    return
  }
  
  isDragging.value = true
  startY.value = event.touches[0].clientY
  lastY.value = event.touches[0].clientY
  
  // 只在拖拽容器上阻止默认滚动行为，不阻止点击事件
  if (event.target === circularLayoutRef.value) {
    event.preventDefault()
  }
}

const handleTouchMove = (event: TouchEvent) => {
  if (!isDragging.value || !circularLayoutRef.value) return
  
  // 如果有知识图谱处于展开状态，禁用滚动
  if (expandedGraphId.value !== null) {
    return
  }
  
  const currentY = event.touches[0].clientY
  const deltaY = currentY - lastY.value
  const currentTime = Date.now()
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 360度
  const rotationDelta = (deltaY / screenHeight.value * 2/ 3) * 360
  
  // 更新当前章节的旋转角度（向上滑动为正，向下滑动为负）
  const currentRotation = getChapterRotation(selectedChapter.value)
  setChapterRotation(selectedChapter.value, currentRotation - rotationDelta)
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
  
  // 只在拖拽容器上阻止默认滚动行为
  if (event.target === circularLayoutRef.value) {
    event.preventDefault()
  }
}

const handleTouchEnd = () => {
  isDragging.value = false
  // 松手后保持最终角度，无回弹
}

// 重置拖拽状态（当有图谱展开时调用）
const resetDraggingState = () => {
  isDragging.value = false
}

// 鼠标事件处理函数（可选功能）
const handleMouseDown = (event: MouseEvent) => {
  if (!circularLayoutRef.value) return
  
  // 如果有知识图谱处于展开状态，禁用滚动
  if (expandedGraphId.value !== null) {
    return
  }
  
  isDragging.value = true
  startY.value = event.clientY
  lastY.value = event.clientY
  
  // 阻止默认行为
  
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !circularLayoutRef.value) return
  
  // 如果有知识图谱处于展开状态，禁用滚动
  if (expandedGraphId.value !== null) {
    return
  }
  
  const currentY = event.clientY
  const deltaY = currentY - lastY.value
  const currentTime = Date.now()
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 360度
  const rotationDelta = (deltaY / screenHeight.value) * 360
  
  // 更新当前章节的旋转角度（向上滑动为正，向下滑动为负）
  const currentRotation = getChapterRotation(selectedChapter.value)
  setChapterRotation(selectedChapter.value, currentRotation - rotationDelta)
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
}

const handleMouseUp = () => {
  isDragging.value = false
}

// 椭圆轨迹指示器坐标系 - 统一的角度计算函数
const calculateCircularTrackAngle = (index: number, total: number) => {
  // 基础角度：第一节在椭圆轨迹指示器160度位置，逆时针排列
  // 360度，分成total份，每份的角度是2 * Math.PI / total
  let baseAngle = Math.PI + (2 * Math.PI * index) / total
  // 当前角度：基础角度 + 当前章节的旋转角度
  let currentAngle = baseAngle + (getChapterRotation(selectedChapter.value) * Math.PI / 180)
  
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
  const currentChapterRotation = getChapterRotation(selectedChapter.value)
  expandingRotationStartAngle.value = currentChapterRotation
  expandingRotationTargetAngle.value = currentChapterRotation + targetRotationDegrees
  expandingRotationStartTime.value = performance.now()
  
  // 9. 开始展开旋转动画
  const animateExpandingRotation = (currentTime: number) => {
    const elapsed = currentTime - expandingRotationStartTime.value
    const duration = 800 // 动画持续时间（毫秒）- 缩短展开旋转时间，为位置移动留出时间
    const progress = Math.min(elapsed / duration, 1)
    
    // 使用更平滑的缓动函数实现流畅的动画效果
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
    const easedProgress = easeOutQuart(progress)
    
    // 计算当前角度（线性插值）
    const currentAngle = expandingRotationStartAngle.value + 
      (expandingRotationTargetAngle.value - expandingRotationStartAngle.value) * easedProgress
    
    // 更新当前章节的旋转角度
    setChapterRotation(selectedChapter.value, currentAngle)
    
    // 如果动画未完成，继续下一帧
    if (progress < 1) {
      requestAnimationFrame(animateExpandingRotation)
    } else {
      // 动画完成，延迟一点时间让其他图谱开始位置移动动画
      setTimeout(() => {
        isExpandingRotation.value = false
      }, 100) // 给其他图谱的位置移动动画留出启动时间
    }
  }
  
  // 开始动画
  requestAnimationFrame(animateExpandingRotation)
}


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
  const option = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
  return option ? option.subject : '数学'
})


// 章节数据
const chapters = ref<string[]>([])
const chapterStructure = ref<ChapterNode[]>([])

// 初始化图谱数据
const initGraphData = () => {
  // 清空图谱数据
}

// 加载教材数据
const loadTextbookData = async () => {
  try {
    const versions = await apiService.getTextbookVersions()
    
    if (versions && versions.length > 0) {
      textbookOptions.value = apiService.convertToTextbookOptions(versions)
      
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
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = sortedChapterData.map(chapter => convertToChineseNumber(chapter.name))
    } else {
      chapterStructure.value = []
      chapters.value = []
    }
  } catch {
    chapterStructure.value = []
    chapters.value = []
  }
}

// 重新登录学生
const reLoginStudent = async (): Promise<boolean> => {
  try {
    // 从localStorage获取用户凭据
    const userId = localStorage.getItem('userId')
    const password = localStorage.getItem('userPassword')
    
    if (!userId || !password || userId === 'undefined' || password === 'undefined' || userId.trim() === '' || password.trim() === '') {
      return false
    }
    
    const loginResult = await apiService.loginStudent(userId, password)
    if (!loginResult) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}

// 初始化图谱
const initGraph = async () => {
  loading.value = true
  
  try {
    // 重新登录学生
    const loginSuccess = await reLoginStudent()
    if (!loginSuccess) {
      return
    }
    
    // 先加载教材数据
    await loadTextbookData()
    
    // 如果有教材数据，自动选择第一个教材并加载章节
    if (textbookOptions.value.length > 0) {
      const firstTextbook = textbookOptions.value[0]
      selectedTextbook.value = firstTextbook.value
      
      // 加载第一个教材的章节结构
      if (firstTextbook.textbookId && firstTextbook.textbookId !== 'default') {
        await loadChapterStructure(firstTextbook.textbookId)
        
        // 自动选择第一个章节
        if (chapterStructure.value.length > 0) {
          selectedChapter.value = 0
          selectedChapterDetails.value = chapterStructure.value[0]
        }
      }
    }
    
    initGraphData()
    
    // 这里可以集成真实的图谱库，如 vis.js, d3.js, cytoscape.js 等
    // 目前使用简单的DOM渲染
    await nextTick()
    renderGraph()
    
    // 自动展开第一个子章节
    if (selectedChapterDetails.value) {
      await autoExpandFirstSubChapter()
    }
    
  } catch {
    // 初始化知识图谱失败
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


// 教材切换
const onTextbookChange = async (value: string) => {
  try {
    // 如果当前有展开的知识图谱，先收缩它
    if (expandedGraphId.value !== null) {
      // 启动收缩动画
      startCollapsingAnimation()
      expandedGraphId.value = null
      // 停止展开旋转动画
      isExpandingRotation.value = false
    }
    
    // 找到选中的教材选项
    const selectedOption = textbookOptions.value.find(opt => opt.value === value)
    if (!selectedOption) {
      return
    }
    
    // 根据教材ID加载章节结构
    if (selectedOption.textbookId && selectedOption.textbookId !== 'default') {
      await loadChapterStructure(selectedOption.textbookId)
      
      // 自动选择第一个章节
      if (chapterStructure.value.length > 0) {
        selectedChapter.value = 0
        selectedChapterDetails.value = chapterStructure.value[0]
        
        // 等待DOM更新后自动展开第一个子章节
        await nextTick()
        await autoExpandFirstSubChapter()
      }
    }
    
    // 重新初始化图谱数据
    initGraphData()
    renderGraph()
    
  } catch {
    // 切换教材失败
  }
}

// 选择章节
const selectChapter = (index: number) => {
  // 如果当前有展开的知识图谱，先收缩它
  if (expandedGraphId.value !== null) {
    // 启动收缩动画
    startCollapsingAnimation()
    expandedGraphId.value = null
    // 停止展开旋转动画
    isExpandingRotation.value = false
  }
  
  selectedChapter.value = index
  
  // 确保新章节有初始旋转角度（如果不存在则初始化为0）
  if (!chapterRotationAngles.value.has(index)) {
    setChapterRotation(index, 0)
  }
  
  // 获取选中章节的详细信息
  if (chapterStructure.value && chapterStructure.value.length > index) {
    selectedChapterDetails.value = chapterStructure.value[index]
    
    // 输出新章节的角度分布
    nextTick(() => {
      logAngleDistribution()
    })
  }
}

// 启动收缩动画
const startCollapsingAnimation = () => {
  isCollapsing.value = true
  
  // 设置收缩动画持续时间（与CSS过渡时间一致）
  const collapseDuration = 800 // 800ms，与CSS中的0.8s一致
  
  // 在动画完成后重置状态
  setTimeout(() => {
    isCollapsing.value = false
  }, collapseDuration)
}

// 布局控制方法
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleChapter = () => {
  chapterCollapsed.value = !chapterCollapsed.value
}


// 处理知识图谱展开状态
const handleGraphExpand = (graphId: string) => {
  // 如果正在执行展开旋转动画或收缩动画，禁用点击切换功能
  if (isExpandingRotation.value || isCollapsing.value) {
    return
  }
  
  // 如果点击的是当前展开的图谱，则收起
  if (expandedGraphId.value === graphId) {
    // 启动收缩动画
    startCollapsingAnimation()
    expandedGraphId.value = null
    // 停止展开旋转动画
    isExpandingRotation.value = false
  } else {
    // 重置拖拽状态，确保展开时不会有滚动干扰
    resetDraggingState()
    
    // 立即设置展开状态，让膨胀动画立即开始
    expandedGraphId.value = graphId
    
    // 立即开始展开旋转动画，让其他节点立即开始旋转
    startExpandingRotation(graphId)
  }
}

// 处理背景点击事件
const handleBackgroundClick = (event: MouseEvent) => {
  // 如果当前没有展开的图谱，不需要处理
  if (expandedGraphId.value === null) {
    return
  }
  
  // 如果正在执行展开旋转动画或收缩动画，禁用背景点击收缩功能
  if (isExpandingRotation.value || isCollapsing.value) {
    return
  }
  
  // 检查点击的目标元素
  const target = event.target as HTMLElement
  
  // 如果点击的是视口裁剪区域或其子元素（背景），关闭展开状态
  if (target.closest('.viewport-clipper')) {
    // 启动收缩动画
    startCollapsingAnimation()
    expandedGraphId.value = null
  }
}

// 自动展开第一个子章节（xx.1）
const autoExpandFirstSubChapter = async () => {
  if (!selectedChapterDetails.value) return
  
  const subChapters = getSubChapters(selectedChapterDetails.value)
  if (subChapters.length > 0) {
    // 找到第一个子章节（通常是 xx.1）
    const firstSubChapter = subChapters[0]
    
    // 等待DOM更新后展开第一个子章节
    await nextTick()
    handleGraphExpand(firstSubChapter.id)
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
  const expandedIndex = expandedGraphId.value ? 
    subChapters.findIndex(chapter => chapter.id === expandedGraphId.value) : -1
  
  // 计算基础角度 - 使用当前章节的旋转角度
  const { currentAngle } = calculateCircularTrackAngle(index, total)
  const angle = currentAngle
  
  // 展开状态的位置调整逻辑
  const isRapidScrolling = isDragging.value && (Date.now() - lastRotationTime.value) < 100
  
  if (expandedGraphId.value !== null && expandedIndex !== -1 && !isDragging.value && !isRapidScrolling) {
    if (index === expandedIndex) {
      // 展开的知识图谱保持在椭圆轨迹上，移动到160度位置
      const { x, y } = calculateCircularTrackPosition(angle, 569, 400)
      return {
        transform: `translate(${x}px, ${y}px)`,
        position: 'absolute' as const,
        left: '50%',
        top: '50%',
        marginLeft: '-250px',
        marginTop: '-250px',
        opacity: 0.9, // 展开的知识图谱保持完全不透明
        zIndex: 100, // 展开的知识图谱获得最高层级
        transition: isDragging.value ? 'none' : 
                    isExpandingRotation.value ? 'none' :
                    isCollapsing.value ? 'none' :
                    'transform 1.0s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 1.0s cubic-bezier(0.4, 0.0, 0.2, 1)'
      }
    } else {
      // 其他知识图谱在轨道上平滑移动且不展开
      const { currentAngle: expandedAngle } = calculateCircularTrackAngle(expandedIndex, total)
      let angleDiff = Math.abs(angle - expandedAngle)
      
      // 处理椭圆轨迹首尾相接的边界情况（角度跨越0度/360度）
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff
      }
      
      // 定义影响范围：只影响展开图谱前后2个节点（约90度范围）
      const influenceRange = Math.PI / 2 // 90度
      const maxPushAngle = 30 // 最大推开角度30度，确保不会移出视口
      
      if (angleDiff < influenceRange) {
        // 计算距离因子：距离越近，推开角度越大
        const distanceFactor = 1 - (angleDiff / influenceRange)
        // 使用二次缓动函数实现距离越近推得越远的效果
        const pushAngle = maxPushAngle * Math.pow(distanceFactor, 2)
        
        // 判断旋转方向：上半圆顺时针，下半圆逆时针
        let rotationDirection = 1
        if (angle > Math.PI && angle <= 2 * Math.PI) {
          rotationDirection = 1  // 上半圆：顺时针
        } else {
          rotationDirection = -1 // 下半圆：逆时针
        }
        
        // 应用推开旋转，让其他节点沿轨道移动
        const adjustedAngle = angle + (rotationDirection * pushAngle * Math.PI / 180)
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
          marginLeft: '-250px',
          marginTop: '-250px',
          opacity: opacity,
          zIndex: 1 + index, // 基于索引的基础层级
          // 关键修改：确保在展开旋转完成后才开始位置移动动画
          transition: isDragging.value ? 'none' : 
            isExpandingRotation.value ? 'none' :
            isCollapsing.value ? 'none' :
            `transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${animationDelay + 0.3}s, 
             opacity 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${animationDelay + 0.3}s`
        }
      } else {
        // 距离展开图谱较远的节点，保持当前位置但变为半透明
        const { x, y } = calculateCircularTrackPosition(angle, 569, 400)
        return {
          transform: `translate(${x}px, ${y}px)`,
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          marginLeft: '-250px',
          marginTop: '-250px',
          opacity: 0.4, // 距离较远的节点也变为半透明
          zIndex: 1 + index, // 基于索引的基础层级
          transition: isDragging.value ? 'none' : 
            isExpandingRotation.value ? 'none' :
            isCollapsing.value ? 'none' :
            `opacity 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s`
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
    marginLeft: '-250px',
    marginTop: '-250px',
    opacity: 0.8, // 确保默认状态下完全可见
    zIndex: 1 + index, // 基于索引的基础层级
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
  initGraph()
  initCSSAnimations()
  
  // 输出角度分布总览
  nextTick(() => {
    logAngleDistribution()
  })
  
  // 添加全局鼠标事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  // 更新屏幕高度
  const updateScreenHeight = () => {
    screenHeight.value = window.innerHeight
  }
  
  window.addEventListener('resize', updateScreenHeight)
  
  // 清理函数
  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('resize', updateScreenHeight)
  })
})


onUnmounted(() => {
  cleanupAnimations()
})
</script>

<style lang="scss" scoped>
.knowledge-graph-layout {
  display: flex;
  height: 100vh;
  background: url('/icons/background.svg') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
}

// 第一列：功能箱/侧边栏（最左侧）
.function-sidebar {
  width: 60px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  border-right: 1px solid rgba(229, 231, 235, 0.3);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  
  &.collapsed {
    width: 60px;
  }
  
  &:not(.collapsed) {
    width: 200px;
  }
}

.sidebar-toggle {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
}

.function-menu {
  flex: 1;
  padding: 16px 0;
  
  .nav-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      
      .nav-text {
        color: white;
      }
    }
    
    &:hover:not(.active) {
      background: #f3f4f6;
    }
    
    .nav-text {
      margin-left: 12px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }
  }
}

// 第二列：章节目录/内容导航（中间）
.chapter-sidebar {
  width: 280px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  border-right: 1px solid rgba(229, 231, 235, 0.3);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  
  &.collapsed {
    width: 50px;
  }
}

.chapter-toggle {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.subject-info {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.subject-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  
  .subject-text {
    font-size: 16px;
    font-weight: 500;
    color: #374151;
  }
}

.textbook-info {
  .textbook-select {
    width: 100%;
    
    .q-field__control {
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: white;
      
      &:hover {
        background: #f9fafb;
      }
    }
    
    .q-field__native {
      padding: 8px 12px;
    }
  }
  
  .textbook-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  
  .textbook-text {
    font-size: 14px;
    color: #374151;
    font-weight: 500;
  }
}


.chapter-list {
  flex: 1;
  padding: 16px 0;
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
    padding: 12px 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      
      .chapter-text {
        color: white;
      }
    }
    
    &:hover:not(.active) {
      background: #f3f4f6;
    }
    
    .chapter-text {
      font-size: 14px;
      color: #374151;
    }
    
    .chapter-progress {
      margin-top: 8px;
      
      .progress-bar {
        height: 2px;
        border-radius: 1px;
      }
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

// 知识图谱位置容器
.graph-position {
  position: absolute;
  width: 500px;
  height: 500px;
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
      width: 24px;
      height: 24px;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }
    
    .status-label {
      font-size: 12px;
      color: #FFFFFF;
      font-weight: 500;
    }
    
    &:hover {
      .status-icon {
        opacity: 1;
      }
      
      .status-label {
        color: #374151;
      }
    }
  }
}



// 响应式设计
@media (max-width: 768px) {
  .function-sidebar {
    width: 240px;
  }
  
  .chapter-sidebar {
    width: 240px;
  }
}
</style>
