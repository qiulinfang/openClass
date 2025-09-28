<template>
  <div class="knowledge-graph-container" ref="containerRef">
    <div class="knowledge-graph" ref="graphRef">
      <!-- 背景圆形区域表示包含关系 -->
      <div 
        class="containment-background" 
        @click="handleBackgroundClick"
        :class="{ 'expanded': isExpanded }"
      ></div>
      
       <!-- 中心节点 -->
       <GraphNode
         ref="centerNodeRef"
         :node="{ id: 'center', name: chapterDetails.name, level: chapterDetails.level }"
         type="center"
         :class="{ 'expanded': isExpanded }"
         @mouseenter="handleNodeHover"
         @mouseleave="handleNodeHover"
       />
      
       <!-- 圆周上的子节点 -->
        {{ getCircularNodes(chapterDetails) }}
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
         :class="{ 'expanded': isExpanded }"
         @mouseenter="handleNodeHover"
         @mouseleave="handleNodeHover"
       />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
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

// 展开状态
const isExpanded = ref(false)

// 动画时间线 - 已移除

// 获取圆周上的子节点
const getCircularNodes = (chapterDetails: ChapterDetails) => {
  console.log('获取圆周上的子节点', chapterDetails)
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

const handleNodeHover = () => {
  // 保留事件处理，但不执行动画
}

// 处理背景圆形区域点击
const handleBackgroundClick = () => {
  console.log("handleBackgroundClick", isExpanded.value)
  isExpanded.value = !isExpanded.value
}


// 初始化动画
const initAnimations = async () => {
  await nextTick()
  
  if (!graphRef.value) return
}

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

// 监听旋转角度变化
watch(() => props.rotation, (newRotation) => {
  if (graphRef.value) {
    graphRef.value.style.transform = `rotate(${newRotation}deg)`
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
  width: 60%;
  height: 60%;
  min-width: 300px;
  min-height: 300px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-radius: 50%;
  z-index: 1;
  cursor: pointer;
  transition: all 0.3s ease;
  transform-origin: center center;
  
  &:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.08) 100%);
    border-color: rgba(139, 92, 246, 0.3);
  }
  
  &.expanded {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%);
    border-color: rgba(139, 92, 246, 0.4);
  }
}
</style>
