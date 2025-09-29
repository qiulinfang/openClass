<template>
  <div class="knowledge-graph-container" ref="containerRef" >
    <div class="knowledge-graph" ref="graphRef">
      <!-- 背景圆形区域表示包含关系 -->
      <div 
        ref="backgroundRef"
        class="containment-background"
        :class="{ 'expanded': isExpanded }"
      ></div>
      
       <!-- 中心节点 -->
       <GraphNode
         ref="centerNodeRef"
         :node="{ id: 'center', name: chapterDetails.name, level: chapterDetails.level }"
         type="center"
         :is-menu-visible="activeNodeId === 'center'"
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
         :radius="backgroundRadius"
         :highlighted="index === 3"
         :blue="index === 1"
         :show="isExpanded"
         :animation-state="animationState"
         :is-menu-visible="activeNodeId === child.id"
         @toggle-menu="handleToggleMenu"
         @learn="handleLearn"
         @practice="handlePractice"
       />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import GraphNode from './GraphNode.vue'

interface ChapterDetails {
  id: string
  name: string
  level?: number | null
  children?: Array<{
    id: string
    name: string
    label: string
    level?: number | null
    children?: Array<{
      id: string
      name: string
      label: string
      level?: number | null
    }>
  }>
}

interface Props {
  chapterDetails: ChapterDetails
  graphIndex?: number
  rotation?: number
  isExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rotation: 0,
  isExpanded: false
})

// 定义事件
const emit = defineEmits<{
  expand: [graphId: string]
}>()

// 路由
const router = useRouter()

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


// 计算背景圆半径
const backgroundRadius = computed(() => {
  if (!containerRef.value) return 180 // 默认值
  
  const container = containerRef.value
  const containerWidth = container.offsetWidth
  const containerHeight = container.offsetHeight
  
  // 背景圆是正方形的内切圆，半径是较小边的一半
  const radius = Math.min(containerWidth, containerHeight) / 2
  
  // 减去边框宽度（2px）和一点内边距，让子节点在圆内
  return Math.max(radius, 100) // 最小半径100px
})

// 获取圆周上的子节点
const getCircularNodes = (chapterDetails: ChapterDetails) => {
  if (!chapterDetails.children) return []
  
  // 初始情况下，只显示level=1的节点（x.x层）
  // 只有在展开状态下，才显示level=2的节点
  if (chapterDetails.level === 1) {
    if (isExpanded.value) {
      // 展开状态：显示level=2的子节点
      return chapterDetails.children.filter(child => child.level === 2)
    } else {
      // 收起状态：不显示任何子节点
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
  console.log('handleCenterNodeClick', props.chapterDetails.id)
  event.stopPropagation() // 阻止事件冒泡到背景
  
  console.log('props.chapterDetails.children?.length', props.chapterDetails.children?.length)
  // 如果没有周围节点，则不执行展开逻辑
  if (!props.chapterDetails.children?.length) {
    console.log('No circular nodes, skipping expand logic')
    return
  }
  
  // 发出展开事件，让父组件控制展开状态
  emit('expand', props.chapterDetails.id)
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
const handleLearn = (node: { id: string; name: string; level?: number | null }) => {
  console.log('去学习:', node)
  activeNodeId.value = null // 关闭气泡框
  // 这里可以添加跳转到学习页面的逻辑
}

// 处理去练习
const handlePractice = (node: { id: string; name: string; level?: number | null }) => {
  console.log('去练习:', node)
  activeNodeId.value = null // 关闭气泡框
  
  // 跳转到练习页面
  router.push('/find-exercise')
}

// 初始化动画状态
const initAnimations = () => {
  animationState.value = 'idle'
  // 展开状态由外部控制，不需要在这里设置
}

// 监听展开状态变化
watch(isExpanded, (newValue) => {
  if (newValue) {
    animateExpand()
  } else {
    animateCollapse()
  }
}, { immediate: true })

// 暴露动画方法给父组件
defineExpose({
  initAnimations
})

// 监听数据变化，重新初始化动画
watch(() => props.chapterDetails, () => {
  if (props.chapterDetails) {
    initAnimations()
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
  initAnimations()
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
  width: 100%; /* 占满整个容器，容器已经是可视区域的三分之二 */
  height: 100%;
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
