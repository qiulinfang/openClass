<template>
  <div class="knowledge-graph-content" :style="{ backgroundImage: `url(${backgroundImage})` }">
    <!-- 第二列：章节目录/内容导航（中间） -->
    <div class="chapter-sidebar">
      <!-- 科目和版本信息 -->
      <div class="subject-header">
        <img :src="bookIcon" class="subject-icon" />
        <CommonSelect
          v-model="selectedSubject"
          :options="subjectOptions"
          class="subject-select"
          placeholder="请选择学科"
          @change="onSubjectChange"
        />
      </div>
      <!-- 教材选择器 -->
      <div class="textbook-info" v-if="textbookOptions.length > 0">
        <CommonSelect
          v-model="selectedTextbook"
          :options="textbookOptions"
          class="textbook-select"
          placeholder="请选择教材"
          @change="onTextbookChange"
        >
          <template #label>
            {{ selectedTextbookLabel }}
          </template>
        </CommonSelect>
      </div>

      <!-- 添加节点搜索框 -->
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
      <RubberBandList class="chapter-list">
        <!-- 显示搜索结果 -->
        <template v-if="searchQuery && searchResults.length > 0">
          <div
            v-for="result in searchResults"
            :key="`${result.chapterIndex}-${result.node.id}`"
            class="chapter-item touch-target search-result-item"
            @click="handleSearchResultClick(result)"
          >
            <div class="search-result-content">
              <div
                class="search-result-node"
                v-html="highlightText(result.node.name || result.node.label)"
              ></div>
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
            <div class="empty-text">未下载任何教材</div>
          </div>
          <div
            v-else
            v-for="item in filteredChapters"
            :key="item.index"
            class="chapter-item touch-target"
            :class="{ active: item.index === getCurrentChapter() }"
            @click="selectChapter(item.index)"
          >
            <span class="chapter-text" v-html="highlightText(convertBrackets(item.chapter))"></span>
          </div>
        </template>
      </RubberBandList>
    </div>

    <!-- 第三列：核心内容/知识图谱（最右侧） -->
    <div class="main-content">
      <!-- 右上角工具栏 -->
      <div class="top-right-toolbar">
        <q-btn flat round dense class="toolbar-icon-btn" @click="toggleNodeSearch">
          <img :src="chapterSearchIcon" alt="搜索节点" class="toolbar-icon" />
          <q-tooltip>搜索节点</q-tooltip>
        </q-btn>
      </div>

      <!-- 银河知识图谱容器（使用 newGrap 替换原环形多图） -->
      <div class="circular-graphs-container" v-if="newGrapData">
        <NewGrap ref="newGrapRef" :data="newGrapData" @action="handleNewGrapAction" />
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
      :chapter-grade="learningDialogData.chapterGrade"
      :chapter-subject="learningDialogData.chapterSubject"
      :chapter-textbook="learningDialogData.chapterTextbook"
      :chapter-title="learningDialogData.chapterTitle"
      @update:model-value="handleLearningDialogClose"
    />

    <!-- 学习状态控制面板 - 只在开发场景下显示 -->
    <LearningStatusControlPanel
      v-if="isDev"
      v-model="learningStatusPanelVisible"
      :chapter-structure="chapterStructure"
      @refresh="handleLearningStatusRefresh"
    />
  </div>
</template>

<script setup lang="ts">
// Component name
defineOptions({
  name: 'knowledgeGraph',
})
import { ref, onMounted, nextTick, computed, onUnmounted, provide, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiService } from '../services/http/api-service'
import { resourceManager } from '../services/storage/resource-storage'
import type { TextbookOption, ChapterNode, UserTextbookInfo } from '../types'
import NewGrap from '../components/knowledge-graph/newGrap.vue'
import RubberBandList from '../components/base/VirtualList.vue'
import CommonSelect from '@/components/base/Select.vue'
import LearningView from './LearningView.vue'
import LearningStatusControlPanel from '../components/debug/LearningStatusControlPanel.vue'
import { useKnowledgeGraphStore } from '../stores/KnowledgeGraphStore'
import { getUserId, getScopedStorageValue, isYanbanLoggedIn } from '../services'
import { showMessage } from '../utils'
import {
  KNOWLEDGE_GRAPH_SUBJECT_OPTIONS,
  type ApiSubjectType,
} from '../constants/subjects'
import {
  queryShijingshanKnowledgeId,
  queryShijingshanBmNoList,
} from '../utils/business/shijingshan-knowledge-utils'
import { convertToChineseNumber } from '../utils/business/chapter-utils'
// 流程：导入图标资源
import bookIcon from '/images/book.png'
import notLearnedStarIcon from '/icons/notLearnedStar.svg'
import learnedStarIcon from '/icons/learnedStar.svg'
import lastLearnedStarIcon from '/icons/lastLearnedStar.svg'
import backgroundImage from '/icons/background.svg'
import chapterSearchIcon from '/icons/chapter_search.svg'

// ========== 学习状态：沿用旧 KnowledgeGraph 逻辑（lastLearned / learned / notLearned） ==========

const lastLearnedNodeId = ref<string | null>(null)
const learnedNodeIds = ref<Set<string>>(new Set())

const getLastLearnedNodeKey = () => {
  const userId = getUserId()
  return `${userId}_LAST_LEARNED_NODE_ID`
}

const getLearnedNodesKey = () => {
  const userId = getUserId()
  return `${userId}_LEARNED_NODES`
}

const loadLastLearnedNodeId = () => {
  try {
    const key = getLastLearnedNodeKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      lastLearnedNodeId.value = saved
    }
  } catch (error) {
    console.error('加载最后学习的节点ID失败:', error)
  }
}

const loadLearnedNodeIds = () => {
  try {
    const key = getLearnedNodesKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      const ids = JSON.parse(saved) as string[]
      learnedNodeIds.value = new Set(ids)
    }
  } catch (error) {
    console.error('加载已学习的节点ID列表失败:', error)
    learnedNodeIds.value = new Set()
  }
}

// 供外部调用的刷新方法（保持与旧逻辑一致）
const refreshLearningStatusFromStorage = () => {
  loadLastLearnedNodeId()
  loadLearnedNodeIds()
}

// 计算节点学习状态
const getLearningStatus = (child: { id: string }): 'notLearned' | 'learned' | 'lastLearned' => {
  if (lastLearnedNodeId.value === child.id) return 'lastLearned'
  if (learnedNodeIds.value.has(child.id)) return 'learned'
  return 'notLearned'
}

