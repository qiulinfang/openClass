<template>
  <div class="knowledge-graph-container" ref="containerRef" @click="handleContainerClick">
    <div class="knowledge-graph" ref="graphRef">
      <!-- 背景圆形区域表示包含关系 -->
      <div 
        ref="backgroundRef"
        class="containment-background"
        :class="{ 'expanded': isExpanded }"
        :style="{ 
          transitionDuration: backgroundTransitionDuration,
          width: `${backgroundRadius * 2}px`,
          height: `${backgroundRadius * 2}px`
        }"
      ></div>
      
       <!-- 中心节点 -->
       <GraphNode
         ref="centerNodeRef"
         :node="{ id: chapterDetails.id, name: chapterDetails.name, level: chapterDetails.level }"
         type="center"
         :is-menu-visible="activeNodeId === chapterDetails.id"
         :is-expanded="isExpanded"
         :has-expanded-graph="hasExpandedGraph"
         @click="handleCenterNodeClick"
         @toggle-menu="handleToggleMenu"
         @learn="handleLearn"
         @practice="handlePractice"
       />
      
       <!-- 圆周上的子节点 -->
       <GraphNode
         v-for="(child, index) in getCircularNodes(chapterDetails)" 
         :key="child.id"
         :ref="`circularNodeRef${index}`"
         :node="{ ...child, level: child.level }"
         type="circular"
         :index="index"
         :total="getCircularNodes(chapterDetails).length"
         :radius="circularNodeRadius"
         :show="isExpanded || hasExpandedGraph"
         :animation-state="animationState"
         :is-menu-visible="activeNodeId === child.id"
         :learning-status="getLearningStatus(child)"
         @toggle-menu="handleToggleMenu"
         @learn="handleLearn"
         @practice="handlePractice"
       />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, inject, defineExpose } from 'vue'
import { useRouter } from 'vue-router'
import GraphNode from './GraphNode.vue'
import { ResourceManager } from '../../services/resource-storage'
import { showMessage } from '../../utils'
import { apiService } from '../../services/api-service'
import { authStorageService } from '../../services/auth-storage-service'
import type { KnowledgeGraphDebugParams } from '../debug/KnowledgeGraphDebugPanel.vue'
import { queryShijingshanKnowledgeId } from '../../utils/business/shijingshan-knowledge-utils'

interface ChapterNode {
  id: string
  name: string
  label: string
  level?: number | null
  knowledgeList?: string
  children?: ChapterNode[]
}

interface ChapterDetails extends ChapterNode {
  children?: ChapterNode[]
}

interface Props {
  chapterDetails: ChapterDetails
  graphIndex?: number
  rotation?: number
  isExpanded?: boolean
  hasExpandedGraph?: boolean
  rotationDirection?: 'clockwise' | 'counterclockwise' | null
  textbookRecordId?: string // 教材在IndexedDB中的id字段
  textbookId?: string // 教材ID（textbookId，用于API查询）
  subject?: string // 学科类型（math/biology）
}

const props = withDefaults(defineProps<Props>(), {
  rotation: 0,
  isExpanded: false,
  hasExpandedGraph: false,
  rotationDirection: null
})

// 调试：监听props变化
watch(() => props.textbookRecordId, (newValue) => {
}, { immediate: true })

// 定义事件
const emit = defineEmits<{
  expand: [graphId: string]
  learn: [node: { id: string; name: string; level?: number | null }]
  'save-state': []
}>()

// 路由
const router = useRouter()

// 注入调试参数（可选）
const debugParams = inject<{ value: KnowledgeGraphDebugParams } | undefined>('knowledgeGraphDebugParams', undefined)

// 模板引用
const containerRef = ref<HTMLElement>()
const graphRef = ref<HTMLElement>()
const centerNodeRef = ref<InstanceType<typeof GraphNode>>()
const backgroundRef = ref<HTMLElement>()

// 展开状态 - 使用外部传入的 props
const isExpanded = computed(() => props.isExpanded)

// 动画状态
const animationState = ref<'idle' | 'expanding' | 'expanded' | 'collapsing'>('idle')

