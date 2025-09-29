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
        <div class="nav-item">
          <q-icon name="school" size="24px" color="grey-6" />
          <span class="nav-text">学习进度</span>
        </div>
        <div class="nav-item">
          <q-icon name="analytics" size="24px" color="grey-6" />
          <span class="nav-text">数据分析</span>
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
          popup-content-class="textbook-popup"
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
      <!-- 筛选器 -->
      <div class="filter-section">
        <div class="filter-tags">
          <q-chip 
            v-for="status in learningStatuses" 
            :key="status.value"
            :color="status.color"
            :text-color="status.textColor"
            :outline="selectedStatus !== status.value"
            clickable
            @click="selectStatus(status.value)"
            class="status-chip"
          >
            {{ status.label }}
          </q-chip>
        </div>
      </div>

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
          <!-- 圆形轨迹指示器 -->
          <div class="circular-track"></div>
          <!-- 圆形布局容器 -->
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
                @expand="handleGraphExpand(subChapter.id)"
                class="knowledge-graph-wrapper"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, onUnmounted } from 'vue'
import { apiService } from '../services/api-service'
import type { TextbookVersion, TextbookOption, ChapterNode } from '../types'
import { gsap } from 'gsap'
import KnowledgeGraph from '../components/knowledge-graph/KnowledgeGraph.vue'

// 响应式数据
const loading = ref(true)
const selectedChapter = ref(0)
const selectedChapterDetails = ref<ChapterNode | null>(null)

// 布局控制
const sidebarCollapsed = ref(false)
const chapterCollapsed = ref(false)

// GSAP动画相关
const tl = ref<gsap.core.Timeline | null>(null)
const selectedStatus = ref('all')

// 圆形布局相关
const circularContainerRef = ref<HTMLElement>()
const circularLayoutRef = ref<HTMLElement>()

// 旋转控制相关
const rotationAngle = ref(0) // 当前旋转角度（度）
const isDragging = ref(false) // 是否正在拖拽
const startY = ref(0) // 开始触摸的Y坐标
const lastY = ref(0) // 上次触摸的Y坐标
const screenHeight = ref(window.innerHeight) // 屏幕高度
const lastRotationTime = ref(0) // 上次旋转时间戳，用于检测快速滑动

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
  const rotationDelta = (deltaY / screenHeight.value) * 360
  
  // 更新旋转角度（向上滑动为正，向下滑动为负）
  rotationAngle.value -= rotationDelta
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
  
  // 应用旋转
  applyRotation()
  
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
  
  // 更新旋转角度（向上滑动为正，向下滑动为负）
  rotationAngle.value -= rotationDelta
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
  
  // 应用旋转
  applyRotation()
  
  // 阻止默认行为
  
}

const handleMouseUp = () => {
  isDragging.value = false
}

// 应用旋转变换
const applyRotation = () => {
  if (!circularLayoutRef.value) {
    console.log(`❌ applyRotation: 圆形布局引用不存在`)
    return
  }
  
  circularLayoutRef.value.style.transform = `rotate(${rotationAngle.value}deg)`
}

// 圆形轨迹指示器坐标系 - 统一的角度计算函数
const calculateCircularTrackAngle = (index: number, total: number) => {
  // 基础角度：第一节在圆形轨迹指示器左侧位置（180度），逆时针排列
  // 从左侧（π）开始，逆时针（正角度）排列
  let baseAngle = Math.PI + (2 * Math.PI * index) / total
  // 当前角度：基础角度 + 容器旋转角度
  let currentAngle = baseAngle + (rotationAngle.value * Math.PI / 180)
  
  // 将角度标准化到 [0, 2π] 范围
  while (baseAngle >= 2 * Math.PI) baseAngle -= 2 * Math.PI
  while (baseAngle < 0) baseAngle += 2 * Math.PI
  while (currentAngle >= 2 * Math.PI) currentAngle -= 2 * Math.PI
  while (currentAngle < 0) currentAngle += 2 * Math.PI
  
  return { baseAngle, currentAngle }
}

// 圆形轨迹指示器坐标系 - 统一的位置计算函数
const calculateCircularTrackPosition = (angle: number, radius: number = 400) => {
  // 使用圆形轨迹指示器的坐标系：0度为正右方，逆时针为正
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  return { x, y }
}

