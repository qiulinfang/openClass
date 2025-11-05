<template>
  <div class="knowledge-graph-content" :style="{ backgroundImage: `url(${backgroundImage})` }">
    <!-- 第二列：章节目录/内容导航（中间） -->
    <div class="chapter-sidebar">
      <!-- 科目和版本信息 -->
      <div class="subject-header">
        <img :src="bookIcon" class="subject-icon" />
        <q-select
          v-model="selectedSubject"
          :options="subjectOptions"
          option-value="value"
          option-label="label"
          behavior="menu"
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
      <!-- 教材选择器 -->
      <div class="textbook-info">
        <q-select
          v-model="selectedTextbook"
          :options="textbookOptions"
          option-value="value"
          option-label="label"
          behavior="menu"
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

      <!-- 第1步：添加节点搜索框 -->
      <div v-show="showNodeSearch" class="chapter-search">
        <q-input
          v-model="searchQuery"
          outlined
          dense
          placeholder="搜索节点..."
          class="search-input"
          @update:model-value="handleSearchInput"
        >
          <template v-slot:prepend>
            <q-icon name="search" color="white" />
          </template>
          <template v-slot:append v-if="searchQuery">
            <q-icon 
              name="close" 
              color="white" 
              class="cursor-pointer touch-target" 
              @click="clearSearch" 
            />
          </template>
        </q-input>
      </div>

      <!-- 章节目录列表 / 搜索结果列表 -->
      <div ref="chapterListWrapper" class="scroll-wrapper chapter-list">
        <div class="scroll-content">
        <!-- 显示搜索结果 -->
        <template v-if="searchQuery && searchResults.length > 0">
          <div 
            v-for="result in searchResults" 
            :key="`${result.chapterIndex}-${result.node.id}`"
            class="chapter-item touch-target search-result-item"
            @click="handleSearchResultClick(result)"
          >
            <div class="search-result-content">
              <div class="search-result-node" v-html="highlightText(result.node.name || result.node.label)"></div>
              <div class="search-result-chapter">{{ result.chapterName }}</div>
            </div>
          </div>
        </template>
        <!-- 显示无搜索结果提示 -->
        <div v-else-if="searchQuery && searchResults.length === 0" class="empty-chapters">
          <q-icon name="search_off" size="32px" color="grey-4" />
          <div class="empty-text">未找到匹配的节点</div>
        </div>
        <!-- 显示章节列表 -->
        <template v-else-if="!searchQuery">
          <div v-if="filteredChapters.length === 0" class="empty-chapters">
            <q-icon name="menu_book" size="32px" color="grey-4" />
            <div class="empty-text">暂无章节数据</div>
          </div>
          <div 
            v-else
            v-for="item in filteredChapters" 
            :key="item.index"
            class="chapter-item touch-target"
            :class="{ active: item.index === getCurrentChapter() }"
            @click="selectChapter(item.index)"
          >
            <span class="chapter-text" v-html="highlightText(item.chapter)"></span>
          </div>
        </template>
        </div>
      </div>
    </div>

    <!-- 第三列：核心内容/知识图谱（最右侧） -->
    <div class="main-content">
      <!-- 右上角工具栏 -->
      <div class="top-right-toolbar">
        <q-btn
          flat
          round
          dense
          class="toolbar-icon-btn"
          @click="toggleNodeSearch"
        >
          <img :src="chapterSearchIcon" alt="搜索节点" class="toolbar-icon" />
          <q-tooltip>搜索节点</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          class="toolbar-icon-btn"
          @click="handlePhotoSearch"
        >
          <img :src="photoSearchIcon" alt="拍照搜题" class="toolbar-icon" />
          <q-tooltip>拍照搜题</q-tooltip>
        </q-btn>
      </div>

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
              ref="indicatorContainerRef"
              @click.stop
              @touchstart="handleIndicatorTouchStart"
              @touchmove="handleIndicatorTouchMove"
              @touchend="handleIndicatorTouchEnd"
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
                  :src="indicatorIcon" 
                  alt="Indicator" 
                  class="indicator-icon"
                />
              </div>
            </div>
            <div 
              v-for="(subChapter, index) in getSubChapters(selectedChapterDetails)" 
              :key="subChapter.id"
              class="graph-position"
              :style="{
                ...getGraphPosition(index, getSubChapters(selectedChapterDetails).length),
                width: `${debugParams.graphSize}px`,
                height: `${debugParams.graphSize}px`
              }"
            >
              <!-- 知识图谱 -->
              <KnowledgeGraph
                :chapter-details="subChapter"
                :graph-index="index"
                :rotation="getGraphRotation(index)"
                :is-expanded="getCurrentChapterExpandedGraph() === subChapter.id"
                :has-expanded-graph="getCurrentChapterExpandedGraph() !== null"
                :rotation-direction="rotationDirection"
                :textbook-record-id="getCurrentTextbookId()"
                :textbook-id="getTextbookIdForKnowledgeGraph()"
                :subject="currentSubjectLabel"
                @expand="handleGraphExpand(subChapter.id)"
                @learn="handleLearnDialog"
                @save-state="saveCurrentPageState"
                class="knowledge-graph-wrapper"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态标识 - 只在选择了章节时显示 -->
      <div v-if="selectedChapterDetails" class="status-indicators">
        <div class="status-item">
          <img :src="notLearnedStarIcon" alt="未学习" class="status-icon" />
          <span class="status-label">未学习</span>
        </div>
        <div class="status-item">
          <img :src="learnedStarIcon" alt="已学习" class="status-icon" />
          <span class="status-label">已学习</span>
        </div>
        <div class="status-item">
          <img :src="lastLearnedStarIcon" alt="上次学到" class="status-icon" />
          <span class="status-label">上次学到</span>
        </div>
      </div>
    </div>

    <!-- 学习对话框 -->
    <LearningView 
      v-if="learningDialogData"
      v-model="learningDialogVisible"
      :key="`${learningDialogData.nodeId}-${learningDialogData.textbookId}`"
      :node-id="learningDialogData.nodeId"
      :section-name="learningDialogData.sectionName"
      :level="learningDialogData.level"
      :textbook-id="learningDialogData.textbookId"
      @update:model-value="handleLearningDialogClose"
    />

    <!-- 调试面板 - 只在开发场景下显示 -->
    <KnowledgeGraphDebugPanel
      v-if="isDev"
      v-model="debugPanelVisible"
      :params="debugParams"
      :default-params="defaultDebugParams"
      :current-chapter="selectedChapterDetails"
      @update:params="handleDebugParamsUpdate"
      @update:nodes="handleNodeUpdate"
    />

    <!-- 学习状态控制面板 - 只在开发场景下显示 -->
    <LearningStatusControlPanel
      v-if="isDev"
      v-model="learningStatusPanelVisible"
      :chapter-structure="chapterStructure"
      @refresh="handleLearningStatusRefresh"
    />

    <!-- PhotoSearchDialog 组件 -->
    <PhotoSearchDialog
      v-model="showPhotoSearchDialog"
      :subject="currentSubjectForPhotoSearch"
      @retake="handlePhotoSearchRetake"
      @question-selected="handlePhotoSearchQuestionSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, onUnmounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { apiService } from '../services/api-service'
import { resourceManager } from '../services/resource-storage'
import type { TextbookOption, ChapterNode, UserTextbookInfo } from '../types'
import KnowledgeGraph from '../components/knowledge-graph/KnowledgeGraph.vue'
import LearningView from './LearningView.vue'
import KnowledgeGraphDebugPanel from '../components/debug/KnowledgeGraphDebugPanel.vue'
import type { KnowledgeGraphDebugParams } from '../components/debug/KnowledgeGraphDebugPanel.vue'
import LearningStatusControlPanel from '../components/debug/LearningStatusControlPanel.vue'
import PhotoSearchDialog from '../components/PhotoSearchDialog.vue'
import { useTextbookChapterState } from '../stores/textbookChapterState'
import { useBetterScroll } from '../composables/useBetterScroll'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import { useQuestionStore } from '../stores/questionStore'
import { showMessage } from '../utils'
import {
  convertToChineseNumber
} from '../utils/business/chapter-utils'

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// 流程：导入图标资源
import bookIcon from '/images/book.png'
import indicatorIcon from '/icons/Indicator.svg'
import notLearnedStarIcon from '/icons/notLearnedStar.svg'
import learnedStarIcon from '/icons/learnedStar.svg'
import lastLearnedStarIcon from '/icons/lastLearnedStar.svg'
import backgroundImage from '/icons/background.svg'
import chapterSearchIcon from '/icons/chapter_search.svg'
import photoSearchIcon from '/icons/photo_search.svg'
// 使用统一的章节状态管理
const {
  setCurrentChapter,
  setCurrentTextbook,
  getChapterRotation,
  setChapterRotation,
  getCurrentChapterExpandedGraph,
  setCurrentChapterExpandedGraph,
  clearTextbookStates,
  initializeChapterStates,
  getCurrentChapter,
  savePageState,
  restorePageState
} = useTextbookChapterState()

// 获取路由实例
const route = useRoute()

// Store
const questionStore = useQuestionStore()

// 第4步：添加搜索相关的响应式数据
const searchQuery = ref('')
const showNodeSearch = ref(false) // 控制搜索框显示/隐藏

// 拍照搜题相关状态
const showPhotoSearchDialog = ref(false)

// 当前科目（用于拍照搜题）
const currentSubjectForPhotoSearch = computed(() => {
  const currentQuestion = questionStore.currentQuestion
  if (currentQuestion?.subject) {
    const subjectMap: Record<string, string> = {
      'SUBJECT_MATH': 'math',
      'SUBJECT_BIOLOGY': 'biology',
      'SUBJECT_CHEMISTRY': 'chemistry',
      'SUBJECT_PHYSICS': 'physics',
      'SUBJECT_CHINESE': 'chinese',
      'SUBJECT_ENGLISH': 'english'
    }
    return subjectMap[currentQuestion.subject] || currentQuestion.subject.toLowerCase() || 'math'
  }
  // 如果没有当前题目，根据用户选择的科目判断
  const subjectMap: Record<string, string> = {
    '数学': 'math',
    '生物': 'biology',
    '化学': 'chemistry',
    '物理': 'physics',
    '语文': 'chinese',
    '英语': 'english'
  }
  return subjectMap[currentSubjectLabel.value] || 'math'
})

// 章节数据
const chapters = ref<string[]>([])
const chapterStructure = ref<ChapterNode[]>([])