// 气泡框状态管理
const activeNodeId = ref<string | null>(null)

// 获取带用户ID前缀的存储key
const getLastLearnedNodeKey = () => {
  const userId = authStorageService.getCurrentUserIdOrDefault()
  return `${userId}_LAST_LEARNED_NODE_ID`
}

const getLearnedNodesKey = () => {
  const userId = authStorageService.getCurrentUserIdOrDefault()
  return `${userId}_LEARNED_NODES`
}

// 最后点击去学习的圆周节点ID（用于显示学习标签）
const lastLearnedNodeId = ref<string | null>(null)

// 已学习的节点ID列表（用于标记已学习节点）
const learnedNodeIds = ref<Set<string>>(new Set())

// 从localStorage加载最后学习的节点ID
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

// 保存最后学习的节点ID到localStorage
const saveLastLearnedNodeId = (nodeId: string) => {
  try {
    lastLearnedNodeId.value = nodeId
    const key = getLastLearnedNodeKey()
    localStorage.setItem(key, nodeId)
  } catch (error) {
    console.error('保存最后学习的节点ID失败:', error)
  }
}

// 从localStorage加载已学习的节点ID列表
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

// 初始化时加载
onMounted(() => {
  loadLastLearnedNodeId()
  loadLearnedNodeIds()
  
  // 监听localStorage变化，当学习状态改变时自动刷新
  // 使用storage事件监听其他标签页的变化，但同一个标签页的localStorage.setItem不会触发storage事件
  // 所以我们需要使用一个自定义的机制，或者定期检查
  // 这里使用一个简单的方式：监听window的storage事件（虽然同标签页不会触发，但可以用于跨标签页同步）
  window.addEventListener('storage', handleStorageChange)
  
  // 对于同标签页的localStorage变化，我们使用一个轮询检查机制
  // 或者可以通过provide/inject传递一个刷新函数
  // 这里先使用storage事件，同标签页的变化由父组件触发刷新
})

// 清理事件监听器
onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})

// 处理localStorage变化
const handleStorageChange = (event: StorageEvent) => {
  const lastLearnedKey = getLastLearnedNodeKey()
  const learnedNodesKey = getLearnedNodesKey()
  if (event.key === lastLearnedKey) {
    loadLastLearnedNodeId()
  } else if (event.key === learnedNodesKey) {
    loadLearnedNodeIds()
  }
}

// 暴露刷新方法供外部调用（如果需要）
const refreshLearningStatus = () => {
  loadLastLearnedNodeId()
  loadLearnedNodeIds()
}

// 暴露方法给父组件
defineExpose({
  refreshLearningStatus
})

// 监听展开状态变化，管理动画状态
watch([() => props.isExpanded, () => props.hasExpandedGraph], ([newIsExpanded, newHasExpandedGraph], [oldIsExpanded, oldHasExpandedGraph]) => {
  // 获取动画持续时间（毫秒）
  const animationDuration = (debugParams?.value?.nodeEnterExitDuration ?? 0.8) * 1000
  
  // 如果当前图谱被展开
  if (newIsExpanded && !oldIsExpanded) {
    animationState.value = 'expanding'
    // 切换知识图谱时，隐藏所有气泡框（包括中心节点和圆周节点）
    activeNodeId.value = null
    setTimeout(() => {
      animationState.value = 'expanded'
    }, animationDuration) // 使用动态动画时间
  }
  // 如果当前图谱被收起
  else if (!newIsExpanded && oldIsExpanded) {
    animationState.value = 'collapsing'
    // 隐藏所有气泡框（包括中心节点和圆周节点）
    activeNodeId.value = null
    setTimeout(() => {
      animationState.value = 'idle'
    }, animationDuration) // 使用动态动画时间
  }
  // 如果其他图谱被展开，当前图谱需要淡出
  else if (newHasExpandedGraph && !newIsExpanded && !oldHasExpandedGraph) {
    animationState.value = 'collapsing'
    // 隐藏所有气泡框（包括中心节点和圆周节点）
    activeNodeId.value = null
    setTimeout(() => {
      animationState.value = 'idle'
    }, animationDuration) // 使用动态动画时间
  }
  // 如果其他图谱被展开，且当前图谱原本也是展开的（从展开状态切换到另一个图谱）
  else if (newHasExpandedGraph && oldIsExpanded && !newIsExpanded) {
    animationState.value = 'collapsing'
    // 隐藏所有气泡框（包括中心节点和圆周节点）
    activeNodeId.value = null
    setTimeout(() => {
      animationState.value = 'idle'
    }, animationDuration) // 使用动态动画时间
  }
  // 如果其他图谱被收起，当前图谱需要淡入
  else if (!newHasExpandedGraph && oldHasExpandedGraph && !newIsExpanded) {
    animationState.value = 'expanding'
    // 隐藏所有气泡框（包括中心节点和圆周节点）
    activeNodeId.value = null
    setTimeout(() => {
      animationState.value = 'expanded'
    }, animationDuration) // 使用动态动画时间
  }
  // 初始状态：如果都没有展开，设置为idle
  else if (!newIsExpanded && !newHasExpandedGraph && animationState.value === 'idle') {
    // 保持idle状态，不需要动画
    // 确保隐藏所有气泡框
    activeNodeId.value = null
  }
}, { immediate: true }) // 改为true，确保初始加载时也能正确处理状态