// 自动转动指定知识图谱到圆形轨迹指示器的左侧定点位置
// 新逻辑：将目标知识图谱旋转到左侧位置（180度），保持其他知识图谱的相对位置
const rotateToLeftPosition = (graphId: string) => {
  console.log("🎯 rotateToLeftPosition - 将知识图谱旋转到左侧位置", graphId)
  
  // 1. 检查章节详情是否存在
  if (!selectedChapterDetails.value) return
  
  // 2. 获取子章节列表并查找目标图谱索引
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const targetIndex = subChapters.findIndex(chapter => chapter.id === graphId)
  
  // 3. 验证目标图谱是否存在
  if (targetIndex === -1) {
    console.log(`❌ 未找到目标知识图谱: ${graphId}`)
    return
  }
  
  // 4. 使用圆形轨迹指示器坐标系计算目标图谱的基础角度
  const total = subChapters.length
  const { baseAngle } = calculateCircularTrackAngle(targetIndex, total)
  
  // 5. 定义圆形轨迹指示器左侧定点位置角度（π，即正左方）
  const circularTrackLeftAngle = Math.PI
  
  // 6. 计算需要旋转的角度差值
  // 目标：让目标知识图谱的基础角度 + 容器旋转角度 = 左侧位置角度
  // 即：baseAngle + currentRotation + targetRotation = circularTrackLeftAngle
  // 所以：targetRotation = circularTrackLeftAngle - baseAngle - currentRotation
  let targetRotation = circularTrackLeftAngle - baseAngle
  
  // 7. 标准化角度到 [-π, π] 范围，选择最短路径
  while (targetRotation > Math.PI) targetRotation -= 2 * Math.PI
  while (targetRotation < -Math.PI) targetRotation += 2 * Math.PI
  
  console.log(`🎯 圆形轨迹指示器坐标系旋转计算:`, {
    targetIndex,
    targetGraphName: subChapters[targetIndex]?.name || '未知',
    baseAngle: `${(baseAngle * 180 / Math.PI).toFixed(2)}°`,
    currentRotationAngle: `${rotationAngle.value.toFixed(2)}°`,
    targetRotation: `${(targetRotation * 180 / Math.PI).toFixed(2)}°`,
    direction: targetRotation > 0 ? '逆时针' : '顺时针',
    finalPosition: '左侧位置 (180°)'
  })
  
  // 8. 将弧度转换为度数
  const targetRotationDegrees = (targetRotation * 180) / Math.PI
  
  console.log(`🎬 动画参数:`, {
    currentRotationAngle: `${rotationAngle.value.toFixed(2)}°`,
    targetRotationDegrees: `${targetRotationDegrees.toFixed(2)}°`,
    finalRotationAngle: `${(rotationAngle.value + targetRotationDegrees).toFixed(2)}°`,
    duration: '0.8s',
    ease: 'power2.out'
  })
  
  // 9. 使用GSAP执行平滑旋转动画
  if (circularLayoutRef.value) {
    gsap.to(rotationAngle, {
      value: rotationAngle.value + targetRotationDegrees,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        applyRotation()
      },
      onComplete: () => {
        console.log(`✅ 知识图谱 "${subChapters[targetIndex]?.name}" 已旋转到左侧位置`)
      }
    })
  } else {
    console.log(`❌ 圆形布局引用不存在，无法执行旋转动画`)
  }
}

// 开发环境检测

// 教材选择器
const selectedTextbook = ref('')
const textbookOptions = ref<TextbookOption[]>([])
const textbookVersions = ref<TextbookVersion[]>([])

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

// 学习状态选项
const learningStatuses = ref([
  { value: 'all', label: '全部', color: 'grey-5', textColor: 'white' },
  { value: 'not-learned', label: '未学习', color: 'red-4', textColor: 'white' },
  { value: 'learning', label: '正在学', color: 'orange-4', textColor: 'white' },
  { value: 'learned', label: '已学习', color: 'green-4', textColor: 'white' }
])

// 章节数据
const chapters = ref<string[]>([])
const chapterStructure = ref<ChapterNode[]>([])

// 周围节点数据已移除