// 递归收集所有节点（包括所有层级的子节点）
const collectAllNodes = (chapter: ChapterNode, chapterIndex: number): Array<{
  node: ChapterNode
  chapterIndex: number
  chapterName: string
}> => {
  const results: Array<{
    node: ChapterNode
    chapterIndex: number
    chapterName: string
  }> = []
  
  // 第1步：添加当前节点
  const chapterName = chapters.value[chapterIndex] || chapter.name
  results.push({
    node: chapter,
    chapterIndex,
    chapterName
  })
  
  // 第2步：递归处理子节点
  const collectChildren = (node: ChapterNode) => {
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        results.push({
          node: child,
          chapterIndex,
          chapterName
        })
        // 递归处理子节点的子节点
        collectChildren(child)
      })
    }
  }
  
  collectChildren(chapter)
  return results
}

// 搜索节点结果
const searchResults = computed(() => {
  if (!searchQuery.value.trim() || chapterStructure.value.length === 0) {
    return []
  }
  
  // 第1步：收集所有章节的所有节点
  const allNodes: Array<{
    node: ChapterNode
    chapterIndex: number
    chapterName: string
  }> = []
  
  chapterStructure.value.forEach((chapter, index) => {
    const nodes = collectAllNodes(chapter, index)
    allNodes.push(...nodes)
  })
  
  // 第2步：模糊搜索节点（搜索name和label）
  const query = searchQuery.value.trim().toLowerCase()
  return allNodes.filter(item => {
    const node = item.node
    const name = (node.name || '').toLowerCase()
    const label = (node.label || '').toLowerCase()
    return name.includes(query) || label.includes(query)
  })
})

// 过滤后的章节列表（当没有搜索时显示）
const filteredChapters = computed(() => {
  if (!searchQuery.value.trim()) {
    // 直接使用后台返回的顺序，不进行排序
    return chapters.value.map((chapter, index) => {
      return { 
        chapter, 
        index
      }
    })
  }
  
  return []
})

// 响应式数据
const loading = ref(true)
const selectedChapterDetails = ref<ChapterNode | null>(null)

// 学习对话框状态管理
const learningDialogVisible = ref(false)
const learningDialogData = ref<{
  nodeId: string
  sectionName: string
  level: number
  textbookId: string
} | null>(null)

// 椭圆布局相关
const circularContainerRef = ref<HTMLElement>()
const circularLayoutRef = ref<HTMLElement>()
const indicatorContainerRef = ref<HTMLElement>()

// Better Scroll 实例
const chapterListWrapper = ref<HTMLElement | null>(null)

// 使用 Better Scroll 组合式函数
// autoWatch 会自动监听 filteredChapters 和 searchResults 的变化并刷新
const { init: initChapterListBScroll } = useBetterScroll(
  chapterListWrapper,
  {
    scrollY: true,
    scrollX: false,
    click: true,
    bounce: {
      top: true,
      bottom: true,
      left: false,
      right: false
    },
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
  },
  true, // 自动监听数据变化
  [
    () => filteredChapters.value.length,
    () => searchResults.value.length
  ]
)

// 章节状态接口定义
// 旋转控制相关
const isDragging = ref(false) // 是否正在拖拽
const isActualDragging = ref(false) // 是否实际拖拽（超过阈值）
const isMouseDown = ref(false) // 鼠标是否按下（用于控制是否处理移动事件）
const isAnimating = ref(false) // 是否正在执行自动旋转动画
const startY = ref(0) // 开始触摸的Y坐标
const lastY = ref(0) // 上次触摸的Y坐标
const screenHeight = ref(window.innerHeight) // 屏幕高度
// 归一化参考高度：参考移动端短视频切换，使用视口高度的比例作为参考
// 这样滑动大部分屏幕高度就能切换到下一个知识图谱，交互更自然
const normalizedReferenceHeight = computed(() => screenHeight.value * debugParams.value.normalizedReferenceHeightRatio)
const lastRotationTime = ref(0) // 上次旋转时间戳，用于检测快速滑动

// 调试面板状态
const debugPanelVisible = ref(false)

// 学习状态控制面板状态
const learningStatusPanelVisible = ref(false)

// 默认参数值（固定不变，作为基准）
const defaultDebugParams: KnowledgeGraphDebugParams = {
  radiusX: 500, // 椭圆轨道的X轴半径（水平方向）
  radiusY: 320, // 椭圆轨道的Y轴半径（垂直方向）
  dragThreshold: 3, // 拖拽阈值（像素，超过此值才开始真正的拖拽操作）
  minBackgroundRadius: 120, // 背景圆形最小半径（像素）
  radiusScaleSmall: 0.7, // 小规模节点（1-2个）的半径缩放系数
  radiusScaleMedium: 0.85, // 中等规模节点（3-4个）的半径缩放系数
  radiusScaleLarge: 0.95, // 大规模节点（5个以上）的半径缩放系数
  // 动画参数
  transformDuration: 0.3, // 位置变换动画持续时间（秒）
  opacityDuration: 0.3, // 透明度动画持续时间（秒）
  easingX1: 0.25, // 缓动函数 cubic-bezier 的第一个控制点 X 坐标
  easingY1: 0.46, // 缓动函数 cubic-bezier 的第一个控制点 Y 坐标
  easingX2: 0.45, // 缓动函数 cubic-bezier 的第二个控制点 X 坐标
  easingY2: 0.94, // 缓动函数 cubic-bezier 的第二个控制点 Y 坐标
  animationDelayFactor: 0.03, // 动画延迟系数（用于基于距离的延迟计算，距离越近延迟越短）
  backgroundTransitionDurationClockwise: 0.3, // 背景圆形顺时针旋转时的过渡时间（秒）
  backgroundTransitionDurationCounterclockwise: 0.3, // 背景圆形逆时针旋转时的过渡时间（秒）
  // 角度参数
  targetAngle: 161, // 目标角度（度），用于自动定位
  influenceRange: (2 * Math.PI) / 3, // 影响范围（弧度），展开图谱周围的影响范围
  maxPushAngle: (46 * Math.PI) / 180, // 最大推开角度（弧度），其他节点被推开的最大角度
  // 动画时长参数
  expandingRotationDuration: 0.4, // 展开旋转动画持续时间（秒）
  debounceDelay: 0.1, // 防抖延迟（秒）
  // 透明度参数
  opacityExpanded: 1, // 展开的知识图谱透明度
  opacityNearMin: 0.59, // 距离相关透明度最小值
  opacityNearFactor: 0.22, // 距离相关透明度因子
  opacityFar: 0.4, // 距离较远节点透明度
  opacityDefault: 0.58, // 默认状态下透明度
  // 缩放参数
  scaleFactor: 0, // 缩放因子，控制距离相关的缩放幅度
  // 尺寸参数
  graphSize: 475, // 图形尺寸（像素）
  graphMargin: 237, // 图形位置偏移（像素）
  // 中心节点尺寸参数
  centerNodeSizeDefault: 180, // 中心节点初始大小（像素）
  centerNodeSizeExpanded: 220, // 中心节点放大后大小（像素）
  centerNodeSizeShrunk: 160, // 中心节点缩小大小（像素）
  centerNodeScaleSpeed: 0.3, // 中心节点缩放速度（秒），控制缩放动画的持续时间
  // 归一化参考高度比例
  normalizedReferenceHeightRatio: 0.85, // 归一化参考高度比例，参考移动端短视频切换，使用视口高度的比例作为参考
  // 节点动画参数
  nodeEnterExitDuration: 0.3, // 节点进入/退出动画持续时间（秒）
  nodeExpandDelayInterval: 0.01, // 圆周节点展开动画延迟间隔（秒/节点索引）
  nodeCollapseDelayInterval: 0.01, // 圆周节点收起动画延迟间隔（秒/节点索引）
  nodeContentTransitionDuration: 0.3, // 节点内容transition持续时间（秒）
  nodeBaseTransitionDuration: 0.3, // 节点基础transition持续时间（秒）
  learningTagTransitionDuration: 0.3, // 学习标签transition持续时间（秒）
  learningTagTop: -5, // 学习标签top位置（像素）
  learningTagLeft: 65, // 学习标签left位置（像素）
  learningTagTranslateX: 0, // 学习标签translateX偏移（百分比）
  bubbleButtonTransitionDuration: 0.2, // 气泡框按钮transition持续时间（秒）
  nodeActiveTransitionDuration: 0.1, // 节点active状态transition持续时间（秒）
  // 圆周节点位置参数
  circularNodeRadiusFactor: 1.0, // 圆周节点半径因子，用于调整圆周节点相对背景圆的位置（1.0表示与背景圆一致）
  circularNodeOffsetX: 50, // 圆周节点X方向偏移量（像素），用于调整节点相对中心的X偏移
  circularNodeOffsetY: 50, // 圆周节点Y方向偏移量（像素），用于调整节点相对中心的Y偏移
  circularNodeFontSize: 1.2 // 圆周节点字体大小（rem），用于调整圆周节点标题的字体大小
}

// 当前参数值（可修改）
const debugParams = ref<KnowledgeGraphDebugParams>({ ...defaultDebugParams })

// 通过 provide 传递调试参数给子组件
provide('knowledgeGraphDebugParams', debugParams)

// 处理调试参数更新
const handleDebugParamsUpdate = (params: KnowledgeGraphDebugParams) => {
  // 更新参数，保持响应式引用（通过逐个属性赋值而不是替换整个对象）
  // 这样可以确保 provide 的引用仍然有效
  Object.assign(debugParams.value, params)
}

// 处理学习状态刷新
const handleLearningStatusRefresh = () => {
  // 当学习状态发生变化时，强制刷新知识图谱组件
  // 通过更新key来触发组件重新渲染
  // 这里可以通过触发一个状态更新来让知识图谱组件重新加载学习状态
  // 由于知识图谱组件会从localStorage自动读取状态，这里只需要触发一次更新即可
  // 可以通过更新一个不相关的响应式变量来触发重新渲染，或者使用nextTick
  nextTick(() => {
    // 触发响应式更新，让知识图谱组件重新评估学习状态
    if (selectedChapterDetails.value) {
      // 创建一个新的引用，触发响应式更新
      selectedChapterDetails.value = { ...selectedChapterDetails.value }
    }
  })
}