// 保存最后学习的节点ID到 localStorage
const saveLastLearnedNodeId = (nodeId: string) => {
  try {
    lastLearnedNodeId.value = nodeId
    const key = getLastLearnedNodeKey()
    localStorage.setItem(key, nodeId)
  } catch (error) {
    console.error('保存最后学习的节点ID失败:', error)
  }
}

// 判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'
// 使用统一的章节状态管理
const {
  setCurrentChapter,
  setCurrentTextbook,
  getCurrentTextbook,
  getChapterRotation,
  getCurrentChapterExpandedGraph,
  setCurrentChapterExpandedGraph,
  initializeChapterStates,
  getCurrentChapter,
  savePageState,
  restorePageState,
  getCurrentSubject,
} = useKnowledgeGraphStore()

// 获取路由实例
const route = useRoute()
const router = useRouter()

// 添加搜索相关的响应式数据
const searchQuery = ref('')

// 处理搜索输入
const handleSearchInput = (value: string | number | null) => {
  searchQuery.value = String(value || '')
}
const showNodeSearch = ref(false) // 控制搜索框显示/隐藏

// 章节数据
const chapters = ref<string[]>([])
const chapterStructure = ref<ChapterNode[]>([])

// ========== newGrap 数据映射：ChapterNode -> Chapter/Section/KnowledgePoint ==========

interface NewGrapKnowledgePoint {
  id: string
  name: string
  label?: string
  level?: number
  learningStatus?: 'notLearned' | 'learned' | 'lastLearned'
}

interface NewGrapSection {
  id: string
  name: string
  label?: string
  level?: number
  children?: NewGrapKnowledgePoint[]
  learningStatus?: 'notLearned' | 'learned' | 'lastLearned'
}

interface NewGrapChapter {
  id: string
  name: string
  label?: string
  level?: number
  children?: NewGrapSection[]
}

const mapToNewGrapChapter = (root: ChapterNode | null): NewGrapChapter | null => {
  if (!root) return null

  const chapter: NewGrapChapter = {
    id: root.id,
    name: root.name || root.label || '',
    label: root.label,
    level: root.level ?? 0,
    children: [],
  }

  const sections: NewGrapSection[] = (root.children || []).map((sec, secIndex) => {
    const section: NewGrapSection = {
      id: sec.id,
      name: sec.name || sec.label || `小节 ${secIndex + 1}`,
      label: sec.label,
      level: sec.level ?? 1,
      children: [],
    }

    const hasChildren = sec.children && sec.children.length > 0

    if (hasChildren) {
      // 有知识点：按知识点学习状态聚合
      const kpList: NewGrapKnowledgePoint[] = (sec.children || []).map((kp, kpIndex) => ({
        id: kp.id,
        name: kp.name || kp.label || `知识点 ${kpIndex + 1}`,
        label: kp.label,
        level: kp.level ?? 2,
        learningStatus: getLearningStatus(kp),
      }))

      section.children = kpList

      if (kpList.some((kp) => kp.learningStatus === 'lastLearned')) {
        section.learningStatus = 'lastLearned'
      } else if (kpList.some((kp) => kp.learningStatus === 'learned')) {
        section.learningStatus = 'learned'
      } else {
        section.learningStatus = 'notLearned'
      }
    } else {
      // 没有任何知识点：直接用章节本身的 id 和 lastLearnedNodeId 比较
      const status = getLearningStatus(sec) // 注意这里传的是 sec（章节节点）
      section.learningStatus = status
    }

    return section
  })

  chapter.children = sections
  return chapter
}

const newGrapData = computed(() => {
  if (!selectedChapterDetails.value) return null
  return mapToNewGrapChapter(selectedChapterDetails.value)
})