// 计算背景圆半径 - 根据圆周节点数量动态调整
const backgroundRadius = computed(() => {
  if (!containerRef.value) return 180 // 默认值
  
  const container = containerRef.value
  const containerWidth = container.offsetWidth
  const containerHeight = container.offsetHeight
  
  // 背景圆是正方形的内切圆，半径是较小边的一半
  const baseRadius = Math.min(containerWidth, containerHeight) / 2
  
  // 使用可调参数的最小背景半径，如果没有则使用默认值
  const minRadius = debugParams?.value?.minBackgroundRadius ?? 120
  const radius = Math.max(baseRadius, minRadius)
  
  // 获取圆周节点数量
  const circularNodes = getCircularNodes(props.chapterDetails)
  const nodeCount = circularNodes.length
  
  // 根据节点数量调整半径大小，使用可调参数
  if (nodeCount === 0) {
    // 没有圆周节点：背景圆形区域半径
    const scale = debugParams?.value?.radiusScaleNone ?? 0.7
    return radius * scale
  } else if (nodeCount <= 2) {
    // 1-2个节点：背景圆形区域半径小
    const scale = debugParams?.value?.radiusScaleSmall ?? 0.8
    return radius * scale
  } else if (nodeCount <= 4) {
    // 3-4个节点：背景圆形区域半径中
    const scale = debugParams?.value?.radiusScaleMedium ?? 1.0
    return radius * scale
  } else {
    // 超过4个节点：背景圆形区域半径大
    const scale = debugParams?.value?.radiusScaleLarge ?? 1
    return radius * scale
  }
})

// 计算圆周节点的实际半径（应用半径因子）
const circularNodeRadius = computed(() => {
  const factor = debugParams?.value?.circularNodeRadiusFactor ?? 1.0
  return backgroundRadius.value * factor
})

// 计算背景圆形的动态过渡时间
const backgroundTransitionDuration = computed(() => {
  // 如果当前图谱是展开状态，根据旋转方向调整收缩速度
  if (props.isExpanded && props.rotationDirection) {
    if (props.rotationDirection === 'clockwise') {
      // 下半圆点击，顺时针旋转，收缩更快
      const duration = debugParams?.value?.backgroundTransitionDurationClockwise ?? 0.6
      return `${duration}s`
    } else if (props.rotationDirection === 'counterclockwise') {
      // 上半圆点击，逆时针旋转，保持默认速度
      const duration = debugParams?.value?.backgroundTransitionDurationCounterclockwise ?? 0.6
      return `${duration}s`
    }
  }
  // 默认情况或展开动画使用默认时间
  const duration = debugParams?.value?.backgroundTransitionDurationCounterclockwise ?? 0.6
  return `${duration}s`
})