// 处理节点更新
const handleNodeUpdate = (
  action: 'add' | 'update' | 'delete',
  nodeType: 'center' | 'circular',
  node: ChapterNode,
  oldNode?: ChapterNode
) => {
  if (!selectedChapterDetails.value) {
    return
  }

  // 深拷贝章节数据，避免直接修改原始数据
  const updatedChapter = JSON.parse(JSON.stringify(selectedChapterDetails.value))

  if (nodeType === 'center') {
    // 更新中心节点
    if (action === 'update') {
      updatedChapter.id = node.id
      updatedChapter.name = node.name
      updatedChapter.level = node.level
      updatedChapter.label = node.label || node.name
    } else if (action === 'delete') {
      // 删除中心节点后，重置为第一个章节（如果有）
      if (chapterStructure.value.length > 0) {
        selectChapter(0)
        return
      } else {
        selectedChapterDetails.value = null
        return
      }
    }
  } else if (nodeType === 'circular') {
    // 更新圆周节点
    if (!updatedChapter.children) {
      updatedChapter.children = []
    }

    if (action === 'add') {
      // 添加新节点
      // 第1步：检查传入节点的 parentId，判断是添加到中心节点下还是添加到一级节点下
      const parentId = node.parentId || updatedChapter.id || null
      const isAddingToCenter = parentId === updatedChapter.id || !parentId
      
      // 第2步：根据父节点确定新节点的层级
      let newNodeLevel: number
      let targetParentNode: ChapterNode | null = null
      
      if (isAddingToCenter) {
        // 添加到中心节点下，作为一级节点
        const centerLevel = updatedChapter.level ?? 0
        newNodeLevel = centerLevel === 0 ? 1 : centerLevel === 1 ? 2 : (node.level ?? 1)
      } else {
        // 添加到一级节点下，作为二级节点
        // 找到对应的一级节点
        targetParentNode = updatedChapter.children?.find((child: ChapterNode) => child.id === parentId) || null
        if (targetParentNode) {
          newNodeLevel = (targetParentNode.level ?? 1) + 1
        } else {
          // 如果找不到父节点，默认添加到中心节点下
          const centerLevel = updatedChapter.level ?? 0
          newNodeLevel = centerLevel === 0 ? 1 : centerLevel === 1 ? 2 : (node.level ?? 1)
        }
      }
      
      // 第3步：创建新节点
      const newNode: ChapterNode = {
        ...node,
        level: newNodeLevel,
        isRoot: false,
        updateTime: new Date().toISOString(),
        parentId: parentId,
        label: node.label || node.name,
        children: []
      }
      
      // 第4步：根据父节点类型决定添加到哪个位置
      if (isAddingToCenter || !targetParentNode) {
        // 添加到中心节点的 children（作为一级节点）
        updatedChapter.children = updatedChapter.children || []
        updatedChapter.children.push(newNode)
      } else {
        // 添加到一级节点的 children（作为二级节点）
        if (!targetParentNode.children) {
          targetParentNode.children = []
        }
        targetParentNode.children.push(newNode)
      }
    } else if (action === 'update' && oldNode) {
      // 更新现有节点
      const index = updatedChapter.children.findIndex((n: ChapterNode) => n.id === oldNode.id)
      if (index !== -1) {
        updatedChapter.children[index] = {
          ...node,
          children: updatedChapter.children[index].children || [],
          label: node.label || node.name,
          updateTime: new Date().toISOString()
        }
      }
    } else if (action === 'delete') {
      // 删除节点
      const index = updatedChapter.children.findIndex((n: ChapterNode) => n.id === node.id)
      if (index !== -1) {
        updatedChapter.children.splice(index, 1)
      }
    }
  }

  // 更新 selectedChapterDetails
  selectedChapterDetails.value = updatedChapter

  // 同时更新 chapterStructure 中对应的章节
  const currentIndex = getCurrentChapter()
  if (currentIndex >= 0 && chapterStructure.value[currentIndex]) {
    chapterStructure.value[currentIndex] = updatedChapter
  }

  // 触发重新渲染
  nextTick(() => {
    renderGraph()
  })
}

// 计算缓动函数字符串
const easingFunction = computed(() => {
  const params = debugParams.value
  return `cubic-bezier(${params.easingX1}, ${params.easingY1}, ${params.easingX2}, ${params.easingY2})`
})

// 计算位置变换动画字符串
const transformTransition = computed(() => {
  const params = debugParams.value
  return `transform ${params.transformDuration}s ${easingFunction.value}`
})

// 计算透明度动画字符串
const opacityTransition = computed(() => {
  const params = debugParams.value
  return `opacity ${params.opacityDuration}s ${easingFunction.value}`
})

// 计算组合动画字符串（transform + opacity）
const combinedTransition = computed(() => {
  return `${transformTransition.value}, ${opacityTransition.value}`
})

// 第21步：优化拖拽阈值常量 - 使用可调参数
const DRAG_THRESHOLD = computed(() => debugParams.value.dragThreshold)

// 防抖定时器
const debounceTimer = ref<NodeJS.Timeout | null>(null)


// 展开时的旋转状态管理
const isExpandingRotation = ref(false) // 是否正在执行展开旋转动画
const expandingRotationStartAngle = ref(0) // 展开旋转起始角度
const expandingRotationTargetAngle = ref(0) // 展开旋转目标角度
const expandingRotationStartTime = ref(0) // 展开旋转开始时间

// 收缩动画状态管理
const isCollapsing = ref(false) // 是否正在执行收缩动画

// 旋转方向状态管理
const rotationDirection = ref<'clockwise' | 'counterclockwise' | null>(null) // 当前旋转方向

// 指示器滑动相关状态
const isIndicatorDragging = ref(false) // 是否正在指示器区域滑动
const indicatorCurrentIndex = ref<number | null>(null) // 当前触摸的指示器索引

// 圆周节点触摸状态
const touchStartedOnCircularNode = ref(false) // 触摸是否从圆周节点开始
const circularNodeTouchTarget = ref<HTMLElement | null>(null) // 触摸开始的圆周节点元素

// 第1步：检查触摸目标是否是圆周节点（或其子元素）
const isCircularNodeTarget = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) {
    return false
  }
  
  // 检查目标元素或其父元素是否包含圆周节点的类名
  // 使用 closest 方法向上查找，如果找到包含圆周节点类名的元素，返回 true
  return (
    target.classList.contains('graph-node--circular') ||
    target.classList.contains('node-wrapper--circular') ||
    target.closest('.graph-node--circular') !== null ||
    target.closest('.node-wrapper--circular') !== null
  )
}

// 触摸事件处理函数
const handleTouchStart = (event: TouchEvent) => {
  if (!circularLayoutRef.value) return
  
  // 检查触摸点是否在圆周节点上
  const isOnCircularNode = isCircularNodeTarget(event.target)
  touchStartedOnCircularNode.value = isOnCircularNode
  
  // 如果触摸点在圆周节点上，记录目标元素（用于后续阻止点击事件）
  if (isOnCircularNode && event.target instanceof HTMLElement) {
    circularNodeTouchTarget.value = event.target.closest('.graph-node--circular') as HTMLElement || 
                                    event.target.closest('.node-wrapper--circular') as HTMLElement ||
                                    event.target
  } else {
    circularNodeTouchTarget.value = null
  }
  
  // 不在 touchstart 时设置 isDragging，只在 move 中设置
  isActualDragging.value = false // 初始为false，需要超过阈值才设为true
  startY.value = event.touches[0].clientY
  lastY.value = event.touches[0].clientY
  
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
  const isJustStartingDrag = totalDeltaY > DRAG_THRESHOLD.value && !isActualDragging.value
  
  if (isJustStartingDrag) {
    isActualDragging.value = true
    isDragging.value = true // ✅ 只有在实际移动超过阈值时才设置 isDragging
    
    // 如果是从圆周节点开始的滑动，且超过阈值，阻止节点点击事件
    if (touchStartedOnCircularNode.value && circularNodeTouchTarget.value) {
      // 通过阻止事件传播来阻止节点点击事件
      event.stopPropagation()
      // 标记节点元素，防止后续点击事件触发
      if (circularNodeTouchTarget.value) {
        circularNodeTouchTarget.value.style.pointerEvents = 'none'
        // 在触摸结束后恢复
        setTimeout(() => {
          if (circularNodeTouchTarget.value) {
            circularNodeTouchTarget.value.style.pointerEvents = ''
          }
        }, 100)
      }
    }
    
    // 首次超过阈值时，将 lastY 重置为 startY，这样 deltaY 会包含从开始到现在的所有移动
    // 这样可以确保首次触发旋转时也有明显的旋转效果
    lastY.value = startY.value
  }
  
  // 只有实际拖拽时才执行旋转逻辑
  if (!isActualDragging.value) {
    lastY.value = currentY
    return
  }
  
  // 如果是从圆周节点开始的滑动，阻止事件传播
  if (touchStartedOnCircularNode.value) {
    event.stopPropagation()
  }
  
  // 重新计算 deltaY（在首次超过阈值时，这会是从 startY 到 currentY 的总距离）
  const effectiveDeltaY = currentY - lastY.value
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 相邻知识图谱之间的角度差
  // 获取子章节总数，计算相邻知识图谱之间的角度差
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const total = subChapters.length
  const angleBetweenGraphs = total > 0 ? 360 / total : 360 // 相邻知识图谱之间的角度差
  
  // 使用归一化参考高度计算旋转角度
  const rotationDelta = (effectiveDeltaY / normalizedReferenceHeight.value) * angleBetweenGraphs
  
  // 如果有知识图谱处于展开状态，先收缩它
  if (getCurrentChapterExpandedGraph() !== null) {
    const expandedGraphId = getCurrentChapterExpandedGraph()
    console.log('📉 [KnowledgeGraphView] 触摸移动导致知识图谱收缩:', {
      trigger: 'handleTouchMove',
      expandedGraphId,
      currentChapterIndex: getCurrentChapter(),
      currentChapterId: selectedChapterDetails.value?.id,
      currentChapterName: selectedChapterDetails.value?.name,
      timestamp: new Date().toISOString(),
      rotationDelta
    })
    setCurrentChapterExpandedGraph(null)
  }
  
  // 更新当前章节的旋转角度（向上滑动为正，向下滑动为负）
  const currentRotation = getChapterRotation(getCurrentChapter())
  const newRotation = currentRotation - rotationDelta
  
  console.log('🔄 [KnowledgeGraphView] 触摸移动导致知识图谱旋转:', {
    trigger: 'handleTouchMove',
    effectiveDeltaY,
    rotationDelta,
    currentRotation,
    newRotation,
    currentChapterIndex: getCurrentChapter(),
    touchStartedOnCircularNode: touchStartedOnCircularNode.value,
    timestamp: new Date().toISOString()
  })
  
  setChapterRotation(getCurrentChapter(), newRotation)
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
  
  // 阻止默认滚动行为
  event.preventDefault()
}