// 图谱数据
const nodes = ref<Record<string, unknown>[]>([])
const edges = ref<Record<string, unknown>[]>([])


// 初始化图谱数据
const initGraphData = () => {
  // 清空图谱数据
  nodes.value = []
  edges.value = []
}

// 获取节点颜色方法已移除

// 加载教材数据
const loadTextbookData = async () => {
  try {
    const versions = await apiService.getTextbookVersions()
    
    if (versions && versions.length > 0) {
      console.log('教材版本:', versions)
      textbookVersions.value = versions
      textbookOptions.value = apiService.convertToTextbookOptions(versions)
      
      // 设置默认选中的教材
      if (textbookOptions.value.length > 0) {
        console.log('教材选项:', textbookOptions.value)
        selectedTextbook.value = textbookOptions.value[0].value
        
        // 加载默认教材的章节结构
        const defaultOption = textbookOptions.value[0]
        if (defaultOption.textbookId) {
          console.log('加载默认教材的章节结构:', defaultOption.textbookId)
          await loadChapterStructure(defaultOption.textbookId)
        }
      }
    } else {
      textbookVersions.value = []
      textbookOptions.value = []
    }
    
  } catch (error) {
    console.error('❌ 加载教材数据失败:', error)
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
    console.log('章节结构数据:', chapterData)
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
      console.log('章节结构数据为空')
      chapterStructure.value = []
      chapters.value = []
    }
  } catch (error) {
    console.error('❌ 加载章节结构失败:', error)
    chapterStructure.value = []
    chapters.value = []
  }
}

// 重新登录学生
const reLoginStudent = async (): Promise<boolean> => {
  try {
    console.log('🔐 重新登录学生...')
    
    // 从localStorage获取用户凭据
    const userId = localStorage.getItem('userId')
    const password = localStorage.getItem('userPassword')
    
    if (!userId || !password || userId === 'undefined' || password === 'undefined' || userId.trim() === '' || password.trim() === '') {
      console.warn('无法获取用户凭据，请先进行主应用登录')
      return false
    }
    
    const loginResult = await apiService.loginStudent(userId, password)
    if (!loginResult) {
      console.error('学生自动登录失败')
      return false
    }
    
    console.log('✅ 学生登录成功')
    return true
  } catch (error) {
    console.error('重新登录学生时发生错误:', error)
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
    
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    initGraphData()
    
    // 这里可以集成真实的图谱库，如 vis.js, d3.js, cytoscape.js 等
    // 目前使用简单的DOM渲染
    await nextTick()
    renderGraph()
    
  } catch (error) {
    console.error('初始化知识图谱失败:', error)
  } finally {
    loading.value = false
  }
}

// GSAP动画方法
const initGSAPAnimations = () => {
  // 设置GSAP默认配置
  gsap.defaults({
    duration: 0.6,
    ease: "power2.out"
  })
  
  // 注册GSAP插件（如果需要）
  gsap.registerPlugin()
  
  // 设置性能优化
  gsap.config({
    nullTargetWarn: false
  })
}

// 单个节点进入动画（备用方法）
// const animateNodeEnter = (element: HTMLElement, delay: number = 0) => {
//   gsap.fromTo(element, 
//     {
//       scale: 0,
//       opacity: 0,
//       rotation: -180
//     },
//     {
//       scale: 1,
//       opacity: 1,
//       rotation: 0,
//       duration: 0.8,
//       delay: delay,
//       ease: "back.out(1.7)"
//     }
//   )
// }



const cleanupAnimations = () => {
  if (tl.value) {
    tl.value.kill()
    tl.value = null
  }
  gsap.killTweensOf("*")
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
  console.log('切换教材:', value)
  
  try {
    // 找到选中的教材选项
    const selectedOption = textbookOptions.value.find(opt => opt.value === value)
    if (!selectedOption) {
      console.warn('未找到选中的教材选项')
      return
    }
    
    console.log('选中的教材信息:', selectedOption)
    
    // 根据教材ID加载章节结构
    if (selectedOption.textbookId && selectedOption.textbookId !== 'default') {
      await loadChapterStructure(selectedOption.textbookId)
    }
    
    // 重新初始化图谱数据
    initGraphData()
    renderGraph()
    
  } catch (error) {
    console.error('切换教材失败:', error)
  }
}