// 获取圆周上的子节点
const getCircularNodes = (chapterDetails: ChapterDetails) => {
  if (!chapterDetails.children) return []
  
  // 初始情况下，只显示level=1的节点（x.x层）
  // 只有在展开状态下，才显示level=2的节点
  if (chapterDetails.level === 1) {
    // 只有当前图谱被展开时才显示子节点，其他情况都不显示
    if (isExpanded.value) {
      return chapterDetails.children.filter(child => child.level === 2)
    } else {
      return []
    }
  }
  
  // 如果是主章节（level=0），始终显示其子节点（level=1的节点）
  if (chapterDetails.level === 0) {
    return chapterDetails.children.filter(child => child.level === 1)
  }
  
  // 默认返回所有子节点
  return chapterDetails.children
}

// 获取节点的学习状态
const getLearningStatus = (child: { id: string; name: string; label: string; level?: number | null }): 'notLearned' | 'learned' | 'lastLearned' => {
  // 优先级：'lastLearned' > 'learned' > 'notLearned'
  // 如果当前节点是最后点击去学习的圆周节点，显示学习标签
  if (lastLearnedNodeId.value === child.id) {
    return 'lastLearned'
  }
  
  // 如果节点在已学习列表中，返回已学习状态
  if (learnedNodeIds.value.has(child.id)) {
    return 'learned'
  }
  
  // 其他节点默认为未学习
  return 'notLearned'
}

// 动画控制方法
const animateExpand = () => {
  animationState.value = 'expanding'
  
  // 延迟设置展开状态，让动画有时间播放（与背景圆形区域动画时间一致）
    animationState.value = 'expanded'
}

const animateCollapse = () => {
  animationState.value = 'collapsing'
  
  // 延迟设置收起状态，让动画有时间播放（与背景圆形区域动画时间一致）
    animationState.value = 'idle'
}

// 处理中心节点点击
const handleCenterNodeClick = (event: Event) => {
  event.stopPropagation() // 阻止事件冒泡到背景
  
  // 不需要手动调用handleToggleMenu，因为GraphNode组件已经通过@toggle-menu事件处理了
  // 这里只需要处理展开逻辑
  
  // 无论是否有圆周节点，都执行展开逻辑，让知识图谱旋转到160度位置
  // 发出展开事件，让父组件控制展开状态和旋转动画
  emit('expand', props.chapterDetails.id)
}

// 处理容器点击（点击非节点区域时隐藏气泡）
const handleContainerClick = () => {
  // 节点点击时会调用 stopPropagation()，所以如果点击事件到达容器，
  // 说明点击的是空白区域（非节点区域），此时隐藏所有气泡
  activeNodeId.value = null
}

// 处理气泡框切换
const handleToggleMenu = (nodeId: string) => {
  if (activeNodeId.value === nodeId) {
    // 如果点击的是当前激活的节点，关闭气泡框
    activeNodeId.value = null
  } else {
    // 否则切换到新的节点
    activeNodeId.value = nodeId
  }
}


// 处理去学习
const handleLearn = async (node: { id: string; name: string; level?: number | null }) => {
  activeNodeId.value = null // 关闭气泡框
  
  // 检查是否是圆周节点（通过检查节点是否在圆周节点列表中）
  const circularNodes = getCircularNodes(props.chapterDetails)
  const isCircularNode = circularNodes.some(child => child.id === node.id)
  
  try {
    // 检查学习方案数据
    if (!props.textbookRecordId) {
      console.warn('教材ID为空，无法检查学习方案')
      showNoLearningPackagesAlert(node.name)
      return
    }
    
    const checkResult = await checkLocalLearningPackages(props.textbookRecordId)
    
    if (!checkResult.hasPackages) {
      // 根据不同的原因显示不同的提示
      if (checkResult.reason === 'not_downloaded') {
        showNotDownloadedAlert(node.name)
      } else if (checkResult.reason === 'no_packages') {
        showNoLearningPackagesAlert(node.name)
      } else {
        showErrorAlert(node.name)
      }
      return
    }
    
    // 只有当是圆周节点且有资源时，才保存为最后学习的节点（用于显示学习标签）
    // 注意：这里只保存为"最后学习"，不标记为"已学习"
    // "已学习"状态将在用户点击资源中的"去学习"成功后标记
    if (isCircularNode) {
      saveLastLearnedNodeId(node.id)
    }
    
    // 发出保存状态事件，让父组件保存当前页面状态
    emit('save-state')
    // 触发学习事件，让父组件打开对话框
    emit('learn', node)
  } catch (error) {
    console.error('检查学习方案失败:', error)
    // 如果检查失败，仍然允许打开对话框，让学习页面处理空数据情况
    // 注意：检查失败时不保存学习标签，因为无法确认是否有资源
    emit('save-state')
    emit('learn', node)
  }
}