const handleTouchEnd = () => {
  // 保存实际拖拽状态，因为后面会重置
  const wasActuallyDragging = isActualDragging.value
  const wasOnCircularNode = touchStartedOnCircularNode.value
  
  // 计算总滑动方向
  const totalDeltaY = lastY.value - startY.value
  
  // 重置状态
  isDragging.value = false
  isActualDragging.value = false
  touchStartedOnCircularNode.value = false
  
  // 恢复圆周节点的 pointer-events（如果之前被禁用）
  if (circularNodeTouchTarget.value) {
    circularNodeTouchTarget.value.style.pointerEvents = ''
    circularNodeTouchTarget.value = null
  }
  
  // 只有在实际拖拽时才执行自动定位逻辑
  if (wasActuallyDragging) {
    // 防抖处理，避免与点击事件冲突
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    
    debounceTimer.value = setTimeout(() => {
      // 根据滑动方向切换到下一个或上一个知识图谱
      // 向上滑动（totalDeltaY > 0）→ 下一个（index + 1）
      // 向下滑动（totalDeltaY < 0）→ 上一个（index - 1）
      const direction = totalDeltaY > 0 ? 'next' : totalDeltaY < 0 ? 'previous' : null
      autoPositionToNearestGraph(direction)
    }, debugParams.value.debounceDelay * 1000) // 防抖延迟（转换为毫秒）
  }
}

// 重置拖拽状态（当有图谱展开时调用）
const resetDraggingState = () => {
  isDragging.value = false
}

// 自动定位到目标角度最近的知识图谱，或根据滑动方向切换到下一个/上一个
const autoPositionToNearestGraph = (direction?: 'next' | 'previous' | null) => {
  if (!selectedChapterDetails.value) return
  
  const subChapters = getSubChapters(selectedChapterDetails.value)
  if (subChapters.length === 0) return
  
  // 如果只有一个子章节，不执行切换
  if (subChapters.length === 1) {
    setCurrentChapterExpandedGraph(subChapters[0].id)
    startExpandingRotation(subChapters[0].id)
    return
  }
  
  let targetIndex = 0
  
  // 如果指定了方向（next 或 previous），根据滑动方向切换
  if (direction === 'next' || direction === 'previous') {
    // 获取当前展开的知识图谱索引
    const currentExpandedGraphId = getCurrentChapterExpandedGraph()
    let currentIndex = -1
    
    if (currentExpandedGraphId) {
      currentIndex = subChapters.findIndex(chapter => chapter.id === currentExpandedGraphId)
    }
    
    // 如果找不到当前展开的图谱，先找到距离目标角度最近的知识图谱作为基准
    if (currentIndex === -1) {
      const targetAngle = debugParams.value.targetAngle
      let nearestIndex = 0
      let minDistance = Infinity
      
      for (let i = 0; i < subChapters.length; i++) {
        const { currentAngle } = calculateCircularTrackAngle(i, subChapters.length)
        let angleInDegrees = (currentAngle * 180 / Math.PI) % 360
        if (angleInDegrees < 0) angleInDegrees += 360
        
        const distance = Math.min(
          Math.abs(angleInDegrees - targetAngle),
          Math.abs(angleInDegrees - targetAngle + 360),
          Math.abs(angleInDegrees - targetAngle - 360)
        )
        
        if (distance < minDistance) {
          minDistance = distance
          nearestIndex = i
        }
      }
      
      currentIndex = nearestIndex
    }
    
    // 根据方向计算目标索引（循环处理）
    if (direction === 'next') {
      // 向上滑动 → 下一个（顺时针方向，index + 1）
      targetIndex = (currentIndex + 1) % subChapters.length
    } else {
      // 向下滑动 → 上一个（逆时针方向，index - 1）
      targetIndex = (currentIndex - 1 + subChapters.length) % subChapters.length
    }
  } else {
    // 没有指定方向，使用原来的逻辑：找到距离目标角度最近的知识图谱
    const targetAngle = debugParams.value.targetAngle
    let minDistance = Infinity
    
    for (let i = 0; i < subChapters.length; i++) {
      const { currentAngle } = calculateCircularTrackAngle(i, subChapters.length)
      let angleInDegrees = (currentAngle * 180 / Math.PI) % 360
      if (angleInDegrees < 0) angleInDegrees += 360
      
      const distance = Math.min(
        Math.abs(angleInDegrees - targetAngle),
        Math.abs(angleInDegrees - targetAngle + 360),
        Math.abs(angleInDegrees - targetAngle - 360)
      )
      
      if (distance < minDistance) {
        minDistance = distance
        targetIndex = i
      }
    }
  }
  
  // 立即设置展开状态，让展开动画开始
  setCurrentChapterExpandedGraph(subChapters[targetIndex].id)
  
  // 只执行展开旋转动画，让它处理所有旋转逻辑（包括定位到目标位置）
  startExpandingRotation(subChapters[targetIndex].id)
}


// 鼠标事件处理函数（可选功能）
const handleMouseDown = (event: MouseEvent) => {
  if (!circularLayoutRef.value) return
  
  // 检查鼠标点击是否在圆周节点上
  const isOnCircularNode = isCircularNodeTarget(event.target)
  touchStartedOnCircularNode.value = isOnCircularNode
  
  // 如果鼠标点击在圆周节点上，记录目标元素（用于后续阻止点击事件）
  if (isOnCircularNode && event.target instanceof HTMLElement) {
    circularNodeTouchTarget.value = event.target.closest('.graph-node--circular') as HTMLElement || 
                                    event.target.closest('.node-wrapper--circular') as HTMLElement ||
                                    event.target
  } else {
    circularNodeTouchTarget.value = null
  }
  
  // 设置鼠标按下状态
  isMouseDown.value = true
  
  // 不在 mousedown 时设置 isDragging，只在 move 中设置
  isActualDragging.value = false // 初始为false，需要超过阈值才设为true
  startY.value = event.clientY
  lastY.value = event.clientY
  
  // 阻止默认行为
}

const handleMouseMove = (event: MouseEvent) => {
  // 只有在鼠标按下时才处理移动事件
  if (!isMouseDown.value || !circularLayoutRef.value) return
  
  const currentY = event.clientY
  const deltaY = currentY - lastY.value
  const currentTime = Date.now()
  
  // 计算移动距离，判断是否超过拖拽阈值
  const totalDeltaY = Math.abs(currentY - startY.value)
  const isJustStartingDrag = totalDeltaY > DRAG_THRESHOLD.value && !isActualDragging.value
  
  // 判断是否首次超过阈值，触发拖拽状态
  if (isJustStartingDrag) {
    isActualDragging.value = true
    isDragging.value = true // ✅ 只有在实际移动超过阈值时才设置 isDragging
    
    // 如果是从圆周节点开始的拖动，且超过阈值，阻止节点点击事件
    if (touchStartedOnCircularNode.value && circularNodeTouchTarget.value) {
      // 通过阻止事件传播来阻止节点点击事件
      event.stopPropagation()
      // 标记节点元素，防止后续点击事件触发
      if (circularNodeTouchTarget.value) {
        circularNodeTouchTarget.value.style.pointerEvents = 'none'
        // 在鼠标释放后恢复
        setTimeout(() => {
          if (circularNodeTouchTarget.value) {
            circularNodeTouchTarget.value.style.pointerEvents = ''
          }
        }, 100)
      }
    }
    
    // 首次超过阈值时，将 lastY 重置为 startY，这样 deltaY 会包含从开始到现在的所有移动
    // 这样可以确保首次触发旋转时也有明显的旋转效果
    lastY.value = startY.value
  }
  
  // 只有实际拖拽时才执行旋转逻辑
  if (!isActualDragging.value) {
    // 未超过阈值，只更新位置，不执行旋转
    lastY.value = currentY
    return
  }
  
  // 如果是从圆周节点开始的拖动，阻止事件传播
  if (touchStartedOnCircularNode.value) {
    event.stopPropagation()
  }
  
  // 重新计算 deltaY（在首次超过阈值时，这会是从 startY 到 currentY 的总距离）
  const effectiveDeltaY = currentY - lastY.value
  
  // 计算旋转角度：滑动距离与屏幕高度的比例 * 相邻知识图谱之间的角度差
  // 获取子章节总数，计算相邻知识图谱之间的角度差
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const total = subChapters.length
  const angleBetweenGraphs = total > 0 ? 360 / total : 360 // 相邻知识图谱之间的角度差
  
  // 使用归一化参考高度计算旋转角度
  const rotationDelta = (effectiveDeltaY / normalizedReferenceHeight.value) * angleBetweenGraphs
  
  // 如果有知识图谱处于展开状态，先收缩它
  if (getCurrentChapterExpandedGraph() !== null) {
    const expandedGraphId = getCurrentChapterExpandedGraph()
    console.log('📉 [KnowledgeGraphView] 鼠标移动导致知识图谱收缩:', {
      trigger: 'handleMouseMove',
      expandedGraphId,
      currentChapterIndex: getCurrentChapter(),
      currentChapterId: selectedChapterDetails.value?.id,
      currentChapterName: selectedChapterDetails.value?.name,
      timestamp: new Date().toISOString(),
      rotationDelta
    })
    setCurrentChapterExpandedGraph(null)
  }
  
  // 更新当前章节的旋转角度（向上滑动为正，向下滑动为负）
  const currentRotation = getChapterRotation(getCurrentChapter())
  const newRotation = currentRotation - rotationDelta
  
  console.log('🔄 [KnowledgeGraphView] 鼠标移动导致知识图谱旋转:', {
    trigger: 'handleMouseMove',
    effectiveDeltaY,
    rotationDelta,
    currentRotation,
    newRotation,
    currentChapterIndex: getCurrentChapter(),
    touchStartedOnCircularNode: touchStartedOnCircularNode.value,
    timestamp: new Date().toISOString()
  })
  
  setChapterRotation(getCurrentChapter(), newRotation)
  
  // 更新上次位置和时间戳
  lastY.value = currentY
  lastRotationTime.value = currentTime
}

const handleMouseUp = () => {
  // 只有在鼠标按下时才处理释放事件
  if (!isMouseDown.value) return
  
  // 重置鼠标按下状态
  isMouseDown.value = false
  
  // 保存实际拖拽状态，因为后面会重置
  const wasActuallyDragging = isActualDragging.value
  
  // 计算总滑动方向
  const totalDeltaY = lastY.value - startY.value
  
  // 重置状态
  isDragging.value = false
  isActualDragging.value = false
  touchStartedOnCircularNode.value = false
  
  // 恢复圆周节点的 pointer-events（如果之前被禁用）
  if (circularNodeTouchTarget.value) {
    circularNodeTouchTarget.value.style.pointerEvents = ''
    circularNodeTouchTarget.value = null
  }
  
  // 只有在实际拖拽时才执行自动定位逻辑
  if (wasActuallyDragging) {
    // 防抖处理，避免与点击事件冲突
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    
    const direction = totalDeltaY < 0 ? 'next' : totalDeltaY > 0 ? 'previous' : null
    
    debounceTimer.value = setTimeout(() => {
      // 根据滑动方向切换到下一个或上一个知识图谱
      // 向上滑动（totalDeltaY < 0）→ 下一个（index + 1）
      // 向下滑动（totalDeltaY > 0）→ 上一个（index - 1）
      autoPositionToNearestGraph(direction)
    }, debugParams.value.debounceDelay * 1000) // 防抖延迟（转换为毫秒）
  }
}

