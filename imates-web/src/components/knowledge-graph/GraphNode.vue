<template>
  <div 
    :class="nodeClasses"
    :style="nodeStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :ref="(el) => { nodeRef = el as HTMLElement }"
  >
    <!-- 学习标签 -->
    <div v-if="highlighted" class="learning-tag">上次学到</div>
    
     <div class="node-content">
       <div class="node-title">{{ formatNodeName(node) }}</div>
       <div v-if="node.label" class="node-label">{{ node.label }}</div>
      <!-- 中心节点进度条 -->
      <div v-if="type === 'center'" class="progress-container">
        <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, defineEmits, onMounted, watch } from 'vue'
import { gsap } from 'gsap'

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
  progress?: number
}

interface Emits {
  (e: 'mouseenter', event: Event, isEnter: boolean): void
  (e: 'mouseleave', event: Event, isEnter: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  highlighted: false,
  blue: false,
  progress: 0
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

// GSAP动画相关
let hoverAnimation: gsap.core.Timeline | null = null
let pulseAnimation: gsap.core.Timeline | null = null

const handleMouseEnter = (event: Event) => {
  emit('mouseenter', event, true)
  animateHover(true)
}

const handleMouseLeave = (event: Event) => {
  emit('mouseleave', event, false)
  animateHover(false)
}

// 悬停动画
const animateHover = (isEnter: boolean) => {
  if (!nodeRef.value) return
  
  if (hoverAnimation) {
    hoverAnimation.kill()
  }
  
  if (isEnter) {
    hoverAnimation = gsap.timeline()
    hoverAnimation
      .to(nodeRef.value, {
        scale: 1.1,
        duration: 0.3,
        ease: "back.out(1.7)"
      })
      .to(nodeRef.value, {
        boxShadow: "0 8px 25px rgba(0, 0, 0, 0.15)",
        duration: 0.3,
        ease: "power2.out"
      }, 0)
  } else {
    hoverAnimation = gsap.timeline()
    hoverAnimation
      .to(nodeRef.value, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out"
      })
      .to(nodeRef.value, {
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
        duration: 0.3,
        ease: "power2.out"
      }, 0)
  }
}

// 高亮动画
const animateHighlight = (isHighlighted: boolean) => {
  if (!nodeRef.value) return
  
  if (isHighlighted) {
    gsap.to(nodeRef.value, {
      scale: 1.15,
      boxShadow: "0 0 20px rgba(139, 92, 246, 0.6)",
      duration: 0.4,
      ease: "power2.out"
    })
    
    // 添加脉冲效果
    if (pulseAnimation) {
      pulseAnimation.kill()
    }
    pulseAnimation = gsap.timeline({ repeat: -1 })
    pulseAnimation
      .to(nodeRef.value, {
        scale: 1.2,
        duration: 1,
        ease: "power2.inOut"
      })
      .to(nodeRef.value, {
        scale: 1.15,
        duration: 1,
        ease: "power2.inOut"
      })
  } else {
    if (pulseAnimation) {
      pulseAnimation.kill()
    }
    gsap.to(nodeRef.value, {
      scale: 1,
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
      duration: 0.4,
      ease: "power2.out"
    })
  }
}

// 蓝色状态动画
const animateBlueState = (isBlue: boolean) => {
  if (!nodeRef.value) return
  
  if (isBlue) {
    gsap.to(nodeRef.value, {
      scale: 1.1,
      boxShadow: "0 0 15px rgba(59, 130, 246, 0.5)",
      duration: 0.3,
      ease: "power2.out"
    })
  } else {
    gsap.to(nodeRef.value, {
      scale: 1,
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
      duration: 0.3,
      ease: "power2.out"
    })
  }
}

// 进度条动画
const animateProgress = () => {
  if (!nodeRef.value || props.type !== 'center') return
  
  const progressBar = nodeRef.value.querySelector('.progress-bar')
  if (progressBar) {
    gsap.fromTo(progressBar, 
      { width: "0%" },
      { 
        width: `${props.progress}%`,
        duration: 1.5,
        ease: "power2.out",
        delay: 0.5
      }
    )
  }
}

// 暴露动画方法给父组件
defineExpose({
  animateHover,
  animateHighlight,
  animateBlueState,
  animateProgress
})

// 监听高亮状态变化
watch(() => props.highlighted, (newVal) => {
  animateHighlight(newVal)
})

// 监听蓝色状态变化
watch(() => props.blue, (newVal) => {
  animateBlueState(newVal)
})

onMounted(() => {
  if (nodeRef.value) {
    // 设置初始状态
    gsap.set(nodeRef.value, {
      scale: 0,
      opacity: 0,
      rotation: props.type === 'center' ? 180 : 0
    })
    
    // 根据节点类型设置不同的入场动画
    let animationConfig = {}
    
    switch (props.type) {
      case 'center':
        animationConfig = {
          scale: 1,
          opacity: 1,
          rotation: 0,
          duration: 0.8,
          ease: "back.out(1.7)"
        }
        break
      case 'circular':
        animationConfig = {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: "back.out(1.7)"
        }
        break
      case 'outer':
        animationConfig = {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out"
        }
        gsap.set(nodeRef.value, { y: 20 })
        break
    }
    
    // 执行入场动画
    gsap.to(nodeRef.value, animationConfig)
    
    // 如果是中心节点，延迟执行进度条动画
    if (props.type === 'center') {
      setTimeout(() => {
        animateProgress()
      }, 1000)
    }
  }
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
  transform: scale(1.05);
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
  transform: scale(1.1) !important;
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
  transform: scale(1.1) !important;
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

/* 进度条样式 */
.progress-container {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-bar {
  height: 100%;
  background: white;
  border-radius: 2px;
  transition: width 0.3s ease;
}
</style>