// 处理去练习 - 使用API查询知识点ID
const handlePractice = async (node: { id: string; name: string; level?: number | null }) => {
  activeNodeId.value = null // 关闭气泡框
  // 检查必要的参数
  if (!props.textbookId || !props.subject) {
    showMessage('缺少教材信息，无法查询习题', 'warning')
    return
  }
  
  try {
    // 第1步：检查是否是石景山学校的特殊业务逻辑
    const shijingshanKnowledgeId = await queryShijingshanKnowledgeId(
      props.textbookId,
      node.id,
      node.name,
      props.subject === '数学' ? 'math' : props.subject === '生物' ? 'biology' : props.subject.toLowerCase()
    )
    
    let knowledgeList: string
    
    if (shijingshanKnowledgeId) {
      // 使用石景山学校特殊逻辑获取的知识点ID
      knowledgeList = shijingshanKnowledgeId
    } else {
      // 使用默认逻辑：构建API请求（参考Android实现）
      const request = {
        subject: props.subject === '数学' ? 'math' : props.subject === '生物' ? 'biology' : props.subject.toLowerCase(),
        param: [{
          textbook_id: props.textbookId,
          section_id: node.id
        }]
      }
      
      // 调用API查询知识点ID
      knowledgeList = await apiService.queryKnowledgeIdsByNodeId(request)
    }
    
    // 跳转到习题查找页面
    // 第2步：判断科目类型（支持中文标签和英文值）
    const isBiology = props.subject === '生物' || props.subject === 'biology'
    const isMath = props.subject === '数学' || props.subject === 'math'
    
    // 第3步：根据科目类型设置路由参数
    const subjectParam = isBiology ? 'SUBJECT_BIOLOGY' : isMath ? 'SUBJECT_MATH' : 'SUBJECT_MATH'
    
    router.push({
      path: '/find-exercise',
      query: {
        knowledgeList: knowledgeList,
        subject: subjectParam,
        token: authStorageService.getScopedStorageValue('token') || ''
      }
    })
  } catch (error) {
    // 第1步：检查是否是"没有题目"的错误
    if (error instanceof Error && 'code' in error && (error as Error & { code?: string }).code === 'NO_QUESTIONS') {
      showMessage(error.message, 'warning')
      return
    }
    
    // 第2步：其他错误显示通用错误提示
    console.error('查询知识点ID失败:', error)
    showMessage('查询知识点失败，请重试', 'error')
  }
}

