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
import { ref, onMounted } from 'vue'

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

defineProps<Props>()

// 模板引用
const svgRef = ref<SVGElement>()

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

// 连接线动画 - 已移除
const animateLines = () => {
  // 保留方法但不执行动画
}

// 高亮连接线 - 已移除
const highlightLines = () => {
  // 保留方法但不执行动画
}

// 重置连接线 - 已移除
const resetLines = () => {
  // 保留方法但不执行动画
}

onMounted(() => {
  // 连接线动画已移除
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

/* 连接线样式已移除 */
</style>