// 选择章节
const selectChapter = (index: number) => {
  selectedChapter.value = index
  // 获取选中章节的详细信息
  if (chapterStructure.value && chapterStructure.value.length > index) {
    selectedChapterDetails.value = chapterStructure.value[index]
    console.log('选择章节:', chapters.value[index])
    console.log('章节详情:', selectedChapterDetails.value)
    
    // 🔍 输出新章节的角度分布
    nextTick(() => {
      console.log(`🔄 切换到新章节: ${selectedChapterDetails.value?.name || '未知章节'}`)
      logAngleDistribution()
    })
  }
}

// 布局控制方法
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleChapter = () => {
  chapterCollapsed.value = !chapterCollapsed.value
}

// 选择学习状态
const selectStatus = (status: string) => {
  selectedStatus.value = status
  // 这里可以根据状态筛选节点
  filterNodesByStatus(status)
}

// 根据状态筛选节点
const filterNodesByStatus = (status: string) => {
  console.log('筛选功能暂未实现:', status)
}

// 处理知识图谱展开状态
const handleGraphExpand = (graphId: string) => {
  // 如果点击的是当前展开的图谱，则收起
  if (expandedGraphId.value === graphId) {
    expandedGraphId.value = null
  } else {
    // 否则展开新的图谱（自动收起其他图谱）
    expandedGraphId.value = graphId
    // 重置拖拽状态，确保展开时不会有滚动干扰
    resetDraggingState()
    
    // 自动转动到左侧定点位置
    rotateToLeftPosition(graphId)
  }
}