// 检查本地学习方案数据
const checkLocalLearningPackages = async (textbookRecordId: string): Promise<{hasPackages: boolean, reason: 'no_packages' | 'not_downloaded' | 'error'}> => {
  try {
    if (!textbookRecordId) {
      console.warn('教材记录ID为空，无法检查学习方案')
      return { hasPackages: false, reason: 'error' }
    }
    
    // 从本地 IndexedDB 获取教材信息
    // 使用教材记录ID查找对应的教材
    const resourceManager = ResourceManager.getInstance()
    const textbooks = await resourceManager.getUserLocalTextbooks()
    const textbook = textbooks.find(t => t.id === textbookRecordId)
    
    if (!textbook) {
      // 教材不存在于本地，说明没有下载过
      return { hasPackages: false, reason: 'not_downloaded' }
    }
    
    // 检查是否有本地文件元数据（判断是否已下载）
    const hasLocalFiles = Boolean(textbook.localFiles && textbook.localFiles.length > 0)
    
    if (!hasLocalFiles) {
      // 没有本地文件元数据，说明没有下载
      return { hasPackages: false, reason: 'not_downloaded' }
    }
    
    // 检查textbook_files表中是否有实际的文件数据（分离存储架构）
    // 采样检查：检查前3个文件是否在textbook_files表中存在实际数据
    // 这样可以避免检查所有文件，提升性能
    const sampleFiles = textbook.localFiles.slice(0, Math.min(3, textbook.localFiles.length))
    let hasActualFileData = false
    for (const file of sampleFiles) {
      const fileExists = await resourceManager.hasFileData(textbook.id, file.id)
      if (fileExists) {
        hasActualFileData = true
        break // 找到一个文件存在即可
      }
    }
    
    if (!hasActualFileData && textbook.localFiles.length > 0) {
      // 有元数据但没有实际文件数据，可能是下载中断或数据损坏
      // 这种情况也视为未下载
      return { hasPackages: false, reason: 'not_downloaded' }
    }
    
    // 检查是否有学习资源包数据
    const hasLearningPackages = Boolean(textbook.learningPackages && textbook.learningPackages.length > 0)
    
    if (!hasLearningPackages) {
      // 有本地文件但没有学习资源包，说明服务器上没有学习方案
      return { hasPackages: false, reason: 'no_packages' }
    }
    
    return { hasPackages: true, reason: 'no_packages' } // reason在这里不重要，因为hasPackages为true
  } catch (error) {
    console.error('检查本地学习方案失败:', error)
    return { hasPackages: false, reason: 'error' }
  }
}

// 显示没有学习方案的提示
const showNoLearningPackagesAlert = (sectionName: string) => {
  showMessage(`《${sectionName}》暂无学习方案，请选择其他知识点进行学习`, 'warning', 3000)
}

// 显示未下载资源的提示
const showNotDownloadedAlert = (sectionName: string) => {
  showMessage(`《${sectionName}》学习资源未下载，请先下载教材资源`, 'warning', 3000)
}

// 显示检查错误的提示
const showErrorAlert = (sectionName: string) => {
  showMessage(`检查《${sectionName}》学习资源时发生错误，请重试`, 'error', 3000)
}

// 监听展开状态变化
watch(isExpanded, (newValue) => {
  if (newValue) {
    animateExpand()
  } else {
    animateCollapse()
  }
}, { immediate: true })


// 监听数据变化，重新初始化动画状态
watch(() => props.chapterDetails, () => {
  if (props.chapterDetails) {
    // 如果图谱是展开的，初始状态应该是expanded，否则是idle
    animationState.value = isExpanded.value ? 'expanded' : 'idle'
  }
}, { immediate: true })

// 监听旋转角度变化（SVG方法：内容保持水平，不旋转）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
watch(() => props.rotation, (_newRotation) => {
  // 根据SVG方法，知识图谱内容保持水平，不进行旋转
  // 位置变化由父容器的旋转控制，内容本身保持水平
  if (graphRef.value) {
    // 不应用旋转，保持内容水平
    graphRef.value.style.transform = 'none'
  }
})

onMounted(() => {
  // 根据展开状态初始化动画状态
  animationState.value = isExpanded.value ? 'expanded' : 'idle'
})
</script>

<style scoped>
.knowledge-graph-container {
  width: 66.67vw; /* 视口宽度的三分之二 */
  height: 66.67vh; /* 视口高度的三分之二 */
  max-width: 800px;
  max-height: 800px;
  min-width: 400px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 0 auto; /* 水平居中 */
}

.knowledge-graph {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 背景圆形区域表示包含关系 */
.containment-background {
  position: absolute;
  /* 宽高通过动态样式设置，根据节点数量调整 */
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-radius: 50%;
  z-index: 1;
  pointer-events: none; /* 不拦截点击事件，让子节点可以正常点击 */
  transform-origin: center center;
  /* 初始状态隐藏 */
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  
  &:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.08) 100%);
    border-color: rgba(139, 92, 246, 0.3);
  }
  
  /* 展开状态 */
  &.expanded {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
