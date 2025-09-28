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
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
        >
          <!-- 圆形轨迹指示器 -->
          <div class="circular-track"></div>
          <!-- 圆形布局容器 -->
          <div 
            class="circular-layout" 
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

// 触摸事件处理函数
const handleTouchStart = (event: TouchEvent) => {
  console.log('触摸开始')
  if (!circularLayoutRef.value) return
  
  isDragging.value = true
  startY.value = event.touches[0].clientY
  lastY.value = event.touches[0].clientY
  
  // 阻止默认滚动行为
  
}

const handleTouchMove = (event: TouchEvent) => {
  console.log('触摸移动')
  if (!isDragging.value || !circularLayoutRef.value) return
  
  const currentY = event.touches[0].clientY
  const deltaY = currentY - lastY.value
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 360度
  const rotationDelta = (deltaY / screenHeight.value) * 360
  
  // 更新旋转角度（向上滑动为正，向下滑动为负）
  rotationAngle.value -= rotationDelta
  
  // 更新上次位置
  lastY.value = currentY
  
  // 应用旋转
  applyRotation()
  
  // 阻止默认滚动行为
  
}

const handleTouchEnd = () => {
  console.log('触摸结束')
  isDragging.value = false
  // 松手后保持最终角度，无回弹
}

// 鼠标事件处理函数（可选功能）
const handleMouseDown = (event: MouseEvent) => {
  console.log('鼠标按下')
  if (!circularLayoutRef.value) return
  
  isDragging.value = true
  startY.value = event.clientY
  lastY.value = event.clientY
  
  // 阻止默认行为
  
}

const handleMouseMove = (event: MouseEvent) => {
  console.log('鼠标移动')
  if (!isDragging.value || !circularLayoutRef.value) return
  
  const currentY = event.clientY
  const deltaY = currentY - lastY.value
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 360度
  const rotationDelta = (deltaY / screenHeight.value) * 360
  
  // 更新旋转角度（向上滑动为正，向下滑动为负）
  rotationAngle.value -= rotationDelta
  
  // 更新上次位置
  lastY.value = currentY
  
  // 应用旋转
  applyRotation()
  
  // 阻止默认行为
  
}

const handleMouseUp = () => {
  console.log('鼠标抬起')
  isDragging.value = false
}

// 应用旋转变换
const applyRotation = () => {
  console.log('应用旋转变换')
  if (!circularLayoutRef.value) return
  
  circularLayoutRef.value.style.transform = `rotate(${rotationAngle.value}deg)`
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

// 获取子章节（x.x格式的小节）
const getSubChapters = (chapterDetails: ChapterNode | null) => {
  if (!chapterDetails || !chapterDetails.children) {
    return []
  }
  
  // 过滤出level=1的子章节（x.x格式）
  return chapterDetails.children.filter(child => child.level === 1)
}

// 计算知识图谱在圆周上的位置
const getGraphPosition = (index: number, total: number) => {
  const angle = (2 * Math.PI * index) / total
  const radius = 400 // 大圆半径
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    marginLeft: '-250px', // 知识图谱宽度的一半
    marginTop: '-250px'   // 知识图谱高度的一半
  }
}

// 计算知识图谱的旋转角度
const getGraphRotation = (index: number) => {
  const total = getSubChapters(selectedChapterDetails.value).length
  const angle = (2 * Math.PI * index) / total
  return angle * (180 / Math.PI) // 转换为度数
}




// 组件挂载时初始化
onMounted(() => {
  initGraph()
  initGSAPAnimations()
  
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
  z-index: 1;
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