// 处理背景点击事件
const handleBackgroundClick = (event: MouseEvent) => {
  console.log('handleBackgroundClick', expandedGraphId.value)
  // 如果当前没有展开的图谱，不需要处理
  if (expandedGraphId.value === null) {
    return
  }
  
  // 检查点击的目标元素
  const target = event.target as HTMLElement
  
  // 如果点击的是视口裁剪区域或其子元素（背景），关闭展开状态
  if (target.closest('.viewport-clipper')) {
    expandedGraphId.value = null
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

// 计算知识图谱在圆形轨迹指示器中的位置（统一坐标系）
const getGraphPosition = (index: number, total: number) => {
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const expandedIndex = expandedGraphId.value ? 
    subChapters.findIndex(chapter => chapter.id === expandedGraphId.value) : -1
  
  // 使用统一的圆形轨迹指示器坐标系计算角度
  const { currentAngle } = calculateCircularTrackAngle(index, total)
  console.log('currentAngle', currentAngle)
  const angle = currentAngle
  
  let radius = 400 // 默认大圆半径（与圆形轨迹指示器一致）
  
  // 如果有知识图谱展开，调整其他知识图谱的位置
  // 添加更严格的条件：只有在非拖拽状态下且非快速滑动时才进行位置调整
  const isRapidScrolling = isDragging.value && (Date.now() - lastRotationTime.value) < 100
  if (expandedGraphId.value !== null && expandedIndex !== -1 && !isDragging.value && !isRapidScrolling) {
    // 如果当前知识图谱就是展开的，保持在原位置
    if (index === expandedIndex) {
      radius = 400 // 展开的知识图谱保持在圆形轨迹指示器上
    } else {
      // 使用统一的圆形轨迹指示器坐标系计算展开知识图谱的角度
      const { currentAngle: expandedAngle } = calculateCircularTrackAngle(expandedIndex, total)
      
      // 计算当前知识图谱与展开知识图谱的角度差
      let angleDiff = Math.abs(angle - expandedAngle)
      // 处理跨越0度的情况
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff
      }
      
      // 如果角度差小于150度（5π/6），则让其他知识图谱沿切线向右侧移动
      if (angleDiff < (5 * Math.PI) / 6) {
        // 计算切线移动的距离：角度差越小，移动距离越大
        // 使用更大的移动距离确保能够移出视口
        const tangentDistance = ((5 * Math.PI) / 6 - angleDiff) / ((5 * Math.PI) / 6) * 1200 // 最大移动1200px
        
        // 根据角度范围计算切线方向
        // 上半圆（π 到 2π）：向右上移动
        // 下半圆（0 到 π）：向右下移动
        
        let tangentX, tangentY
        let circleRegion = ''
        
        if (angle > Math.PI && angle <= 2 * Math.PI) {
          // 上半圆：切线方向向右上
          circleRegion = '上半圆'
          // 切线方向 = 半径方向 - 90度
          const tangentAngle = angle + Math.PI / 2
          tangentX = Math.cos(tangentAngle) * tangentDistance
          tangentY = Math.sin(tangentAngle) * tangentDistance
        } else {
          // 下半圆：切线方向向右下
          circleRegion = '下半圆'
          // 切线方向 = 半径方向 + 90度
          const tangentAngle = angle - Math.PI / 2
          tangentX = Math.cos(tangentAngle) * tangentDistance
          tangentY = Math.sin(tangentAngle) * tangentDistance
        }
        
        // 输出角度和区域信息
        const angleDegrees = (angle * 180 / Math.PI).toFixed(2)
        console.log(`🎯 知识图谱${index + 1} "${subChapters[index]?.name || '未知'}" 角度分析:`, {
          angle: `${angleDegrees}°`,
          region: circleRegion,
          tangentDirection: circleRegion === '上半圆' ? '右上' : '右下',
          tangentDistance: `${tangentDistance.toFixed(2)}px`
        })
        
        // 使用统一的圆形轨迹指示器坐标系计算原始位置
        const { x: originalX, y: originalY } = calculateCircularTrackPosition(angle, radius)
        
        // 计算最终位置
        const finalX = originalX + tangentX
        const finalY = originalY + tangentY
        
        // 检查是否移出视口（视口中心为(0,0)，半径约为400px）
        const distanceFromCenter = Math.sqrt(finalX * finalX + finalY * finalY)
        const isOutOfViewport = distanceFromCenter > 600 // 600px为视口边界
        
        // 计算动画延迟：距离展开图谱越近，延迟越短
        const animationDelay = (angleDiff / ((5 * Math.PI) / 6)) * 0.3 // 最大延迟0.3秒
        
        // 返回切线移动后的位置
        return {
          transform: `translate(${finalX}px, ${finalY}px)`,
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          marginLeft: '-250px', // 知识图谱宽度的一半
          marginTop: '-250px',   // 知识图谱高度的一半
          // 如果移出视口，添加透明度动画
          opacity: isOutOfViewport ? 0 : 1,
          // 只有在非拖拽状态下才应用过渡动画，避免快速滑动时的视觉干扰
          transition: isDragging.value ? 'none' : `transform 1.0s cubic-bezier(0.4, 0.0, 0.2, 1) ${animationDelay}s, opacity 1.0s cubic-bezier(0.4, 0.0, 0.2, 1) ${animationDelay}s`
        }
      }
    }
  }
  
  // 使用统一的圆形轨迹指示器坐标系计算位置
  const { x, y } = calculateCircularTrackPosition(angle, radius)
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    marginLeft: '-250px', // 知识图谱宽度的一半
    marginTop: '-250px',   // 知识图谱高度的一半
    // 只有在非拖拽状态下才应用过渡动画，避免快速滑动时的视觉干扰
    transition: isDragging.value ? 'none' : 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)'
  }
}

// 计算知识图谱的旋转角度（圆形轨迹指示器坐标系 - 保持水平，不旋转内容）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getGraphRotation = (_index: number) => {
  // 在圆形轨迹指示器坐标系中，知识图谱内容保持水平，不进行旋转
  // 只有位置会随容器旋转而改变，内容本身保持水平状态
  return 0
}

