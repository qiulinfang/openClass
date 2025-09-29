<template>
  <div class="node-wrapper" :style="nodeStyle">
    <!-- 节点圆形 -->
    <div 
      :class="nodeClasses"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      :ref="(el) => { nodeRef = el as HTMLElement }"
    >
      <!-- 学习标签 -->
      <div v-if="highlighted" class="learning-tag">上次学到</div>
      
      <!-- 中心节点内容在节点内部 -->
      <div v-if="type === 'center'" class="node-content node-content--center">
        <div class="node-title">{{ formatNodeName(node) }}</div>
        <div v-if="node.label" class="node-label">{{ node.label }}</div>
      </div>
      
    </div>
    
    <!-- 非中心节点的内容通过绝对定位脱离文档流 -->
    <div v-if="type === 'circular'" :class="contentClasses">
      <div class="node-title">{{ formatNodeName(node) }}</div>
      <div v-if="node.label" class="node-label">{{ node.label }}</div>
    </div>

    <!-- 气泡框菜单 -->
    <q-menu 
      :model-value="isMenuVisible" 
      anchor="bottom middle" 
      self="top middle"
      :offset="[0, 8]"
      class="node-popup-menu"
    >
      <q-list class="popup-list">
        <q-item 
          clickable 
          v-close-popup 
          @click="handleLearn"
          class="popup-item"
        >
          <q-item-section avatar>
            <q-icon name="school" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>去学习</q-item-label>
          </q-item-section>
        </q-item>
        <q-item 
          clickable 
          v-close-popup 
          @click="handlePractice"
          class="popup-item"
        >
          <q-item-section avatar>
            <q-icon name="quiz" color="secondary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>去练习</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, defineEmits } from 'vue'

interface Node {
  id: string
  name: string
  label?: string
  level?: number | null
}

interface Props {
  node: Node
  type: 'center' | 'circular'
  index?: number
  total?: number
  highlighted?: boolean
  blue?: boolean
  radius?: number
  show?: boolean
  animationState?: 'idle' | 'expanding' | 'expanded' | 'collapsing'
  isMenuVisible?: boolean
  isExpanded?: boolean
  hasExpandedGraph?: boolean
}

interface Emits {
  (e: 'mouseenter', event: Event, isEnter: boolean): void
  (e: 'mouseleave', event: Event, isEnter: boolean): void
  (e: 'click', event: Event): void
  (e: 'learn', node: Node): void
  (e: 'practice', node: Node): void
  (e: 'toggle-menu', nodeId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  highlighted: false,
  blue: false,
  radius: 180,
  show: false,
  animationState: 'idle',
  isMenuVisible: false,
  isExpanded: false,
  hasExpandedGraph: false
})

const emit = defineEmits<Emits>()

const nodeRef = ref<HTMLElement>()


// 格式化节点名称 - 根据层级显示不同格式
const formatNodeName = (node: Node) => {
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
  
  // 中心节点展开状态
  if (props.type === 'center' && props.isExpanded) {
    classes.push('graph-node--expanded')
  }
  
  // 中心节点在其他图谱展开时变小
  if (props.type === 'center' && props.hasExpandedGraph && !props.isExpanded) {
    classes.push('graph-node--shrunk')
  }
  
  // 根据动画状态添加相应的类
  if (props.type === 'circular') {
    if (props.animationState === 'expanding') {
      classes.push('node-enter')
    } else if (props.animationState === 'expanded') {
      classes.push('node-enter') // 保持显示状态，利用forwards保持动画结束状态
    } else if (props.animationState === 'collapsing') {
      classes.push('node-exit')
    }
  }
  
  return classes
})

const contentClasses = computed(() => {
  const classes = ['node-content', 'node-content--circular']
  
  // 中心节点内容展开状态
  if (props.type === 'center' && props.isExpanded) {
    classes.push('node-content--expanded')
  }
  
  // 中心节点内容在其他图谱展开时变小
  if (props.type === 'center' && props.hasExpandedGraph && !props.isExpanded) {
    classes.push('node-content--shrunk')
  }
  
  // 根据动画状态添加相应的类
  if (props.type === 'circular') {
    if (props.animationState === 'expanding') {
      classes.push('content-enter')
    } else if (props.animationState === 'expanded') {
      classes.push('content-enter') // 保持显示状态，利用forwards保持动画结束状态
    } else if (props.animationState === 'collapsing') {
      classes.push('content-exit')
    }
  }
  
  return classes
})

const nodeStyle = computed(() => {
  if (props.type === 'center') {
    return {}
  }
  
  // 为圆周节点添加动画延迟
  const style: Record<string, string | number> = {}
  if (props.type === 'circular' && props.index !== undefined) {
    if (props.animationState === 'expanding') {
      style.animationDelay = `${props.index * 0.1}s`
    } else if (props.animationState === 'collapsing') {
      style.animationDelay = `${props.index * 0.05}s`
    }
  }
  
  if (props.type === 'circular') {
    // 使用KnowledgeGraphView.vue的正确分布算法
    const angle = (2 * Math.PI * (props.index || 0)) / (props.total || 1)
    const radius = props.radius || 180  // 使用传入的半径值，与背景圆保持一致
    
    // 计算节点在圆周上的位置，让节点圆心在圆周上
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    
    // 设置容器居中定位，确保圆形分布以容器中心为圆心
    style.position = 'absolute'
    style.left = '50%'
    style.top = '50%'
    style.marginLeft = '-40px'  // 节点宽度的一半（80px/2）
    style.marginTop = '-40px'   // 节点高度的一半（80px/2）
    // SVG方法：只进行位置变换，不旋转内容
    style.transform = `translate(${x}px, ${y}px)`
  }
  
  return style
})