// 椭圆轨迹指示器坐标系 - 统一的角度计算函数
const calculateCircularTrackAngle = (index: number, total: number) => {
  // 第1步：从调试参数中获取起始角度（目标角度），并转换为弧度
  const startAngle = (debugParams.value.targetAngle * Math.PI) / 180
  // 第2步：计算每个节点之间的角度间隔
  const angleStep = (2 * Math.PI) / total
  // 第3步：基础角度：从起始角度开始，按索引逆时针排列
  let baseAngle = startAngle + (angleStep * index)
  // 第4步：当前角度：基础角度 + 当前章节的旋转角度
  let currentAngle = baseAngle + (getChapterRotation(getCurrentChapter()) * Math.PI / 180)
  
  // 第5步：将角度标准化到 [0, 2π] 范围
  while (baseAngle >= 2 * Math.PI) baseAngle -= 2 * Math.PI
  while (baseAngle < 0) baseAngle += 2 * Math.PI
  while (currentAngle >= 2 * Math.PI) currentAngle -= 2 * Math.PI
  while (currentAngle < 0) currentAngle += 2 * Math.PI
  
  return { baseAngle, currentAngle }
}

// 椭圆轨迹指示器坐标系 - 统一的位置计算函数
const calculateCircularTrackPosition = (angle: number, radiusX?: number, radiusY?: number) => {
  // 使用椭圆轨迹指示器的坐标系：0度为正右方，逆时针为正
  const xRadius = radiusX ?? debugParams.value.radiusX
  const yRadius = radiusY ?? debugParams.value.radiusY
  const x = Math.cos(angle) * xRadius
  const y = Math.sin(angle) * yRadius
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
  
  // 第5步：从调试参数中获取目标角度，并转换为弧度
  const targetAngleRadians = (debugParams.value.targetAngle * Math.PI) / 180
  
  // 第6步：计算角度差的绝对值 alpha（当前角度与目标角度的差）
  const alpha = Math.abs(currentAngle - targetAngleRadians)
  
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
    const duration = debugParams.value.expandingRotationDuration * 1000 // 动画持续时间（转换为毫秒）
    const progress = Math.min(elapsed / duration, 1)
    
    // 使用更平滑的缓动函数实现流畅的动画效果
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
    const easedProgress = easeOutQuart(progress)
    
    // 计算当前角度（线性插值）
    const currentAngle = expandingRotationStartAngle.value + 
      (expandingRotationTargetAngle.value - expandingRotationStartAngle.value) * easedProgress
    
    // 更新当前章节的旋转角度
    setChapterRotation(getCurrentChapter(), currentAngle)
    
    // 第28步：检查动画是否完成
    if (progress < 1) {
      requestAnimationFrame(animateExpandingRotation)
    } else {
      // 动画完成，确保角度完全一致
      setChapterRotation(getCurrentChapter(), expandingRotationTargetAngle.value)
      
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

// 获取教材ID用于知识点查询（textbookId字段，不是版本ID）
const getTextbookIdForKnowledgeGraph = () => {
  const option = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
  if (option && option.textbookId) {
    return option.textbookId
  }
  return ''
}

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

// 第29步：保存页面状态
const saveCurrentPageState = () => {
  try {
    const state = {
      selectedSubject: selectedSubject.value,
      selectedTextbook: selectedTextbook.value,
      selectedChapterIndex: getCurrentChapter(),
      selectedChapterDetails: selectedChapterDetails.value,
      chapters: chapters.value,
      chapterStructure: chapterStructure.value,
      textbookOptions: textbookOptions.value // 保存当前教材选项
    }
    
    console.log('💾 [KnowledgeGraphView] 保存页面状态:', {
      selectedSubject: state.selectedSubject,
      selectedTextbook: state.selectedTextbook,
      selectedChapterIndex: state.selectedChapterIndex,
      chapterName: state.selectedChapterDetails?.name || '未知',
      chaptersCount: state.chapters?.length || 0,
      chapterStructureCount: state.chapterStructure?.length || 0,
      textbookOptionsCount: state.textbookOptions?.length || 0
    })
    
    savePageState(state)
    console.log('✅ [KnowledgeGraphView] 页面状态保存成功')
  } catch (error) {
    // 状态保存失败，静默处理
    console.error('❌ [KnowledgeGraphView] 页面状态保存失败:', error)
  }
}

// 第30步：恢复页面状态
const restorePageStateFromStore = async (): Promise<boolean> => {
  console.log('🔄 [KnowledgeGraphView] 开始恢复页面状态...')
  
  try {
    const savedState = restorePageState()
    if (!savedState) {
      console.log('❌ [KnowledgeGraphView] 没有保存的状态，跳过恢复')
      return false
    }
    
    console.log('✅ [KnowledgeGraphView] 找到保存的状态:', {
      selectedSubject: savedState.selectedSubject,
      selectedTextbook: savedState.selectedTextbook,
      selectedChapterIndex: savedState.selectedChapterIndex,
      chaptersCount: savedState.chapters?.length || 0,
      chapterStructureCount: savedState.chapterStructure?.length || 0,
      timestamp: new Date(savedState.timestamp).toLocaleString()
    })
    
    // 恢复基本状态
    console.log('📝 [KnowledgeGraphView] 恢复基本状态...')
    selectedSubject.value = savedState.selectedSubject
    chapters.value = savedState.chapters
    chapterStructure.value = savedState.chapterStructure
    
    // 恢复教材选项：如果保存的状态中有教材选项，直接使用；否则从IndexedDB加载
    if (savedState.textbookOptions && savedState.textbookOptions.length > 0) {
      // 直接使用保存的教材选项
      textbookOptions.value = savedState.textbookOptions
      console.log('✅ [KnowledgeGraphView] 从保存状态恢复教材选项:', {
        数量: savedState.textbookOptions.length,
        选中的教材: savedState.selectedTextbook
      })
      
      // 验证并设置选中的教材
      const foundOption = savedState.textbookOptions.find(opt => opt.value === savedState.selectedTextbook)
      if (foundOption) {
        selectedTextbook.value = savedState.selectedTextbook
        console.log('✅ [KnowledgeGraphView] 教材选择器已恢复:', foundOption.label)
      } else {
        console.warn('⚠️ [KnowledgeGraphView] 保存的教材不在保存的选项中，使用第一个教材')
        if (savedState.textbookOptions.length > 0) {
          selectedTextbook.value = savedState.textbookOptions[0].value
        } else {
          selectedTextbook.value = ''
        }
      }
    } else {
      // 向后兼容：如果保存的状态中没有教材选项，从IndexedDB重新加载并筛选
      console.log('📚 [KnowledgeGraphView] 保存的状态中没有教材选项，从IndexedDB重新加载...')
      const localOptions = await loadTextbookDataFromIndexedDB()
      if (localOptions.length > 0) {
        // 根据恢复的学科筛选教材选项
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
        
        const subjectLabel = subjectMap[savedState.selectedSubject] || '数学'
        const filteredOptions = localOptions.filter(option => option.subject === subjectLabel)
        
        textbookOptions.value = filteredOptions
        console.log('✅ [KnowledgeGraphView] 教材选项加载完成:', {
          总数量: localOptions.length,
          筛选后数量: filteredOptions.length,
          学科: subjectLabel,
          选中的教材: savedState.selectedTextbook
        })
        
        // 验证恢复的教材是否在筛选后的选项中，然后设置选中的教材
        const foundOption = filteredOptions.find(opt => opt.value === savedState.selectedTextbook)
        if (!foundOption) {
          console.warn('⚠️ [KnowledgeGraphView] 保存的教材不在当前学科选项中，使用第一个教材')
          if (filteredOptions.length > 0) {
            selectedTextbook.value = filteredOptions[0].value
          } else {
            selectedTextbook.value = ''
          }
        } else {
          selectedTextbook.value = savedState.selectedTextbook
          console.log('✅ [KnowledgeGraphView] 教材选择器已恢复:', foundOption.label)
        }
      } else {
        console.log('⚠️ [KnowledgeGraphView] IndexedDB中没有教材选项')
        textbookOptions.value = []
        selectedTextbook.value = ''
      }
    }
    
    console.log('✅ [KnowledgeGraphView] 基本状态恢复完成:', {
      selectedSubject: selectedSubject.value,
      selectedTextbook: selectedTextbook.value,
      chaptersCount: chapters.value.length,
      chapterStructureCount: chapterStructure.value.length,
      textbookOptionsCount: textbookOptions.value.length
    })
    
    // 恢复章节状态
    if (savedState.selectedChapterIndex >= 0 && savedState.selectedChapterIndex < chapterStructure.value.length) {
      console.log('📖 [KnowledgeGraphView] 恢复章节状态...', {
        selectedChapterIndex: savedState.selectedChapterIndex,
        chapterName: savedState.selectedChapterDetails?.name || '未知'
      })
      
      setCurrentChapter(savedState.selectedChapterIndex)
      selectedChapterDetails.value = savedState.selectedChapterDetails
      
      // 恢复展开的知识图谱状态
      if (savedState.selectedChapterDetails) {
        const subChapters = getSubChapters(savedState.selectedChapterDetails)
        console.log('🔍 [KnowledgeGraphView] 子章节数量:', subChapters.length)
        
        if (subChapters.length > 0) {
          // 尝试恢复之前展开的图谱，如果不存在则自动展开位于targetAngle的图谱
          const previousExpandedGraph = getCurrentChapterExpandedGraph()
          console.log('🎯 [KnowledgeGraphView] 之前展开的图谱ID:', previousExpandedGraph)
          
          if (previousExpandedGraph && subChapters.some(sub => sub.id === previousExpandedGraph)) {
            console.log('✅ [KnowledgeGraphView] 恢复之前展开的图谱:', previousExpandedGraph)
            setCurrentChapterExpandedGraph(previousExpandedGraph)
          } else {
            // 如果没有之前保存的展开状态，自动展开位于targetAngle的图谱
            console.log('🔄 [KnowledgeGraphView] 没有之前保存的展开状态，自动展开位于targetAngle的图谱')
            await nextTick()
            autoPositionToNearestGraph()
          }
        }
      }
      
      console.log('✅ [KnowledgeGraphView] 章节状态恢复完成')
    } else {
      console.log('⚠️ [KnowledgeGraphView] 章节索引无效，跳过章节状态恢复:', {
        selectedChapterIndex: savedState.selectedChapterIndex,
        chapterStructureLength: chapterStructure.value.length
      })
    }
    
    console.log('🎉 [KnowledgeGraphView] 页面状态恢复完成')
    return true
  } catch (error) {
    console.error('❌ [KnowledgeGraphView] 状态恢复失败:', error)
    return false
  }
}

// 缓存键名常量 - 保留用于章节结构缓存
const CACHE_KEYS = {
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
  } catch {
    // 读取缓存失败，静默处理
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
  } catch {
    // 保存缓存失败，静默处理
  }
}

// 清理过期的缓存数据
const cleanupExpiredCache = () => {
  try {
    const keys = Object.keys(localStorage)
    const knowledgeGraphKeys = keys.filter(key => 
      key.startsWith('knowledge_graph_')
    )
    
    knowledgeGraphKeys.forEach(key => {
      const cached = localStorage.getItem(key)
      if (cached) {
        try {
          const data = JSON.parse(cached)
          if (data.timestamp && isCacheExpired(data.timestamp)) {
            localStorage.removeItem(key)
          }
        } catch {
          // 如果解析失败，删除这个键
          localStorage.removeItem(key)
        }
      }
    })
  } catch {
    // 清理缓存失败，静默处理
  }
}


// 获取缓存状态信息
const getCacheStatus = () => {
  try {
    const keys = Object.keys(localStorage)
    const knowledgeGraphKeys = keys.filter(key => key.startsWith('knowledge_graph_'))
    
    const status = {
      totalKeys: knowledgeGraphKeys.length,
      chapterStructures: knowledgeGraphKeys.filter(key => key.startsWith(CACHE_KEYS.CHAPTER_STRUCTURE)).length
    }
    
    return status
  } catch {
    return { totalKeys: 0, chapterStructures: 0 }
  }
}

// 从IndexedDB获取教材数据并转换为textbookOptions
const loadTextbookDataFromIndexedDB = async (): Promise<TextbookOption[]> => {
  try {
    // 从IndexedDB获取所有教材
    const textbooks = await resourceManager.getUserLocalTextbooks()
    
    if (textbooks && textbooks.length > 0) {
      // 将UserTextbookInfo转换为TextbookOption格式
      const options: TextbookOption[] = textbooks.map(textbook => ({
        value: `${textbook.textbookSubjectLabel}-${textbook.textbookGradeLabel}-${textbook.textbookSemesterLabel}-${textbook.id}`,
        label: `${textbook.textbookGradeLabel} ${textbook.textbookSemesterLabel} ${textbook.textbookSubjectLabel} ${textbook.textbookName}`,
        textbookId: textbook.textbookId,
        subject: textbook.textbookSubjectLabel,
        grade: textbook.textbookGradeLabel,
        semester: textbook.textbookSemesterLabel,
        publisher: textbook.textbookPublisher,
        cover: textbook.textbookCover
      }))
      
      return options
    }
    
    return []
  } catch {
    return []
  }
}


// 将API数据保存到IndexedDB
const saveTextbookDataToIndexedDB = async (versions: import('../types').TextbookVersion[]) => {
  try {
    // 将TextbookVersion转换为UserTextbookInfo格式并保存到IndexedDB
    for (const version of versions) {
      const textbookInfo: UserTextbookInfo = {
        id: version.id,
        textbookId: version.textbookId,
        textbookName: version.textbookName,
        textbookSubjectLabel: version.textbookSubjectLabel,
        textbookGradeLabel: version.textbookGradeLabel,
        textbookSemesterLabel: version.textbookSemesterLabel,
        textbookPublisher: version.textbookPublisher,
        textbookCover: version.textbookCover,
        textbookUpdateTime: version.textbookUpdateTime,
        textbookEditionYear: version.textbookEditionYear || '',
        textbookIsbn: version.textbookIsbn || '',
        isDownloaded: false,
        downloadStatus: 0,
        downloadedFiles: 0,
        totalFiles: 0,
        downloadPath: '',
        lastDownloadTime: '',
        learningPackages: [],
        structure: [],
        hasUpdatesAvailable: false,
        localFiles: [],
        updateStructure: () => {},
        updatePackages: () => {},
        getLocalResourceFileName: () => ''
      }
      
      await resourceManager.updateTextbookInfo(textbookInfo)
    }
  } catch {
    // 保存教材数据失败，静默处理
  }
}

// 根据学科筛选教材数据 - 使用IndexedDB
const loadTextbookDataBySubject = async (subjectValue: string) => {
  try {
    // 先尝试从IndexedDB加载
    const localOptions = await loadTextbookDataFromIndexedDB()
    
    if (localOptions.length > 0) {
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
      
      textbookOptions.value = localOptions.filter(option => option.subject === subjectLabel)
      
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
        // 清空章节数据
        chapterStructure.value = []
        chapters.value = []
        selectedChapterDetails.value = null
      }
      return
    }

    // IndexedDB中没有数据，从API获取
    const versions = await apiService.getTextbookVersions()
    
    if (versions && versions.length > 0) {
      const allOptions = apiService.convertToTextbookOptions(versions)
      
      // 将API数据保存到IndexedDB
      await saveTextbookDataToIndexedDB(versions)
      
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
        // 清空章节数据
        chapterStructure.value = []
        chapters.value = []
        selectedChapterDetails.value = null
      }
    } else {
      textbookOptions.value = []
      // 清空章节数据
      chapterStructure.value = []
      chapters.value = []
      selectedChapterDetails.value = null
    }
  } catch (error) {
    console.error('[流程2] 加载教材列表出错:', error)
    textbookOptions.value = []
    // 清空章节数据
    chapterStructure.value = []
    chapters.value = []
    selectedChapterDetails.value = null
  }
}