// 🔍 圆形轨迹指示器坐标系角度分布总览日志函数
const logAngleDistribution = () => {
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const total = subChapters.length
  
  console.log('🎯 圆形轨迹指示器坐标系角度分布总览')
  console.log('═'.repeat(60))
  console.log(`📊 总知识图谱数量: ${total}`)
  console.log(`📐 起始位置: 正左方 (180°) - 第一节`)
  console.log(`🔄 排列方向: 逆时针`)
  console.log(`🔄 容器旋转角度: ${rotationAngle.value.toFixed(2)}°`)
  console.log(`🎯 圆形轨迹指示器半径: 400px`)
  console.log('─'.repeat(60))
  
  for (let i = 0; i < total; i++) {
    // 使用统一的圆形轨迹指示器坐标系计算角度
    const { baseAngle, currentAngle } = calculateCircularTrackAngle(i, total)
    const baseDegrees = baseAngle * 180 / Math.PI
    const currentDegrees = currentAngle * 180 / Math.PI
    
    // 使用统一的圆形轨迹指示器坐标系计算位置
    const { x, y } = calculateCircularTrackPosition(currentAngle, 400)
    
    let direction = ''
    let circleRegion = ''
    
    if (Math.abs(currentDegrees) < 5 || Math.abs(currentDegrees - 360) < 5) {
      direction = '正右方'
      circleRegion = '边界点'
    } else if (Math.abs(currentDegrees - 90) < 5) {
      direction = '正下方'
      circleRegion = '下半圆'
    } else if (Math.abs(currentDegrees - 180) < 5) {
      direction = '正左方 (起始位置)'
      circleRegion = '边界点'
    } else if (Math.abs(currentDegrees - 270) < 5) {
      direction = '正上方'
      circleRegion = '上半圆'
    } else if (currentDegrees > 0 && currentDegrees < 90) {
      direction = '右下方'
      circleRegion = '下半圆'
    } else if (currentDegrees > 90 && currentDegrees < 180) {
      direction = '左下方'
      circleRegion = '下半圆'
    } else if (currentDegrees > 180 && currentDegrees < 270) {
      direction = '左上方'
      circleRegion = '上半圆'
    } else if (currentDegrees > 270 && currentDegrees < 360) {
      direction = '右上方'
      circleRegion = '上半圆'
    }
    
    console.log(`📌 图谱${i + 1}: 基础角度 ${baseDegrees.toFixed(2)}° → 当前角度 ${currentDegrees.toFixed(2)}° (${direction}) [${circleRegion}]`)
    console.log(`   中心节点: "${subChapters[i].name}"`)
    console.log(`   坐标: (${x.toFixed(2)}, ${y.toFixed(2)})`)
  }
  
  console.log('═'.repeat(60))
}




// 组件挂载时初始化
onMounted(() => {
  initGraph()
  initGSAPAnimations()
  
  // 🔍 输出角度分布总览
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
  background: linear-gradient(135deg, #f8f7ff 0%, #ffffff 100%);
}

// 第一列：功能箱/侧边栏（最左侧）
.function-sidebar {
  width: 60px;
  background: white;
  border-right: 1px solid #e5e7eb;
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
  background: white;
  border-right: 1px solid #e5e7eb;
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

// 教材选择器弹出样式
:deep(.textbook-popup) {
  .q-menu {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .q-item {
    padding: 12px 16px;
    font-size: 14px;
    color: #374151;
    
    &:hover {
      background: #f3f4f6;
    }
    
    &.q-item--active {
      background: #eff6ff;
      color: #2563eb;
    }
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
  background: linear-gradient(135deg, #f8f7ff 0%, #ffffff 100%);
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
  
  // 当有图谱展开时，提供视觉反馈
  &.has-expanded {
    cursor: pointer;
    
    // 添加一个微妙的背景提示
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(139, 92, 246, 0.02);
      pointer-events: none;
      transition: background-color 0.2s ease;
    }
    
    &:hover::before {
      background: rgba(139, 92, 246, 0.05);
    }
  }
}

// 圆形轨迹指示器
.circular-track {
  position: absolute;
  width: 800px;
  height: 800px;
  left: 100%;
  top: 50%;
  margin-left: -400px;
  margin-top: -400px;
  border: 2px dashed rgba(139, 92, 246, 0.3);
  border-radius: 50%;
}


// 圆形布局容器
.circular-layout {
  position: relative;
  width: 1000px;
  height: 1000px;
  left: 100%;
  top: 50%;
  transform-origin: center center;
  margin-left: -500px;
  margin-top: -500px;
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

// 知识图谱包装器（SVG方法：内容保持水平）
.knowledge-graph-wrapper {
  width: 100%;
  height: 100%;
  transform-origin: center center;
  // 确保内容不随容器旋转而旋转
  transform: none !important;
}



.filter-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  
  .filter-tags {
    display: flex;
    gap: 8px;
    
    .status-chip {
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
