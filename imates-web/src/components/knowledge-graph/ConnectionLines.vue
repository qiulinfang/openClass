<template>
  <svg class="connection-lines" viewBox="0 0 800 800" ref="svgRef">
    <!-- 从圆心到子章节的连接线 -->
    <line 
      v-for="(child, index) in (chapterDetails.children || [])" 
      :key="`line-${child.id}`"
      :x1="400" 
      :y1="400" 
      :x2="getCircularNodePosition(index, chapterDetails.children?.length || 0).x + 400" 
      :y2="getCircularNodePosition(index, chapterDetails.children?.length || 0).y + 400"
      stroke="#8b5cf6" 
      stroke-width="2"
      opacity="0.6"
      class="connection-line main-line"
      :data-node-id="child.id"
    />
    <!-- 从子章节到其children的连接线 -->
    <template v-for="(child, childIndex) in (chapterDetails.children || [])" :key="`outer-lines-${child.id}`">
      <line 
        v-for="(grandChild, grandChildIndex) in (child.children || [])" 
        :key="`outer-line-${grandChild.id}`"
        :x1="getCircularNodePosition(childIndex, chapterDetails.children?.length || 0).x + 400" 
        :y1="getCircularNodePosition(childIndex, chapterDetails.children?.length || 0).y + 400"
        :x2="getOuterNodePosition(grandChildIndex, child.children?.length || 0, childIndex, chapterDetails.children?.length || 0).x + 400" 
        :y2="getOuterNodePosition(grandChildIndex, child.children?.length || 0, childIndex, chapterDetails.children?.length || 0).y + 400"
        stroke="#a855f7" 
        stroke-width="1.5"
        opacity="0.4"
        class="connection-line outer-line"
        :data-node-id="grandChild.id"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { defineProps, ref, onMounted } from 'vue'
import { gsap } from 'gsap'

interface ChapterDetails {
  id: string
  name: string
  children?: Array<{
    id: string
    name: string
    label: string
    children?: Array<{
      id: string
      name: string
      label: string
    }>
  }>
}

interface Props {
  chapterDetails: ChapterDetails
}

const props = defineProps<Props>()

// 模板引用
const svgRef = ref<SVGElement>()

// 动画时间线
let linesTimeline: gsap.core.Timeline | null = null

// 计算圆周节点位置
const getCircularNodePosition = (index: number, total: number) => {
  const angle = (2 * Math.PI * index) / total
  const radius = 200
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  }
}

// 计算外围节点位置
const getOuterNodePosition = (index: number, total: number, parentIndex: number, totalParents: number) => {
  // 父节点位置
  const parentAngle = (2 * Math.PI * parentIndex) / totalParents
  const parentRadius = 200
  const parentX = Math.cos(parentAngle) * parentRadius
  const parentY = Math.sin(parentAngle) * parentRadius
  
  // 子节点相对于父节点的位置
  const childAngle = (2 * Math.PI * index) / total
  const childRadius = 80
  const childX = Math.cos(childAngle) * childRadius
  const childY = Math.sin(childAngle) * childRadius
  
  return {
    x: parentX + childX,
    y: parentY + childY
  }
}

// 连接线动画
const animateLines = () => {
  if (!svgRef.value) return
  
  // 清除之前的动画
  if (linesTimeline) {
    linesTimeline.kill()
  }
  
  linesTimeline = gsap.timeline()
  
  // 获取所有连接线
  const mainLines = svgRef.value.querySelectorAll('.main-line')
  const outerLines = svgRef.value.querySelectorAll('.outer-line')
  
  // 设置初始状态
  gsap.set(mainLines, { 
    strokeDasharray: "0, 1000",
    opacity: 0 
  })
  gsap.set(outerLines, { 
    strokeDasharray: "0, 1000",
    opacity: 0 
  })
  
  // 主连接线动画
  linesTimeline
    .to(mainLines, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    })
    .to(mainLines, {
      strokeDasharray: "5, 5",
      duration: 1.5,
      ease: "power2.out"
    }, "-=0.2")
    // 外围连接线动画
    .to(outerLines, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    }, "-=0.5")
    .to(outerLines, {
      strokeDasharray: "3, 3",
      duration: 1.2,
      ease: "power2.out"
    }, "-=0.2")
    // 添加流动效果
    .to(mainLines, {
      strokeDashoffset: -10,
      duration: 2,
      ease: "none",
      repeat: -1
    }, "-=0.5")
    .to(outerLines, {
      strokeDashoffset: -6,
      duration: 3,
      ease: "none",
      repeat: -1
    }, "-=1.5")
}

// 高亮连接线
const highlightLines = (nodeId: string) => {
  if (!svgRef.value) return
  
  const allLines = svgRef.value.querySelectorAll('.connection-line')
  
  // 重置所有线条
  gsap.to(allLines, {
    strokeWidth: 2,
    opacity: 0.6,
    duration: 0.3,
    ease: "power2.out"
  })
  
  // 高亮相关线条
  const relatedLines = svgRef.value.querySelectorAll(`[data-node-id="${nodeId}"]`)
  gsap.to(relatedLines, {
    strokeWidth: 4,
    opacity: 1,
    duration: 0.3,
    ease: "power2.out"
  })
}

// 重置连接线
const resetLines = () => {
  if (!svgRef.value) return
  
  const allLines = svgRef.value.querySelectorAll('.connection-line')
  gsap.to(allLines, {
    strokeWidth: 2,
    opacity: 0.6,
    duration: 0.3,
    ease: "power2.out"
  })
}

onMounted(() => {
  // 延迟执行连接线动画，等待节点动画完成
  setTimeout(() => {
    animateLines()
  }, 1500)
})

// 暴露方法给父组件
defineExpose({
  animateLines,
  highlightLines,
  resetLines
})
</script>

<style scoped>
.connection-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.connection-line {
  /* GSAP will handle all animations */
}
</style>