// 加载章节结构
const loadChapterStructure = async (textbookId: string) => {
  try {
    // 先尝试从缓存加载章节结构
    const cacheKey = `${CACHE_KEYS.CHAPTER_STRUCTURE}${textbookId}`
    
    const cachedChapterData = getCachedData(cacheKey)
    
    if (cachedChapterData) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = cachedChapterData
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = cachedChapterData.map((chapter: { name: string }) => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, cachedChapterData, getSubChapters)
      return
    }

    // 缓存中没有数据，从API获取
    const chapterData = await apiService.getTextbookStructure(textbookId)
    
    if (chapterData && chapterData.length > 0) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = chapterData
      
      // 缓存章节结构数据
      setCachedData(cacheKey, chapterData)
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = chapterData.map(chapter => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, chapterData, getSubChapters)
    } else {
      chapterStructure.value = []
      chapters.value = []
    }
  } catch (error) {
    console.error('[流程] ❌ 加载章节结构出错:', error)
    chapterStructure.value = []
    chapters.value = []
  }
}

// 性能监控工具
// 获取带用户ID前缀的性能数据存储key
const getPerfDataKey = () => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_perfData`
}

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
    const key = getPerfDataKey()
    const existingData = JSON.parse(localStorage.getItem(key) || '[]')
    existingData.push(perfData)
    
    // 只保留最近50条记录
    if (existingData.length > 50) {
      existingData.splice(0, existingData.length - 50)
    }
    
    localStorage.setItem(key, JSON.stringify(existingData))
  },
  
  // 获取性能统计
  getPerformanceStats(): {
    count: number
    average: number
    min: number
    max: number
    lastOperation: { operation: string; duration: number; timestamp: number }
  } | null {
    const key = getPerfDataKey()
    const perfData = JSON.parse(localStorage.getItem(key) || '[]')
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


// 第32步：初始化图谱
const initGraph = async () => {
  console.log('🚀 [KnowledgeGraphView] 开始初始化图谱...')
  loading.value = true
  
  try {
    // 使用智能认证，只在必要时重新登录
    console.log('🔐 [KnowledgeGraphView] 检查认证状态...')
    const authSuccess = await sessionManager.ensureAuthentication()
    
    if (!authSuccess) {
      console.error('❌ [KnowledgeGraphView] 认证失败，终止初始化')
      return
    }
    console.log('✅ [KnowledgeGraphView] 认证成功')
    
    // 第33步：优先尝试恢复保存的页面状态
    console.log('🔍 [KnowledgeGraphView] 尝试恢复保存的页面状态...')
    const stateRestored = await restorePageStateFromStore()
    
    if (stateRestored) {
      // 状态恢复成功，直接渲染图谱
      console.log('✅ [KnowledgeGraphView] 状态恢复成功，直接渲染图谱')
      await nextTick()
      renderGraph()
      console.log('✅ [KnowledgeGraphView] 图谱渲染完成（从状态恢复）')
      
      return
    }
    
    console.log('ℹ️ [KnowledgeGraphView] 状态恢复失败或没有保存的状态，开始新加载流程...')
    
    // 检查路由查询参数中是否有 textbookId
    const queryTextbookId = route.query.textbookId as string | undefined
    
    // 设置默认学科
    selectedSubject.value = 'math'
    
    // 根据科目加载教材数据
    await loadTextbookDataBySubject(selectedSubject.value)
    
    // 如果有教材数据，优先根据查询参数选择教材，否则选择第一个教材
    if (textbookOptions.value.length > 0) {
      let targetTextbook: TextbookOption | undefined
      
      // 如果路由查询参数中有 textbookId，尝试查找对应的教材
      if (queryTextbookId) {
        targetTextbook = textbookOptions.value.find(
          opt => opt.textbookId === queryTextbookId || opt.value.includes(queryTextbookId)
        )
      }
      
      // 如果没有找到，使用第一个教材
      if (!targetTextbook) {
        targetTextbook = textbookOptions.value[0]
      }
      
      selectedTextbook.value = targetTextbook.value
      
      // 第34步：加载选中教材的章节结构
      if (targetTextbook.textbookId && targetTextbook.textbookId !== 'default') {
        await loadChapterStructure(targetTextbook.textbookId)
        
        // 自动选择第一个章节
        if (chapterStructure.value.length > 0) {
          setCurrentChapter(0)
          selectedChapterDetails.value = chapterStructure.value[0]
          
          // 初始状态下自动展开位于targetAngle的图谱
          await nextTick()
          autoPositionToNearestGraph()
        }
      }
    }
    
    // 初始化图谱数据（但不重置已选择的章节）
    console.log('🔧 [KnowledgeGraphView] 初始化图谱数据...')
    initGraphDataWithoutReset()
    
    // 这里可以集成真实的图谱库，如 vis.js, d3.js, cytoscape.js 等
    // 目前使用简单的DOM渲染
    await nextTick()
    renderGraph()
    console.log('✅ [KnowledgeGraphView] 图谱渲染完成（新加载）')
    
  } catch (error) {
    // 图谱初始化失败，静默处理
    console.error('❌ [KnowledgeGraphView] 图谱初始化失败:', error)
  } finally {
    loading.value = false
    console.log('🏁 [KnowledgeGraphView] 初始化流程结束')
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
    // 先清空旧的教材和章节数据
    textbookOptions.value = []
    selectedTextbook.value = ''
    chapterStructure.value = []
    chapters.value = []
    selectedChapterDetails.value = null
    
    // 根据学科筛选教材选项（内部会自动加载第一个教材的章节结构）
    await loadTextbookDataBySubject(subjectValue)
    
    // 如果有教材数据，确保章节数据已加载并自动选择第一个章节
    if (textbookOptions.value.length > 0 && chapterStructure.value.length > 0) {
      // 自动选择第一个章节
      setCurrentChapter(0)
      selectedChapterDetails.value = chapterStructure.value[0]
      
      // 自动展开位于targetAngle的图谱
      await nextTick()
      autoPositionToNearestGraph()
    }
    
    // 初始化图谱数据（但不重置已选择的章节）
    initGraphDataWithoutReset()
    
  } catch {
    // 出错时也要清空数据
    textbookOptions.value = []
    selectedTextbook.value = ''
    chapterStructure.value = []
    chapters.value = []
    selectedChapterDetails.value = null
  }
}

// 第35步：教材切换
const onTextbookChange = async (value: string) => {
  try {
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
        
        // 自动展开位于targetAngle的图谱
        await nextTick()
        autoPositionToNearestGraph()
      }
    }
    
    // 初始化图谱数据（但不重置已选择的章节）
    initGraphDataWithoutReset()
    
    renderGraph()
    
  } catch {
    // 切换教材失败
  }
}

// 第5步：添加搜索处理方法
const handleSearchInput = () => {
  // 搜索输入时不需要额外处理，computed会自动更新
}

// 第6步：清空搜索
const clearSearch = () => {
  searchQuery.value = ''
}

// 切换节点搜索框显示/隐藏
const toggleNodeSearch = () => {
  showNodeSearch.value = !showNodeSearch.value
  // 如果关闭搜索，清空搜索内容
  if (!showNodeSearch.value) {
    searchQuery.value = ''
  }
}

// 拍照搜题处理
const handlePhotoSearch = () => {
  // 直接弹出 PhotoSearchDialog
  showPhotoSearchDialog.value = true
}

// 处理拍照搜题重新选择图片
const handlePhotoSearchRetake = () => {
  // 直接重新打开 PhotoSearchDialog（内部会自动重置状态）
  showPhotoSearchDialog.value = true
}

// 处理拍照搜题选中题目
const handlePhotoSearchQuestionSelected = () => {
  // 题目已通过 QuestionList 的 question-selected 事件自动选中并持久化
  // 这里可以添加额外的处理逻辑，比如关闭对话框
  showPhotoSearchDialog.value = false
  showMessage('题目已添加到列表', 'success')
}

// 第7步：处理搜索结果点击
const handleSearchResultClick = async (result: {
  node: ChapterNode
  chapterIndex: number
  chapterName: string
}) => {
  // 第1步：如果节点在其他章节，先跳转到对应章节
  const currentChapterIndex = getCurrentChapter()
  if (currentChapterIndex !== result.chapterIndex) {
    selectChapter(result.chapterIndex)
    
    // 等待章节切换完成
    await nextTick()
    
    // 更新selectedChapterDetails（因为selectChapter可能还没完全更新）
    if (chapterStructure.value && chapterStructure.value.length > result.chapterIndex) {
      selectedChapterDetails.value = chapterStructure.value[result.chapterIndex]
    }
    
    // 再次等待DOM更新
    await nextTick()
  }
  
  // 第2步：获取当前章节的子章节列表
  const chapter = chapterStructure.value[result.chapterIndex]
  if (!chapter) {
    return
  }
  
  const subChapters = getSubChapters(chapter)
  
  // 第3步：查找节点在子章节列表中的索引
  // 如果节点本身是level=1的子章节，直接使用其ID
  // 如果节点是更深层的子节点，需要找到其父节点（level=1的子章节）
  let targetNodeId: string | null = null
  
  // 如果节点是章节点本身（level=0），不需要旋转
  if (result.node.level === 0) {
    // 清空搜索并返回，只跳转到章节
    searchQuery.value = ''
    return
  }
  
  if (result.node.level === 1) {
    // 节点本身就是level=1的子章节
    targetNodeId = result.node.id
  } else if (result.node.level !== null && result.node.level > 1) {
    // 节点是更深层的子节点，需要找到其level=1的父节点
    // 向上查找parentId，直到找到level=1的节点
    let currentNode: ChapterNode | null = result.node
    while (currentNode && currentNode.level !== 1 && currentNode.level !== null) {
      if (currentNode.parentId) {
        // 在当前章节的所有节点中查找父节点
        const findNodeById = (nodes: ChapterNode[]): ChapterNode | null => {
          for (const node of nodes) {
            if (node.id === currentNode?.parentId) {
              return node
            }
            if (node.children) {
              const found = findNodeById(node.children)
              if (found) return found
            }
          }
          return null
        }
        
        currentNode = findNodeById(chapter.children || [])
        if (!currentNode) {
          break
        }
      } else {
        break
      }
    }
    
    if (currentNode && currentNode.level === 1) {
      targetNodeId = currentNode.id
    }
  }
  
  // 第4步：如果找到了目标节点ID，旋转到targetAngle
  if (targetNodeId) {
    const targetIndex = subChapters.findIndex(sub => sub.id === targetNodeId)
    if (targetIndex !== -1) {
      // 确保当前章节详情已更新
      if (!selectedChapterDetails.value) {
        selectedChapterDetails.value = chapter
      }
      
      // 等待DOM更新
      await nextTick()
      
      // 设置展开状态并旋转到targetAngle
      setCurrentChapterExpandedGraph(targetNodeId)
      await nextTick()
      startExpandingRotation(targetNodeId)
      
      // 清空搜索
      searchQuery.value = ''
    }
  }
}

// 第8步：高亮匹配文本
const highlightText = (text: string): string => {
  if (!searchQuery.value.trim()) {
    return text
  }
  
  const query = searchQuery.value.trim()
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

// 选择章节
const selectChapter = async (index: number) => {
  
  // 第8步：重复点击检测：检查是否点击的是当前已选中的章节
  const currentChapterIndex = getCurrentChapter()
  if (currentChapterIndex === index) {
    return
  }
  
  setCurrentChapter(index)
  
  // 获取选中章节的详细信息
  if (chapterStructure.value && chapterStructure.value.length > index) {
    selectedChapterDetails.value = chapterStructure.value[index]
    
    // 自动展开位于targetAngle的图谱
    await nextTick()
    autoPositionToNearestGraph()
    
    // 输出新章节的角度分布
    nextTick(() => {
      logAngleDistribution()
    })
  }
}

// 处理学习对话框
const handleLearnDialog = (node: { id: string; name: string; level?: number | null }) => {
  // 设置对话框数据
  learningDialogData.value = {
    nodeId: node.id,
    sectionName: node.name,
    level: node.level || 1,
    textbookId: getCurrentTextbookId()
  }
  
  // 显示对话框
  learningDialogVisible.value = true
}

// 处理学习对话框关闭
const handleLearningDialogClose = (value: boolean) => {
  if (!value) {
    // 对话框关闭时清空数据
    learningDialogData.value = null
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

// 第1步：根据触摸点位置计算当前在哪个指示器上
const getIndicatorIndexFromTouch = (touchY: number): number | null => {
  if (!indicatorContainerRef.value || !selectedChapterDetails.value) return null
  
  // 获取所有指示器圆点的 DOM 元素
  const indicatorDots = indicatorContainerRef.value.querySelectorAll('.indicator-dot')
  if (indicatorDots.length === 0) return null
  
  // 找到距离触摸点最近的指示器
  let minDistance = Infinity
  let nearestIndex = 0
  
  indicatorDots.forEach((dot, index) => {
    const dotRect = dot.getBoundingClientRect()
    const dotCenterY = dotRect.top + dotRect.height / 2
    const distance = Math.abs(touchY - dotCenterY)
    
    if (distance < minDistance) {
      minDistance = distance
      nearestIndex = index
    }
  })
  
  return nearestIndex
}

// 第2步：处理指示器触摸开始事件
const handleIndicatorTouchStart = (event: TouchEvent) => {
  if (!indicatorContainerRef.value || !selectedChapterDetails.value) return
  
  // 阻止事件冒泡，避免触发其他滚动事件
  event.stopPropagation()
  
  // 设置指示器滑动状态
  isIndicatorDragging.value = true
  
  // 获取触摸点位置，计算当前在哪个指示器上
  const touchY = event.touches[0].clientY
  const index = getIndicatorIndexFromTouch(touchY)
  
  if (index === null) return
  
  indicatorCurrentIndex.value = index
  
  // 立即切换到对应的知识图谱
  const subChapters = getSubChapters(selectedChapterDetails.value)
  if (index >= 0 && index < subChapters.length) {
    const targetGraphId = subChapters[index].id
    if (getCurrentChapterExpandedGraph() !== targetGraphId) {
      // 重置拖拽状态
      resetDraggingState()
      
      // 设置展开状态
      setCurrentChapterExpandedGraph(targetGraphId)
      
      // 开始展开旋转动画
      startExpandingRotation(targetGraphId)
    }
  }
}

// 第3步：处理指示器触摸移动事件
const handleIndicatorTouchMove = (event: TouchEvent) => {
  if (!indicatorContainerRef.value || !selectedChapterDetails.value || !isIndicatorDragging.value) return
  
  // 阻止事件冒泡
  event.stopPropagation()
  event.preventDefault()
  
  // 获取触摸点位置，计算当前在哪个指示器上
  const touchY = event.touches[0].clientY
  const index = getIndicatorIndexFromTouch(touchY)
  
  if (index === null) return
  
  // 如果滑动到了新的指示器，切换到对应的知识图谱
  if (indicatorCurrentIndex.value !== index) {
    indicatorCurrentIndex.value = index
    
    const subChapters = getSubChapters(selectedChapterDetails.value)
    if (index >= 0 && index < subChapters.length) {
      const targetGraphId = subChapters[index].id
      if (getCurrentChapterExpandedGraph() !== targetGraphId) {
        // 重置拖拽状态
        resetDraggingState()
        
        // 设置展开状态
        setCurrentChapterExpandedGraph(targetGraphId)
        
        // 开始展开旋转动画
        startExpandingRotation(targetGraphId)
      }
    }
  }
}

// 第4步：处理指示器触摸结束事件
const handleIndicatorTouchEnd = (event: TouchEvent) => {
  if (!isIndicatorDragging.value) return
  
  // 阻止事件冒泡
  event.stopPropagation()
  
  // 清理状态
  isIndicatorDragging.value = false
  indicatorCurrentIndex.value = null
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
    return
  }
}


// 获取子章节（x.x格式的小节）
const getSubChapters = (chapterDetails: ChapterNode | null) => {
  // 如果没有章节详情，返回空数组
  if (!chapterDetails) {
    return []
  }
  
  // 过滤出level=1的子章节（x.x格式）
  // 如果children为null或undefined，subChapters为空数组
  // 直接使用后台返回的顺序，不进行排序
  const subChapters = chapterDetails.children?.filter(child => child.level === 1) || []
  
  // 为每个章节添加章节练习节点，使用章的名字
  const exerciseNode: ChapterNode = {
    id: chapterDetails.id, // 直接使用父章节ID
    name: chapterDetails.name, // 使用章的名字
    parentId: chapterDetails.id,
    label: chapterDetails.name, // 使用章的名字
    level: 1, // 确保是x.x层级
    isRoot: false,
    updateTime: new Date().toISOString(),
    children: []
  }
  
  // 将章节练习节点添加到子章节列表的末尾
  return [...subChapters, exerciseNode]
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
      const { x, y } = calculateCircularTrackPosition(angle)
      return {
        transform: `translate(${x}px, ${y}px)`,
        position: 'absolute' as const,
        left: '50%',
        top: '50%',
        marginLeft: `-${debugParams.value.graphMargin}px`,
        marginTop: `-${debugParams.value.graphMargin}px`,
        opacity: debugParams.value.opacityExpanded, // 展开的知识图谱透明度
        zIndex: 2000, // 展开的知识图谱获得最高层级，确保其圆周节点不被其他知识图谱覆盖
        transition: isDragging.value ? 'none' : 
                    isExpandingRotation.value ? 'none' :
                    isCollapsing.value ? 'none' :
                    combinedTransition.value
      }
    } else {
      // 其他知识图谱在轨道上平滑移动且不展开
      const { currentAngle: expandedAngle } = calculateCircularTrackAngle(expandedIndex, total)
      let angleDiff = Math.abs(angle - expandedAngle)
      
      // 处理椭圆轨迹首尾相接的边界情况（角度跨越0度/360度）
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff
      }
      
      // 第1步：从调试参数中获取影响范围
      const influenceRange = debugParams.value.influenceRange
      
      // 第2步：检查是否在影响范围内
      if (angleDiff < influenceRange) {
        // 第3步：计算距离因子：距离越近，推开角度越大
        const distanceFactor = 1 - (angleDiff / influenceRange)
        // 第4步：从调试参数中获取最大推开角度，使用二次缓动函数实现距离越近推得越远的效果
        const maxPushAngle = debugParams.value.maxPushAngle
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
        
        const { x, y } = calculateCircularTrackPosition(adjustedAngle)
        
        // 计算缩放和透明度 - 距离展开图谱越近，透明度越低
        const scale = 1 - (distanceFactor * debugParams.value.scaleFactor) // 缩放幅度
        const opacity = debugParams.value.opacityNearMin + (distanceFactor * debugParams.value.opacityNearFactor) // 距离相关透明度
        
        // 计算动画延迟 - 距离越近延迟越短，移动更同步
        const animationDelay = distanceFactor * debugParams.value.animationDelayFactor
        
        // 计算与展开图谱的索引距离，距离越小，z-index越大
        const indexDistance = Math.abs(index - expandedIndex)
        
        return {
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          marginLeft: `-${debugParams.value.graphMargin}px`,
          marginTop: `-${debugParams.value.graphMargin}px`,
          opacity: opacity,
          zIndex: 1000 - indexDistance, // 根据与展开图谱的索引距离计算：越接近展开图谱，z-index越大
          // 与定位动画同步：减少延迟时间，让远离动画与定位动画同时进行
          transition: isDragging.value ? 'none' : 
            isExpandingRotation.value ? 'none' :
            isCollapsing.value ? 'none' :
            `${transformTransition.value} ${animationDelay}s, 
             ${opacityTransition.value} ${animationDelay}s`
        }
      } else {
        // 距离展开图谱较远的节点，保持当前位置但变为半透明
        const { x, y } = calculateCircularTrackPosition(angle)
        
        // 计算与展开图谱的索引距离，距离越小，z-index越大
        const indexDistance = Math.abs(index - expandedIndex)
        
        return {
          transform: `translate(${x}px, ${y}px)`,
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          marginLeft: `-${debugParams.value.graphMargin}px`,
          marginTop: `-${debugParams.value.graphMargin}px`,
          opacity: debugParams.value.opacityFar, // 距离较远的节点透明度
          zIndex: 1000 - indexDistance, // 根据与展开图谱的索引距离计算：越接近展开图谱，z-index越大
          transition: isDragging.value ? 'none' : 
            isExpandingRotation.value ? 'none' :
            isCollapsing.value ? 'none' :
            `${transformTransition.value}, ${opacityTransition.value} 0.1s`
        }
      }
    }
  }
  
  // 默认椭圆轨迹位置计算
  const { x, y } = calculateCircularTrackPosition(angle)
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    marginLeft: `-${debugParams.value.graphMargin}px`,
    marginTop: `-${debugParams.value.graphMargin}px`,
    opacity: debugParams.value.opacityDefault, // 默认状态下透明度
    zIndex: 1000 - index, // 反向层级：前面的节点层级更高，确保可点击
    transition: isDragging.value ? 'none' : 
                isAnimating.value ? 'none' : 
                isExpandingRotation.value ? 'none' :
                isCollapsing.value ? combinedTransition.value :
                transformTransition.value
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
    calculateCircularTrackPosition(calculateCircularTrackAngle(i, total).currentAngle)
  }
}

// 通过 provide 传递知识图谱角度数据给调试面板（在所有函数定义之后）
provide('knowledgeGraphAngleData', {
  selectedChapterDetails,
  getSubChapters,
  calculateCircularTrackAngle,
  getChapterRotation,
  getCurrentChapter
})


// 组件挂载时初始化
onMounted(async () => {
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
  
  // 初始化章节列表 BScroll
  await initChapterListBScroll()
  
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
  // 保存页面状态
  saveCurrentPageState()
  
  // 清理动画状态
  cleanupAnimations()
})
</script>

<style lang="scss" scoped>
.knowledge-graph-content {
  display: flex;
  height: 100vh;
  background-repeat: no-repeat;
  background-position: center center;
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
  
  .scroll-wrapper.chapter-list {
    flex: 1;
    overflow: hidden;
    margin-top: 16px;
    
    .scroll-content {
      min-height: calc(100% + 1px);
    }
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
    width: 98px;
    height: 79px;
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

// 第9步：添加搜索框样式
.chapter-search {
  padding: 6px 5px;
  margin: 14px 20px;
  border-radius: 12px;
  font-family: 'PingFang SC', sans-serif;
  
  .search-input {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    
    :deep(.q-field__control) {
      border-radius: 12px;
      border: 1px solid rgba(227, 224, 235, 0.3);
      background: rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
      min-height: 44px; // 增加触摸区域
      
      &:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(227, 224, 235, 0.4);
      }
      
      &:focus-within {
        border-color: rgba(139, 92, 246, 0.5);
        background: rgba(255, 255, 255, 0.15);
      }
    }
    
    :deep(.q-field__native) {
      color: #FFFFFF;
      padding: 8px 12px;
      font-size: 16px; // 移动端避免自动缩放
    }
    
    :deep(.q-placeholder) {
      color: rgba(255, 255, 255, 0.6);
    }
  }
  
  // 触摸目标优化
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:active {
      transform: scale(0.95);
    }
  }
}

// 第10步：搜索高亮样式
:deep(.search-highlight) {
  background: rgba(255, 215, 0, 0.4);
  color: #ffffff;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
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
  min-height: 44px; // 增加触摸区域
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
  // 第11步：平滑滚动
  scroll-behavior: smooth;
  // 移动端优化
  -webkit-overflow-scrolling: touch;
  
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
    min-height: 44px; // 第12步：增加触摸区域
    display: flex;
    align-items: center;
    // 触摸反馈优化
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    
    &.active {
      background-color: #e0dbff;
      
      .chapter-text {
        color: #393548;
      }
    }
    
    &:hover:not(.active) {
      background: #f3f4f6;
    }
    
    // 第13步：触摸状态
    &:active {
      transform: scale(0.98);
      transition: transform 0.1s ease;
    }
    
    .chapter-text {
      font-size: 19px;
      font-weight: 500;
      color: #9E9AAD;
      line-height: 1.4;
    }
    
    // 搜索结果样式
    &.search-result-item {
      flex-direction: column;
      align-items: flex-start;
      padding: 12px 15px;
      
      .search-result-content {
        width: 100%;
        
        .search-result-node {
          font-size: 18px;
          font-weight: 500;
          color: #393548;
          line-height: 1.5;
          margin-bottom: 4px;
        }
        
        .search-result-chapter {
          font-size: 14px;
          color: #9ca3af;
          line-height: 1.4;
        }
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
  position: relative;
}

// 右上角工具栏
.top-right-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  gap: 12px;
  align-items: center;
  
  .toolbar-icon-btn {
    width: 48px;
    height: 48px;
    padding: 0;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.05);
    }
    
    &:active {
      transform: scale(0.95);
    }
    
    .toolbar-icon {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
  }
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
  touch-action: pan-y; // 第23步：允许垂直滑动，提高触摸响应
  z-index: 100; // 设置基础层级
  // 移动端优化
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  
  &:active {
    cursor: grabbing;
  }
  
  // 当有图谱展开时，禁用滚动交互
  &.scroll-disabled {
    cursor: default;
    touch-action: none;
    
    &:active {
      cursor: default;
    }
  }
  
  // 第24步：移动端响应式优化
  @media (max-width: 768px) {
    // 移动端增加可交互区域
    padding: 20px;
    margin: -20px;
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
    // 第25步：移动端触控优化
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    // 增加触摸区域
    padding: 12px;
    margin: -12px;
    
    &:hover {
      background: rgba(139, 92, 246, 0.5);
      transform: scale(1.1);
    }
    
    &:active {
      transform: scale(0.95);
      transition: transform 0.1s ease;
    }
    
    &.active {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6d28d9 100%);
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
      position: relative;
    }
    
    // 移动端增大触摸区域
    @media (max-width: 768px) {
      width: 28px;
      height: 28px;
      
      &.active {
        width: 44px;
        height: 44px;
      }
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
  /* width 和 height 通过 style 绑定动态设置 */
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
  position: relative;
  z-index: 50; // 降低层级，确保知识图谱气泡不被遮挡
  
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

// 学习对话框样式
.learning-dialog-card {
  background: #ffffff;
  border-radius: 12px;
  width: 90vw;
  max-width: 1400px;
  height: 85vh;
  max-height: 900px;
  min-width: 800px;
  min-height: 600px;
  padding: 0;
  overflow: hidden;
  aspect-ratio: 16/10;
}
</style>