const handleMouseEnter = (event: Event) => {
  emit('mouseenter', event, true)
}

const handleMouseLeave = (event: Event) => {
  emit('mouseleave', event, false)
}

const handleClick = (event: Event) => {
  console.log("handleClick", props.node.id)
  event.stopPropagation() // 阻止事件冒泡
  emit('toggle-menu', props.node.id)
  emit('click', event)
}

// 处理右键菜单
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault() // 阻止浏览器原生右键菜单
  event.stopPropagation() // 阻止事件冒泡
}

// 处理去学习
const handleLearn = () => {
  emit('learn', props.node)
}

// 处理去练习
const handlePractice = () => {
  emit('practice', props.node)
}




</script>

<style scoped>
.node-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  z-index: 2;
}

.graph-node {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

/* 中心节点样式 - 大圆 */
.graph-node--center {
  width: 150px;
  height: 150px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border-radius: 50%;
  box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
  z-index: 10;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 中心节点展开状态 - 变大 */
.graph-node--center.graph-node--expanded {
  width: 200px;
  height: 200px;
  box-shadow: 0 12px 48px rgba(139, 92, 246, 0.4);
}

/* 中心节点在其他图谱展开时变小 */
.graph-node--center.graph-node--shrunk {
  width: 120px;
  height: 120px;
  box-shadow: 0 6px 24px rgba(139, 92, 246, 0.2);
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
  /* 初始状态隐藏 */
  opacity: 0;
  transform: scale(0);
  transform-origin: center center;
  transition: all 0.3s ease;
}


.graph-node--circular:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
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
  padding: 8px 4px;
  margin-top: 8px;
  max-width: 120px;
  word-wrap: break-word;
}

/* 非中心节点内容通过绝对定位脱离文档流 */
.node-content--circular {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 10;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%) scale(0.8);
  transition: opacity 0.6s cubic-bezier(0.4, 0.0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 节点展开时自动显示内容 - 通过动画类控制，移除静态显示 */

/* 悬停时增强显示效果 */
.graph-node--circular:hover + .node-content--circular {
  opacity: 1;
  transform: translateX(-50%) scale(1.05);
}

/* 中心节点内部内容 */
.node-content--center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  padding: 8px;
  margin-top: 0;
  max-width: 120px;
  text-align: center;
  z-index: 1;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 中心节点内容展开状态 - 字体变大 */
.node-content--center.node-content--expanded {
  max-width: 160px;
}

/* 中心节点内容在其他图谱展开时变小 */
.node-content--center.node-content--shrunk {
  max-width: 100px;
}

/* 中心节点内容样式保持不变 */
.graph-node--center + .node-content {
  color: #374151;
  margin-top: 12px;
  max-width: 140px;
}


/* 标题样式 */
.node-title {
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 4px;
  word-break: break-word;
}

/* 中心节点内部标题 */
.node-content--center .node-title {
  font-size: 12px;
  margin-bottom: 8px;
  color: white;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 中心节点标题展开状态 - 字体变大 */
.node-content--center.node-content--expanded .node-title {
  font-size: 16px;
  margin-bottom: 10px;
}

/* 中心节点标题在其他图谱展开时变小 */
.node-content--center.node-content--shrunk .node-title {
  font-size: 10px;
  margin-bottom: 6px;
}

.graph-node--center + .node-content .node-title {
  font-size: 12px;
  margin-bottom: 8px;
}

/* 非中心节点标题样式 */
.node-content--circular .node-title {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 2px;
  line-height: 1.2;
}

/* 标签样式 */
.node-label {
  opacity: 0.8;
  line-height: 1.1;
}

/* 中心节点内部标签 */
.node-content--center .node-label {
  font-size: 9px;
  color: white;
  opacity: 0.9;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 中心节点标签展开状态 - 字体变大 */
.node-content--center.node-content--expanded .node-label {
  font-size: 12px;
}

/* 中心节点标签在其他图谱展开时变小 */
.node-content--center.node-content--shrunk .node-label {
  font-size: 8px;
}

/* 非中心节点标签样式 */
.node-content--circular .node-label {
  font-size: 9px;
  color: #6b7280;
  opacity: 0.8;
  margin-top: 2px;
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

/* 节点进入动画 */
@keyframes node-enter {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 节点退出动画 */
@keyframes node-exit {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0);
  }
}

/* 内容进入动画 */
@keyframes content-enter {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

/* 内容退出动画 */
@keyframes content-exit {
  0% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.8);
  }
}

/* 节点进入动画类 */
.graph-node--circular.node-enter {
  animation: node-enter 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 节点退出动画类 */
.graph-node--circular.node-exit {
  animation: node-exit 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 内容进入动画类 */
.node-content--circular.content-enter {
  animation: content-enter 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 内容退出动画类 */
.node-content--circular.content-exit {
  animation: content-exit 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 气泡框菜单样式 */
.node-popup-menu {
  .q-menu {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    background: white;
    min-width: 120px;
  }
}

.popup-list {
  padding: 4px;
  
  .popup-item {
    border-radius: 6px;
    margin: 2px 0;
    padding: 8px 12px;
    
    &:hover {
      background: #f3f4f6;
    }
    
    .q-item__section--avatar {
      min-width: 32px;
    }
    
    .q-item__label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }
  }
}

</style>