// 递归收集所有节点（包括所有层级的子节点）
const collectAllNodes = (
  chapter: ChapterNode,
  chapterIndex: number
): Array<{
  node: ChapterNode
  chapterIndex: number
  chapterName: string
}> => {
  const results: Array<{
    node: ChapterNode
    chapterIndex: number
    chapterName: string
  }> = []

  // 添加当前节点
  const chapterName = chapters.value[chapterIndex] || chapter.name
  results.push({
    node: chapter,
    chapterIndex,
    chapterName,
  })

  // 递归处理子节点
  const collectChildren = (node: ChapterNode) => {
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        results.push({
          node: child,
          chapterIndex,
          chapterName,
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

  // 收集所有章节的所有节点
  const allNodes: Array<{
    node: ChapterNode
    chapterIndex: number
    chapterName: string
  }> = []

  chapterStructure.value.forEach((chapter, index) => {
    const nodes = collectAllNodes(chapter, index)
    allNodes.push(...nodes)
  })

  // 模糊搜索节点（搜索name和label）
  const query = searchQuery.value.trim().toLowerCase()
  return allNodes.filter((item) => {
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
        index,
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
  chapterGrade?: string
  chapterSubject?: string
  chapterTextbook?: string
  chapterTitle?: string
} | null>(null)

// newGrap 组件引用，用于从外部调用其暴露的方法（如 focusOnNodeId）
const newGrapRef = ref<InstanceType<typeof NewGrap> | null>(null)

// newGrap 气泡动作统一入口
const handleNewGrapAction = (payload: { type: 'learn' | 'practice'; data: any }) => {
  const { type, data } = payload
  if (!data) return

  if (type === 'learn') {
    handleLearnFromKnowledgeGraph(data)
  } else if (type === 'practice') {
    handlePracticeFromKnowledgeGraph(data)
  }
}

// 检查本地学习方案数据（从 KnowledgeGraph.vue 复制过来，略作适配）
const checkLocalLearningPackages = async (
  textbookRecordId: string
): Promise<{ hasPackages: boolean; reason: 'no_packages' | 'not_downloaded' | 'error' }> => {
  try {
    if (!textbookRecordId) {
      console.warn('教材记录ID为空，无法检查学习方案')
      return { hasPackages: false, reason: 'error' }
    }

    const textbooks = await resourceManager.getUserLocalTextbooks()
    console.log('textbooks', textbooks)
    const textbook = textbooks.find((t) => t.id === textbookRecordId)

    if (!textbook) {
      return { hasPackages: false, reason: 'not_downloaded' }
    }

    const hasLocalFiles = Boolean(textbook.localFiles && textbook.localFiles.length > 0)
    if (!hasLocalFiles) {
      return { hasPackages: false, reason: 'not_downloaded' }
    }

    const sampleFiles = textbook.localFiles.slice(0, Math.min(3, textbook.localFiles.length))
    let hasActualFileData = false
    for (const file of sampleFiles) {
      const fileExists = await resourceManager.hasFileData(textbook.id, file.id)
      if (fileExists) {
        hasActualFileData = true
        break
      }
    }

    if (!hasActualFileData && textbook.localFiles.length > 0) {
      return { hasPackages: false, reason: 'not_downloaded' }
    }

    const hasLearningPackages = Boolean(
      textbook.learningPackages && textbook.learningPackages.length > 0
    )
    if (!hasLearningPackages) {
      return { hasPackages: false, reason: 'no_packages' }
    }

    return { hasPackages: true, reason: 'no_packages' }
  } catch (error) {
    console.error('检查本地学习方案失败:', error)
    return { hasPackages: false, reason: 'error' }
  }
}

// 学习资源提示封装
const showNoLearningPackagesAlert = (sectionName: string) => {
  showMessage(`《${sectionName}》暂无学习方案，请选择其他知识点进行学习`, 'warning', 3000)
}

const showNotDownloadedAlert = (sectionName: string) => {
  showMessage(`《${sectionName}》学习资源未下载，请先下载教材资源`, 'warning', 3000)
}

const showErrorAlert = (sectionName: string) => {
  showMessage(`检查《${sectionName}》学习资源时发生错误，请重试`, 'error', 3000)
}

// 处理 newGrap 的“去学习”逻辑（复用 KnowledgeGraph 的业务）
const handleLearnFromKnowledgeGraph = async (node: {
  id: string
  name: string
  level?: number | null
}) => {
  const textbookRecordId = getCurrentTextbookId() || ''
  try {
    if (!textbookRecordId) {
      console.warn('教材ID为空，无法检查学习方案')
      showNoLearningPackagesAlert(node.name)
      return
    }

    // 检查本地学习方案
    const checkResult = await checkLocalLearningPackages(textbookRecordId)

    // 如果没有学习方案，提示错误
    if (!checkResult.hasPackages) {
      if (checkResult.reason === 'not_downloaded') {
        showNotDownloadedAlert(node.name)
      } else if (checkResult.reason === 'no_packages') {
        showNoLearningPackagesAlert(node.name)
      } else {
        showErrorAlert(node.name)
      }
      return
    }

    // 保存最后学习的节点ID
    saveLastLearnedNodeId(node.id)

    // 打开学习对话框
    if (selectedTextbook.value) {
      console.log('textbookIdForDialog', textbookRecordId)

      const currentOption = textbookOptions.value.find(
        (opt) => opt.value === selectedTextbook.value
      )
      const chapterGrade = currentOption?.grade || ''
      const chapterSubject = currentOption?.subject || ''
      const chapterTextbook = currentOption ? currentOption.label.split(' ').slice(3).join(' ') : ''

      learningDialogData.value = {
        nodeId: node.id,
        sectionName: node.name,
        level: node.level ?? 0,
        textbookId: textbookRecordId,
        chapterGrade,
        chapterSubject,
        chapterTextbook,
        chapterTitle: node.name,
      }
      learningDialogVisible.value = true
    }
  } catch (error) {
    console.error('检查学习方案失败:', error)
    // 检查失败时仍然允许打开空数据学习对话框
    if (selectedTextbook.value) {
      const currentOption = textbookOptions.value.find(
        (opt) => opt.value === selectedTextbook.value
      )
      const chapterGrade = currentOption?.grade || ''
      const chapterSubject = currentOption?.subject || ''
      const chapterTextbook = currentOption ? currentOption.label.split(' ').slice(3).join(' ') : ''

      learningDialogData.value = {
        nodeId: node.id,
        sectionName: node.name,
        level: node.level ?? 0,
        textbookId: textbookRecordId,
        chapterGrade,
        chapterSubject,
        chapterTextbook,
        chapterTitle: node.name,
      }
      learningDialogVisible.value = true
    }
  }
}

const handlePracticeFromKnowledgeGraph = async (node: {
  id: string
  name: string
  level?: number | null
}) => {
  const subjectLabel = currentSubjectLabel.value

  // 1. 拿到当前教材 option
  const option = textbookOptions.value.find((opt) => opt.value === selectedTextbook.value)
  const textbookId = option?.textbookId // 这里是真正的 textbookId（版本ID）

  if (!textbookId || !subjectLabel) {
    showMessage('缺少教材信息，无法查询习题', 'warning')
    return
  }

  try {
    const subjectForApi = (selectedSubject.value || 'math') as ApiSubjectType

    // 2. 石景山特殊逻辑
    const shijingshanBmNoList = await queryShijingshanBmNoList(
      textbookId,
      node.id,
      node.name,
      subjectForApi
    )

    if (shijingshanBmNoList && shijingshanBmNoList.trim()) {
      const subjectParam = subjectForApi

      router.push({
        path: '/find-exercise',
        query: {
          bmNoList: shijingshanBmNoList.trim(),
          subject: subjectParam,
          token: getScopedStorageValue('token') || '',
        },
      })
      return
    }

    const shijingshanKnowledgeId = await queryShijingshanKnowledgeId(
      textbookId,
      node.id,
      node.name,
      subjectForApi
    )

    let knowledgeList: string

    if (shijingshanKnowledgeId) {
      knowledgeList = shijingshanKnowledgeId
    } else {
      // 3. 通用接口同旧版：textbook_id 传版本ID
      const request = {
        subject: subjectForApi,
        param: [
          {
            textbook_id: textbookId,
            section_id: node.id,
          },
        ],
      }

      knowledgeList = await apiService.queryKnowledgeIdsByNodeId(request)
    }

    // 4. 路由跳转逻辑与旧版保持一致
    const subjectParam = subjectForApi

    router.push({
      path: '/find-exercise',
      query: {
        knowledgeList,
        subject: subjectParam,
        token: getScopedStorageValue('token') || '',
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as Error & { code?: string }).code === 'NO_QUESTIONS'
    ) {
      showMessage(error.message, 'warning')
      return
    }

    console.error('查询知识点ID失败:', error)
    showMessage('查询知识点失败，请重试', 'error')
  }
}
// 学习状态控制面板状态
const learningStatusPanelVisible = ref(false)

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
  console.warn(
    'handleNodeUpdate is deprecated in new KnowledgeGraphView and kept only for debug panel compatibility.',
    {
      action,
      nodeType,
      node,
      oldNode,
    }
  )
}

// 防抖定时器
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 学科选择器
const selectedSubject = ref<ApiSubjectType | ''>('')
const subjectOptions = ref(KNOWLEDGE_GRAPH_SUBJECT_OPTIONS)

const normalizeApiSubject = (raw?: string): ApiSubjectType => {
  const candidate = (raw || 'math') as string
  const isValid = subjectOptions.value.some((opt) => opt.value === candidate)
  return (isValid ? candidate : 'math') as ApiSubjectType
}

// 教材选择器
const selectedTextbook = ref('')
const textbookOptions = ref<TextbookOption[]>([])

// 计算属性：当前选中的教材标签
const selectedTextbookLabel = computed(() => {
  const option = textbookOptions.value.find((opt) => opt.value === selectedTextbook.value)
  if (!option) {
    // 尚未下载教材
    return ''
  }

  // 格式：出版社/年级/学期/教材名称（去除学科字段，用/拼接）
  // 原始格式：年级 学期 学科 教材名称（例如：高一 必修 生物 一/分子与细胞）
  // 目标格式：出版社/高一/必修/一/分子与细胞
  const parts: string[] = [option.publisher || '']

  // 将原始 label 按空格分割
  const labelParts = option.label.split(' ')

  // 找到学科的位置并移除
  const subjectIndex = labelParts.findIndex((part) => part === option.subject)
  if (subjectIndex !== -1) {
    // 移除学科，保留年级、学期和教材名称
    const filteredParts = [
      ...labelParts.slice(0, subjectIndex), // 年级、学期
      ...labelParts.slice(subjectIndex + 1), // 教材名称部分
    ]

    // 处理每个部分：如果包含"/"，则拆分；否则直接添加
    filteredParts.forEach((part) => {
      if (part.includes('/')) {
        // 如果部分包含"/"，拆分成多个子部分
        parts.push(...part.split('/'))
      } else {
        parts.push(part)
      }
    })
  } else {
    // 如果找不到学科，尝试从 label 中提取（去除前两个部分：年级和学期）
    if (labelParts.length > 2) {
      const filteredParts = labelParts.slice(2) // 跳过年级和学期
      filteredParts.forEach((part) => {
        if (part.includes('/')) {
          parts.push(...part.split('/'))
        } else {
          parts.push(part)
        }
      })
    }
  }

  return parts.join('/')
})

// 计算属性：当前科目标签
const currentSubjectLabel = computed(() => {
  const option = subjectOptions.value.find((opt) => opt.value === selectedSubject.value)
  return option ? option.label : '数学'
})

// 获取当前教材的真实ID（教材版本ID）
const getCurrentTextbookId = () => {
  const option = textbookOptions.value.find((opt) => opt.value === selectedTextbook.value)
  if (option) {
    // 从value中提取教材版本ID（最后一个-后面的部分）
    const parts = option.value.split('-')
    return parts[parts.length - 1] // 教材版本ID
  }
  return ''
}

// 保存页面状态
const saveCurrentPageState = () => {
  try {
    const state = {
      selectedSubject: selectedSubject.value,
      selectedTextbook: selectedTextbook.value,
      selectedChapterIndex: getCurrentChapter(),
      selectedChapterDetails: selectedChapterDetails.value,
      chapters: chapters.value,
      chapterStructure: chapterStructure.value,
      textbookOptions: textbookOptions.value, // 保存当前教材选项
    }

    savePageState(state)
  } catch (error) {
    // 状态保存失败，静默处理
    console.error('❌ [KnowledgeGraphView] 页面状态保存失败:', error)
  }
}

// 恢复页面状态
const restorePageStateFromStore = async (): Promise<boolean> => {
  try {
    const savedState = restorePageState()
    if (!savedState) {
      return false
    }

    // 恢复基本状态
    selectedSubject.value = normalizeApiSubject(savedState.selectedSubject)
    chapters.value = savedState.chapters
    chapterStructure.value = savedState.chapterStructure

    // 恢复教材选项：如果保存的状态中有教材选项，直接使用；否则从IndexedDB加载
    if (savedState.textbookOptions && savedState.textbookOptions.length > 0) {
      // 直接使用保存的教材选项
      textbookOptions.value = savedState.textbookOptions

      // 验证并设置选中的教材
      const foundOption = savedState.textbookOptions.find(
        (opt) => opt.value === savedState.selectedTextbook
      )
      if (foundOption) {
        selectedTextbook.value = savedState.selectedTextbook
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
      const localOptions = await loadTextbookDataFromIndexedDB()
      if (localOptions.length > 0) {
        // 根据恢复的学科筛选教材选项
        const subjectMap: { [key: string]: string } = {
          math: '数学',
          chinese: '语文',
          english: '英语',
          physics: '物理',
          chemistry: '化学',
          biology: '生物',
          geography: '地理',
          history: '历史',
          politics: '政治',
        }

        const subjectLabel = subjectMap[savedState.selectedSubject] || '数学'
        const filteredOptions = localOptions.filter((option) => option.subject === subjectLabel)

        textbookOptions.value = filteredOptions

        // 验证恢复的教材是否在筛选后的选项中，然后设置选中的教材
        const foundOption = filteredOptions.find((opt) => opt.value === savedState.selectedTextbook)
        if (!foundOption) {
          console.warn('⚠️ [KnowledgeGraphView] 保存的教材不在当前学科选项中，使用第一个教材')
          if (filteredOptions.length > 0) {
            selectedTextbook.value = filteredOptions[0].value
          } else {
            selectedTextbook.value = ''
          }
        } else {
          selectedTextbook.value = savedState.selectedTextbook
        }
      } else {
        textbookOptions.value = []
        selectedTextbook.value = ''
      }
    }

    // 恢复章节状态
    if (
      savedState.selectedChapterIndex >= 0 &&
      savedState.selectedChapterIndex < chapterStructure.value.length
    ) {
      setCurrentChapter(savedState.selectedChapterIndex)
      selectedChapterDetails.value = savedState.selectedChapterDetails

      // 恢复展开的知识图谱状态
      if (savedState.selectedChapterDetails) {
        const subChapters = getSubChapters(savedState.selectedChapterDetails)

        if (subChapters.length > 0) {
          // 尝试恢复之前展开的图谱，如果不存在则自动展开位于targetAngle的图谱
          const previousExpandedGraph = getCurrentChapterExpandedGraph()

          if (
            previousExpandedGraph &&
            subChapters.some((sub) => sub.id === previousExpandedGraph)
          ) {
            setCurrentChapterExpandedGraph(previousExpandedGraph)
          } else {
            // 如果没有之前保存的展开状态，自动展开位于targetAngle的图谱
            await nextTick()
          }
        }
      }
    }

    return true
  } catch (error) {
    console.error('❌ [KnowledgeGraphView] 状态恢复失败:', error)
    return false
  }
}

// 缓存键名常量 - 仅用于统计 localStorage 中旧的知识图谱缓存键
const CACHE_KEYS = {
  CHAPTER_STRUCTURE: 'knowledge_graph_chapter_structure_',
  CACHE_TIMESTAMP: 'knowledge_graph_cache_timestamp',
}

// 缓存过期时间（24小时）
const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000

// 检查缓存是否过期
const isCacheExpired = (timestamp: number): boolean => {
  return Date.now() - timestamp > CACHE_EXPIRE_TIME
}

// ========== 知识图谱章节结构 IndexedDB 缓存（knowledge_graph_chapter_structure 表） ==========

interface KnowledgeGraphChapterStructureRecord {
  id: string // 主键：`${userId}_${textbookId}`
  userId: string
  textbookId: string
  data: ChapterNode[]
  timestamp: number
}

const buildKGRecordId = (userId: string, textbookId: string): string => {
  return `${userId}_${textbookId}`
}

const ensureKGStoreInitialized = async () => {
  const db = resourceManager.indexedDB
  if (!db.isInitialized) {
    await db.init()
  }
}

// 从 IndexedDB 读取章节结构缓存
const loadChapterStructureFromDB = async (textbookId: string): Promise<ChapterNode[] | null> => {
  try {
    await ensureKGStoreInitialized()
    const db = resourceManager.indexedDB
    const userId = getUserId()
    const record = await db.get<KnowledgeGraphChapterStructureRecord>(
      'knowledge_graph_chapter_structure',
      buildKGRecordId(userId, textbookId)
    )

    if (!record) {
      return null
    }

    if (isCacheExpired(record.timestamp)) {
      return null
    }

    return record.data || null
  } catch (error) {
    console.warn('[KnowledgeGraph] 读取章节结构 IndexedDB 缓存失败', error)
    return null
  }
}

// 将章节结构写入 IndexedDB 缓存
const saveChapterStructureToDB = async (
  textbookId: string,
  data: ChapterNode[]
): Promise<boolean> => {
  try {
    await ensureKGStoreInitialized()
    const db = resourceManager.indexedDB
    const userId = getUserId()
    const record: KnowledgeGraphChapterStructureRecord = {
      id: buildKGRecordId(userId, textbookId),
      userId,
      textbookId,
      data,
      timestamp: Date.now(),
    }
    await db.put<KnowledgeGraphChapterStructureRecord>('knowledge_graph_chapter_structure', record)
    return true
  } catch (error) {
    console.warn('[KnowledgeGraph] 保存章节结构到 IndexedDB 失败', error)
    return false
  }
}

// 清理过期的缓存数据
const cleanupExpiredCache = () => {
  try {
    const keys = Object.keys(localStorage)
    const knowledgeGraphKeys = keys.filter((key) => key.startsWith('knowledge_graph_'))

    knowledgeGraphKeys.forEach((key) => {
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
    const knowledgeGraphKeys = keys.filter((key) => key.startsWith('knowledge_graph_'))

    const status = {
      totalKeys: knowledgeGraphKeys.length, // 总缓存键数量
      chapterStructures: knowledgeGraphKeys.filter((key) =>
        key.startsWith(CACHE_KEYS.CHAPTER_STRUCTURE)
      ).length, // 章节结构缓存数量
    }

    return status
  } catch {
    return { totalKeys: 0, chapterStructures: 0 }
  }
}

// 从IndexedDB获取教材数据并转换为textbookOptions（仅包含已下载完成的教材）
const loadTextbookDataFromIndexedDB = async (): Promise<TextbookOption[]> => {
  try {
    // 从IndexedDB获取所有教材
    const textbooks = await resourceManager.getUserLocalTextbooks()

    if (textbooks && textbooks.length > 0) {
      // 仅保留本地“已下载完成”的教材，避免在知识图谱中展示未下载教材
      // 说明：部分场景下 isDownloaded / downloadStatus 可能不同步（例如登录后刷新、历史数据迁移等）
      // 因此这里以“完成状态/本地文件存在”作为兜底判定。
      const downloadedTextbooks = textbooks.filter((textbook) => {
        const hasLocalFiles = Boolean(textbook.localFiles && textbook.localFiles.length > 0)
        const isCompleted = textbook.downloadStatus === 2
        return Boolean(textbook.isDownloaded) || isCompleted || hasLocalFiles
      })

      // 如果没有已下载的教材，则不展示任何教材选项
      if (downloadedTextbooks.length === 0) {
        return []
      }

      // 将已下载的 UserTextbookInfo 转换为 TextbookOption 格式
      const options: TextbookOption[] = downloadedTextbooks.map((textbook) => ({
        value: `${textbook.textbookSubjectLabel}-${textbook.textbookGradeLabel}-${textbook.textbookSemesterLabel}-${textbook.id}`,
        label: `${textbook.textbookGradeLabel} ${textbook.textbookSemesterLabel} ${textbook.textbookSubjectLabel} ${textbook.textbookName}`,
        textbookId: textbook.textbookId,
        subject: textbook.textbookSubjectLabel,
        grade: textbook.textbookGradeLabel,
        semester: textbook.textbookSemesterLabel,
        publisher: textbook.textbookPublisher,
        cover: textbook.textbookCover,
      }))

      return options
    }

    return []
  } catch {
    return []
  }
}

// 根据学科筛选教材数据 - 仅使用本地已下载教材
const loadTextbookDataBySubject = async (subjectValue: string) => {
  try {
    // 只从 IndexedDB 加载本地教材（内部已过滤为已下载完成）
    const localOptions = await loadTextbookDataFromIndexedDB()

    // 本地没有任何已下载教材：不展示教材，不加载章节
    if (localOptions.length === 0) {
      textbookOptions.value = []
      selectedTextbook.value = ''
      chapterStructure.value = []
      chapters.value = []
      selectedChapterDetails.value = null
      return
    }

    // 根据学科筛选教材选项
    const subjectMap: { [key: string]: string } = {
      math: '数学',
      chinese: '语文',
      english: '英语',
      physics: '物理',
      chemistry: '化学',
      biology: '生物',
      geography: '地理',
      history: '历史',
      politics: '政治',
    }

    const subjectLabel = subjectMap[subjectValue] || '数学'

    textbookOptions.value = localOptions.filter((option) => option.subject === subjectLabel)

    // 如果当前学科下没有任何已下载教材，则清空章节
    if (textbookOptions.value.length === 0) {
      // 兜底：如果其他学科有教材，自动切到第一个可用学科，避免误导用户“未下载任何教材”
      if (localOptions.length > 0) {
        const firstAvailableSubjectLabel = localOptions[0].subject
        const reverseSubjectMap: { [key: string]: string } = {
          数学: 'math',
          语文: 'chinese',
          英语: 'english',
          物理: 'physics',
          化学: 'chemistry',
          生物: 'biology',
          地理: 'geography',
          历史: 'history',
          政治: 'politics',
        }

        const nextSubjectValue = reverseSubjectMap[firstAvailableSubjectLabel]
        if (nextSubjectValue && nextSubjectValue !== subjectValue) {
          selectedSubject.value = nextSubjectValue as any
          await loadTextbookDataBySubject(nextSubjectValue)
          return
        }
      }

      selectedTextbook.value = ''
      chapterStructure.value = []
      chapters.value = []
      selectedChapterDetails.value = null
      return
    }

    // 设置默认选中的教材为该学科下的第一个已下载教材
    selectedTextbook.value = textbookOptions.value[0].value

    // 加载默认教材的章节结构
    const defaultOption = textbookOptions.value[0]
    if (defaultOption.textbookId) {
      await loadChapterStructure(defaultOption.textbookId)

      // 设置默认选中的章节
      if (chapterStructure.value.length > 0) {
        setCurrentChapter(0)
        selectedChapterDetails.value = chapterStructure.value[0]
      }
    } else {
      chapterStructure.value = []
      chapters.value = []
      selectedChapterDetails.value = null
    }
  } catch (error) {
    console.error('[流程2] 加载教材列表出错:', error)
    textbookOptions.value = []
    chapterStructure.value = []
    chapters.value = []
    selectedChapterDetails.value = null
  }
}

// 加载章节结构（优先从 IndexedDB 的 knowledge_graph_chapter_structure 表读取缓存）
const loadChapterStructure = async (textbookId: string) => {
  try {
    // 先尝试从 IndexedDB 缓存加载章节结构
    const cachedChapterData = await loadChapterStructureFromDB(textbookId)

    if (cachedChapterData && cachedChapterData.length > 0) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = cachedChapterData

      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = cachedChapterData.map((chapter: { name: string }) =>
        convertToChineseNumber(chapter.name)
      )

      // 初始化所有章节的状态
      initializeChapterStates(textbookId, cachedChapterData, getSubChapters)
      return
    }

    // 缓存中没有数据，从API获取
    const chapterData = await apiService.getTextbookStructure(textbookId)

    if (chapterData && chapterData.length > 0) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = chapterData

      // 缓存章节结构数据到 IndexedDB
      await saveChapterStructureToDB(textbookId, chapterData)

      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = chapterData.map((chapter) => convertToChineseNumber(chapter.name))

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

// 会话认证工具函数 - 使用auth-service.ts统一管理
const ensureAuthentication = async (): Promise<boolean> => {
  // 检查登录状态
  if (isYanbanLoggedIn()) {
    return true
  }

  // 会话无效，直接跳转到登录页
  console.warn('❌ [KnowledgeGraphView] 会话无效，跳转到登录页')
  await router.push({ name: 'login' })
  return false
}

// 处理路由参数初始化（最高优先级）
const handleRouteParamsInitialization = async (): Promise<boolean> => {
  const initSubject = route.query.initSubject as string | undefined
  const initTextbookId = route.query.initTextbookId as string | undefined
  const hasRouteInitParams = !!(initSubject || initTextbookId)

  if (!hasRouteInitParams) {
    return false
  }

  console.log(`[KnowledgeGraph] 使用路由参数进行初始化: initSubject=${initSubject}, initTextbookId=${initTextbookId}`)

  // 学科：路由 initSubject 或默认数学
  const initialSubject = normalizeApiSubject(initSubject)
  selectedSubject.value = initialSubject

  // 根据学科加载教材数据
  await loadTextbookDataBySubject(selectedSubject.value)

  // 如果有教材数据，优先根据路由 initTextbookId 选择教材
  if (textbookOptions.value.length > 0) {
    let targetTextbook: TextbookOption | undefined

    if (initTextbookId) {
      targetTextbook = textbookOptions.value.find(
        (opt) => opt.textbookId === initTextbookId || opt.value.includes(initTextbookId)
      )
    }

    if (!targetTextbook) {
      targetTextbook = textbookOptions.value[0]
    }

    selectedTextbook.value = targetTextbook.value

    if (targetTextbook.textbookId && targetTextbook.textbookId !== 'default') {
      await loadChapterStructure(targetTextbook.textbookId)

      if (chapterStructure.value.length > 0) {
        setCurrentChapter(0)
        selectedChapterDetails.value = chapterStructure.value[0]
        await nextTick()
      }
    }
  }

  await nextTick()
  return true
}

// 处理状态恢复逻辑
const handleStateRestoration = async (): Promise<boolean> => {
  const stateRestored = await restorePageStateFromStore()

  if (!stateRestored) {
    return false
  }

  // 🔧 修复：如果章节结构为空但有选中的教材，尝试加载章节结构
  if (chapterStructure.value.length === 0 && selectedTextbook.value) {
    const selectedOption = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
    if (selectedOption?.textbookId && selectedOption.textbookId !== 'default') {
      console.log(`[KnowledgeGraph] 状态恢复后发现章节为空，尝试加载: ${selectedOption.textbookId}`)
      await loadChapterStructure(selectedOption.textbookId)

      if (chapterStructure.value.length > 0) {
        console.log(`[KnowledgeGraph] 章节加载成功，设置默认章节`)
        setCurrentChapter(0)
        selectedChapterDetails.value = chapterStructure.value[0]
      } else {
        console.warn(`[KnowledgeGraph] 章节加载失败`)
      }
    }
  }

  await nextTick()
  return true
}

// 处理默认初始化逻辑
const handleDefaultInitialization = async (): Promise<void> => {
  const storeSubject = getCurrentSubject()
  const storeTextbookId = getCurrentTextbook()

  // 学科优先顺序：Store -> 默认数学
  const initialSubject = normalizeApiSubject(storeSubject || undefined)
  selectedSubject.value = initialSubject

  // 根据科目加载教材数据
  await loadTextbookDataBySubject(selectedSubject.value)

  // 如果有教材数据，选择目标教材：优先 Store，否则使用第一个教材
  if (textbookOptions.value.length > 0) {
    let targetTextbook: TextbookOption | undefined

    if (storeTextbookId) {
      targetTextbook = textbookOptions.value.find(
        (opt) => opt.textbookId === storeTextbookId || opt.value.includes(storeTextbookId)
      )
    }

    // 如果没有找到，使用第一个教材
    if (!targetTextbook) {
      targetTextbook = textbookOptions.value[0]
    }

    selectedTextbook.value = targetTextbook.value

    // 加载选中教材的章节结构
    if (targetTextbook.textbookId && targetTextbook.textbookId !== 'default') {
      await loadChapterStructure(targetTextbook.textbookId)

      // 自动选择第一个章节
      if (chapterStructure.value.length > 0) {
        setCurrentChapter(0)
        selectedChapterDetails.value = chapterStructure.value[0]
        await nextTick()
      }
    }
  }

  await nextTick()
}

// 初始化图谱
const initGraph = async () => {
  loading.value = true

  try {
    // 使用智能认证，只在必要时重新登录
    const authSuccess = await ensureAuthentication()

    if (!authSuccess) {
      console.error('❌ [KnowledgeGraphView] 认证失败，终止初始化')
      return
    }

    // 优先级顺序：路由参数 -> 状态恢复 -> 默认初始化
    const routeHandled = await handleRouteParamsInitialization()
    if (routeHandled) return

    const stateRestored = await handleStateRestoration()
    if (stateRestored) return

    await handleDefaultInitialization()

  } catch (error) {
    // 图谱初始化失败，静默处理
    console.error('❌ [KnowledgeGraphView] 图谱初始化失败:', error)
  } finally {
    loading.value = false
  }
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
    }
  } catch {
    // 出错时也要清空数据
    textbookOptions.value = []
    selectedTextbook.value = ''
    chapterStructure.value = []
    chapters.value = []
    selectedChapterDetails.value = null
  }
}

// 教材切换
const onTextbookChange = async (value: string) => {
  try {
    // 找到选中的教材选项
    const selectedOption = textbookOptions.value.find((opt) => opt.value === value)
    if (!selectedOption) {
      return
    }

    // 设置当前教材到状态管理器
    if (selectedOption.textbookId) {
      console.log('selectedOption.textbookId', selectedOption.textbookId)
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
  } catch {
    // 切换教材失败
  }
}

// 清空搜索
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

// 处理搜索结果点击
const handleSearchResultClick = async (result: {
  node: ChapterNode
  chapterIndex: number
  chapterName: string
}) => {
  // 如果节点在其他章节，先跳转到对应章节
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

  // 获取当前章节的子章节列表
  const chapter = chapterStructure.value[result.chapterIndex]
  if (!chapter) {
    return
  }

  const subChapters = getSubChapters(chapter)

  // 查找节点在子章节列表中的索引
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

  // 如果找到了目标节点ID，旋转到targetAngle
  if (targetNodeId) {
    const targetIndex = subChapters.findIndex((sub) => sub.id === targetNodeId)
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

      // 通过 newGrap 暴露的方法，让图谱聚焦到对应节点
      if (newGrapRef.value && typeof newGrapRef.value.focusOnNodeId === 'function') {
        // true 表示瞬时跳转到目标节点位置
        newGrapRef.value.focusOnNodeId(targetNodeId, true)
      }

      // 清空搜索
      searchQuery.value = ''
    }
  }
}

// 高亮匹配文本
// 将中文括号【】转换为英文括号[]
const convertBrackets = (text: string): string => {
  return text.replace(/【/g, '[').replace(/】/g, ']')
}

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
  // 重复点击检测：检查是否点击的是当前已选中的章节
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
  }
}

// 检查并打开学习对话框（从路由参数）
const checkAndOpenLearningDialog = () => {
  const openLearning = route.query.openLearning === 'true'

  if (openLearning) {
    const learningNodeId = route.query.learningNodeId as string
    const learningSectionName = route.query.learningSectionName as string
    const learningLevel = route.query.learningLevel as string
    const textbookId = route.query.textbookId as string

    // 验证必要参数是否存在
    if (learningNodeId && learningSectionName && textbookId) {
      // 设置对话框数据
      learningDialogData.value = {
        nodeId: learningNodeId,
        sectionName: learningSectionName,
        level: parseInt(learningLevel) || 1,
        textbookId: textbookId,
        // 从路由参数中获取章节信息，确保微课按钮状态正确
        chapterGrade: route.query.learningChapterGrade as string,
        chapterSubject: route.query.learningChapterSubject as string,
        chapterTextbook: route.query.learningChapterTextbook as string,
        chapterTitle: route.query.learningChapterTitle as string,
      }

      // 显示对话框
      learningDialogVisible.value = true

      // 清理路由参数，避免重复打开
      router.replace({
        name: 'knowledgeGraph',
        query: {},
      })
    }
  }
}

// 处理学习对话框关闭
const handleLearningDialogClose = (value: boolean) => {
  if (!value) {
    // 对话框关闭时清空数据
    learningDialogData.value = null
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
  const subChapters = chapterDetails.children?.filter((child) => child.level === 1) || []

  // 为每个章节添加章节练习节点，使用章的名字
  const exerciseNode: ChapterNode = {
    id: chapterDetails.id, // 直接使用父章节ID
    name: chapterDetails.name, // 使用章的名字
    parentId: chapterDetails.id,
    label: chapterDetails.name, // 使用章的名字
    level: 1, // 确保是x.x层级
    isRoot: false,
    updateTime: new Date().toISOString(),
    children: [],
  }

  // 将章节练习节点添加到子章节列表的末尾
  return [...subChapters, exerciseNode].reverse()
}

// 通过 provide 传递知识图谱角度数据给调试面板（在所有函数定义之后）
provide('knowledgeGraphAngleData', {
  selectedChapterDetails,
  getSubChapters,
  getChapterRotation,
  getCurrentChapter,
})

// 组件挂载时初始化
onMounted(async () => {
  // 清理过期的缓存数据
  cleanupExpiredCache()

  // 获取缓存状态信息
  getCacheStatus()

  // 加载学习状态
  refreshLearningStatusFromStorage()

  initGraph()

  // 检查路由参数，如果需要自动打开学习对话框
  checkAndOpenLearningDialog()

  // 清理函数：仅清理防抖定时器
  onUnmounted(() => {
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
  })
})

onUnmounted(() => {
  // 保存页面状态
  saveCurrentPageState()
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
  width: 35%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  position: relative;

  .subject-header {
    flex-shrink: 0;
    margin-top: 16px;

    :deep(.select-label) {
      font-size: 36px;
      color: #ffffff;
      font-weight: 900; // 超粗
      font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, '黑体', sans-serif; // 无衬线中文常用字体
      letter-spacing: 0.02em; // 适当加一点字距（可选）
      line-height: 1;
    }

    :deep(.select-trigger) {
      background-color: transparent;
      border: none;
    }

    :deep(.select-icon) {
      filter: brightness(0) invert(1);
    }

    :deep(.q-field__marginal) {
      color: #ffffff;
    }

    :deep(.q-field--outlined .q-field__control:before) {
      border: none;
    }

    :deep(.q-field__control) {
      color: transparent;
    }
  }

  .textbook-info {
    flex-shrink: 0;
    :deep(.common-select) {
      width: 100%;
    }
    :deep(.q-field__marginal) {
      color: #ffffff;
    }

    :deep(.select-icon) {
      filter: brightness(0) invert(1);
    }
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

// 添加搜索框样式
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
      color: #ffffff;
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
      color: #ffffff;
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

// 搜索高亮样式
:deep(.search-highlight) {
  background: rgba(255, 215, 0, 0.4);
  color: #ffffff;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
}

.textbook-info {
  /* 作为占位容器，仅控制位置，不再直接设置卡片外观 */
  margin: 14px 20px;

  /* 将原来的卡片样式完全下沉到 CommonSelect 内部 */
  :deep(.select-trigger) {
    width: 100%;
    min-height: 44px; /* 触摸区域 */
    padding: 6px 10px;
    border-radius: 12px;
    border: 1px solid rgba(227, 224, 235, 0.3);
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  :deep(.select-trigger:hover) {
    background: rgba(255, 255, 255, 0.18);
  }

  :deep(.select-label) {
    width: 254px;
    font-size: 19px;
    color: #ffffff;
    font-weight: 350;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    height: 22px;
  }

  :deep(.select-icon-wrapper) {
    color: #ffffff;
    font-size: 18px;
    transition: transform 0.2s ease;
  }

  /* 教材下拉列表选项尺寸 */
  :deep(.select-dropdown) {
    border-radius: 16px;
  }

  :deep(.select-option) {
    font-size: 15px;
    padding: 8px 18px;
  }
}

.chapter-list {
  flex: 1;
  overflow-y: auto;
  // 平滑滚动
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
    position: relative;
    border-radius: 12px;
    font-family: 'PingFang SC', sans-serif;
    height: 50px; // 增加触摸区域
    width: 313px;
    display: flex;
    align-items: center;
    // 触摸反馈优化
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap; /* 禁止换行 - 非active状态单行显示 */
    overflow: hidden; /* 隐藏溢出内容 */
    text-overflow: ellipsis; /* 溢出部分显示省略号 */

    &.active {
      background-color: #e0dbff;
      height: auto; /* 覆盖固定高度，允许自适应 */
      white-space: normal; /* active状态允许换行 */
      min-height: 44px; /* 最小高度保持44px */
      max-height: 80px; /* 最大高度限制为2行（19px字体 * 1.4行高 * 2行 + padding） */
      align-items: flex-start; /* 顶部对齐，支持多行 */
      padding-top: 11px; /* 保持顶部padding */

      .chapter-text {
        color: #393548;
        white-space: normal; /* 允许换行 */
        display: -webkit-box;
        -webkit-line-clamp: 2; /* 限制为2行 */
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.4; /* 行高 */
        word-break: break-word; /* 允许单词内换行，避免长单词溢出 */
      }
    }

    // 触摸状态
    &:active {
      transform: scale(0.98);
      transition: transform 0.1s ease;
    }

    .chapter-text {
      font-size: 19px;
      font-weight: 500;
      color: #9e9aad;
      line-height: 1.4;
      white-space: nowrap; /* 禁止换行 */
      overflow: hidden; /* 隐藏溢出内容 */
      text-overflow: ellipsis; /* 溢出部分显示省略号 */
    }

    // 搜索结果样式
    &.search-result-item {
      flex-direction: column;
      align-items: flex-start;
      padding: 12px 15px;
      height: auto; // 允许自适应高度，覆盖固定高度
      min-height: 60px; // 设置最小高度，确保有足够空间
      margin: 8px 20px; // 增加上下间距，避免重叠
      white-space: normal; // 允许换行
      overflow: visible; // 允许内容正常显示

      .search-result-content {
        width: 100%;

        .search-result-node {
          font-size: 18px;
          font-weight: 500;
          color: #393548;
          line-height: 1.5;
          margin-bottom: 6px; // 增加节点名称和章节名称之间的间距
          word-break: break-word; // 允许长文本换行
        }

        .search-result-chapter {
          font-size: 14px;
          color: #9ca3af;
          line-height: 1.4;
          word-break: break-word; // 允许长文本换行
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
  top: 13px;
  right: 22px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
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
      width: 46px;
      height: 46px;
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
  touch-action: pan-y; // 允许垂直滑动，提高触摸响应
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

  // 移动端响应式优化
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
  top: 45%;
  z-index: 1000; // 提高层级，确保在最上层
  height: 30%;
  width: 20px;
  background: transparent;
  pointer-events: auto; // 启用点击事件
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;

  .indicator-dot {
    width: 7px;
    height: 7px;
    background: rgba(139, 92, 246, 0.6);
    border-radius: 50%;
    transition: all 0.3s ease;
    cursor: pointer; // 添加指针样式
    position: relative;
    z-index: 1001; // 确保圆点在最上层
    // 移动端触控优化
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    margin: 5px;

    &:hover {
      background: rgba(139, 92, 246, 0.8);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
      transition: transform 0.1s ease;
    }

    &.active {
      background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6d28d9 100%);
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.8), 0 0 24px rgba(139, 92, 246, 0.4);
      position: relative;
      opacity: 1 !important;
    }

    // 移动端增大触摸区域
    @media (max-width: 768px) {
      min-width: 28px;
      min-height: 28px;

      &.active {
        min-width: 24px;
        min-height: 24px;
      }
    }
  }

  .indicator-icon {
    position: absolute;
    left: -30px;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
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
      color: #ffffff;
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
  0%,
  100% {
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
