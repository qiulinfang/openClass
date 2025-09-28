<template>
  <div 
    :class="nodeClasses"
    :style="nodeStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
    :ref="(el) => { nodeRef = el as HTMLElement }"
  >
    <!-- 学习标签 -->
    <div v-if="highlighted" class="learning-tag">上次学到</div>
    
     <div class="node-content">
       <div class="node-title">{{ formatNodeName(node) }}</div>
       <div v-if="node.label" class="node-label">{{ node.label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, defineEmits, onMounted } from 'vue'

interface Node {
  id: string
  name: string
  label?: string
  level?: number | null
}

interface Props {
  node: Node
  type: 'center' | 'circular' | 'outer'
  index?: number
  total?: number
  parentIndex?: number
  totalParents?: number
  highlighted?: boolean
  blue?: boolean
}

interface Emits {
  (e: 'mouseenter', event: Event, isEnter: boolean): void
  (e: 'mouseleave', event: Event, isEnter: boolean): void
  (e: 'click', event: Event): void
}

const props = withDefaults(defineProps<Props>(), {
  highlighted: false,
  blue: false
})

const emit = defineEmits<Emits>()

const nodeRef = ref<HTMLElement>()

// 格式化节点名称 - 根据层级显示不同格式
const formatNodeName = (node: Node) => {
  console.log("格式化节点名称",node)
  if (props.type === 'center') {
    // 中心节点使用对应数据结构的name
    return node.name
  } else if (props.type === 'circular') {
    // 圆周节点使用对应数据结构的name
    return node.name
  }
  
  return node.name
}

const nodeClasses = computed(() => {
  const classes = ['graph-node', `graph-node--${props.type}`]
  if (props.highlighted) classes.push('graph-node--highlighted')
  if (props.blue) classes.push('graph-node--blue')
  return classes
})

const nodeStyle = computed(() => {
  if (props.type === 'center') {
    return {}
  }
  
  if (props.type === 'circular') {
    const angle = (2 * Math.PI * (props.index || 0)) / (props.total || 1)
    const radius = 180  // 调整半径，让子节点分布在大圆边上
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    return {
      transform: `translate(${x}px, ${y}px)`
    }
  }
  
  if (props.type === 'outer') {
    // 计算外围节点的位置
    const parentAngle = (2 * Math.PI * (props.parentIndex || 0)) / (props.totalParents || 1)
    const parentRadius = 200
    const parentX = Math.cos(parentAngle) * parentRadius
    const parentY = Math.sin(parentAngle) * parentRadius
    
    const childAngle = (2 * Math.PI * (props.index || 0)) / (props.total || 1)
    const childRadius = 80
    const childX = Math.cos(childAngle) * childRadius
    const childY = Math.sin(childAngle) * childRadius
    
    return {
      transform: `translate(${parentX + childX}px, ${parentY + childY}px)`
    }
  }
  
  return {}
})

const handleMouseEnter = (event: Event) => {
  emit('mouseenter', event, true)
}

const handleMouseLeave = (event: Event) => {
  emit('mouseleave', event, false)
}

const handleClick = (event: Event) => {
  emit('click', event)
}

// 进度条动画已移除

onMounted(() => {
  // 进度条动画已移除
})
</script>

<style scoped>
.graph-node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

/* 中心节点样式 - 大圆 */
.graph-node--center {
  width: 150px;
  height: 150px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border-radius: 50%;
  box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
  z-index: 10;
}

.graph-node--center:hover {
  box-shadow: 0 12px 40px rgba(139, 92, 246, 0.4);
}

/* 圆周节点样式 - 小圆 */
.graph-node--circular {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border: 2px solid #d1d5db;
  border-radius: 50%;
  z-index: 5;
}

.graph-node--circular:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

/* 外围节点样式 */
.graph-node--outer {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border: 1px solid #d1d5db;
  border-radius: 50%;
  z-index: 3;
}

.graph-node--outer:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
}

/* 高亮状态 */
.graph-node--highlighted {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-color: #f59e0b;
  box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
}

.graph-node--blue {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #2563eb;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
}

/* 节点内容 */
.node-content {
  color: #374151;
  padding: 8px;
}

.graph-node--center .node-content {
  color: white;
  padding: 8px;
}

.graph-node--highlighted .node-content,
.graph-node--blue .node-content {
  color: white;
}

.graph-node--outer .node-content {
  color: #6b7280;
  padding: 6px;
}

/* 标题样式 */
.node-title {
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 4px;
  word-break: break-word;
}

.graph-node--center .node-title {
  font-size: 12px;
  margin-bottom: 8px;
}

.graph-node--circular .node-title {
  font-size: 11px;
}

.graph-node--outer .node-title {
  font-size: 10px;
  margin-bottom: 2px;
}

/* 标签样式 */
.node-label {
  opacity: 0.8;
  line-height: 1.1;
}

.graph-node--circular .node-label {
  font-size: 9px;
}

.graph-node--outer .node-label {
  font-size: 8px;
}

/* 学习标签 */
.learning-tag {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: #fbbf24;
  color: white;
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
  z-index: 10;
}

/* 进度条样式已移除 */
</style>
