<template>
  <div class="knowledge-graph-container" ref="containerRef">
    <div class="knowledge-graph" ref="graphRef">
      <!-- 背景圆形区域表示包含关系 -->
      <div class="containment-background"></div>
      
       <!-- 中心节点 -->
       <GraphNode
         ref="centerNodeRef"
         :node="{ id: 'center', name: chapterDetails.name, level: chapterDetails.level }"
         type="center"
         :progress="60"
         @mouseenter="handleNodeHover"
         @mouseleave="handleNodeHover"
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
         :highlighted="index === 3"
         :blue="index === 1"
         @mouseenter="handleNodeHover"
         @mouseleave="handleNodeHover"
       />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { gsap } from 'gsap'
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
}

const props = withDefaults(defineProps<Props>(), {
  rotation: 0
})

// 模板引用
const containerRef = ref<HTMLElement>()
const graphRef = ref<HTMLElement>()
const centerNodeRef = ref<InstanceType<typeof GraphNode>>()

// 动画时间线
let masterTimeline: gsap.core.Timeline

// 获取圆周上的子节点
const getCircularNodes = (chapterDetails: ChapterDetails) => {
  if (!chapterDetails.children) return []
  
  // 如果是子章节（level=1），显示其子节点（level=2的节点）
  if (chapterDetails.level === 1) {
    return chapterDetails.children.filter(child => child.level === 2)
  }
  
  // 如果是主章节（level=0），显示其子节点（level=1的节点）
  if (chapterDetails.level === 0) {
    return chapterDetails.children.filter(child => child.level === 1)
  }
  
  // 默认返回所有子节点
  return chapterDetails.children
}

const handleNodeHover = (event: Event, isEnter: boolean) => {
  const target = event.target as HTMLElement
  animateNodeHover(target, isEnter)
}

const animateNodeHover = (element: HTMLElement, isEnter: boolean) => {
  if (isEnter) {
    gsap.to(element, {
      scale: 1.1,
      duration: 0.3,
      ease: "back.out(1.7)"
    })
  } else {
    gsap.to(element, {
      scale: 1,
      duration: 0.3,
      ease: "power2.out"
    })
  }
}


// 初始化动画
const initAnimations = async () => {
  await nextTick()
  
  if (!graphRef.value) return
  
  // 创建主时间线
  masterTimeline = gsap.timeline()
  
  // 设置初始状态 - 从屏幕外开始
  gsap.set(graphRef.value, { 
    opacity: 0,
    x: -200, // 从左侧屏幕外开始
    rotation: -180 // 初始旋转
  })
  gsap.set(centerNodeRef.value?.$el, { scale: 0, rotation: 180 })
  
  // 获取所有节点引用
  const circularNodes = []
  const circularNodesCount = getCircularNodes(props.chapterDetails).length
  
  for (let i = 0; i < circularNodesCount; i++) {
    const circularRef = graphRef.value.querySelector(`[data-ref="circularNodeRef${i}"]`)
    if (circularRef) circularNodes.push(circularRef)
  }
  
  // 设置节点初始状态
  gsap.set(circularNodes, { scale: 0, opacity: 0 })
  
  // 创建入场动画序列 - 从屏幕外旋转进入
  masterTimeline
    // 容器从屏幕外旋转进入
    .to(graphRef.value, {
      opacity: 1,
      x: 0,
      rotation: 0,
      duration: 1.2,
      ease: "back.out(1.7)"
    })
    // 中心节点动画
    .to(centerNodeRef.value?.$el, {
      scale: 1,
      rotation: 0,
      duration: 0.8,
      ease: "back.out(1.7)"
    }, "-=0.5")
    // 圆周节点依次出现
    .to(circularNodes, {
      scale: 1,
      opacity: 1,
      duration: 0.6,
      stagger: 0.1,
      ease: "back.out(1.7)"
    }, "-=0.4")
}

// 暴露动画方法给父组件
defineExpose({
  initAnimations,
  animateNodeHover
})

// 监听数据变化，重新初始化动画
watch(() => props.chapterDetails, () => {
  if (props.chapterDetails) {
    initAnimations()
  }
}, { immediate: true })

// 监听旋转角度变化
watch(() => props.rotation, (newRotation) => {
  if (graphRef.value) {
    gsap.to(graphRef.value, {
      rotation: newRotation,
      duration: 0.8,
      ease: "power2.out"
    })
  }
})

onMounted(() => {
  initAnimations()
})
</script>

<style scoped>
.knowledge-graph-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.knowledge-graph {
  position: relative;
  width: 500px;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 背景圆形区域表示包含关系 */
.containment-background {
  position: absolute;
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-radius: 50%;
  z-index: 1;
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}
</style>
