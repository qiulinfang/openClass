<template>
  <div class="node-wrapper" :style="nodeStyle">
    <!-- 学习标签 -->
    <div v-if="learningStatus === 'lastLearned'" class="learning-tag">上次学到</div>
      
    <!-- 节点圆形 -->
    <div 
      :class="nodeClasses"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      :ref="(el) => { nodeRef = el as HTMLElement }"
    >
      <!-- 背景图标 -->
      <div class="node-icon" :style="{ backgroundImage: `url(${nodeIcon})` }"></div>
      
      <!-- 中心节点内容在节点内部 -->
      <div v-if="type === 'center'" :class="contentClasses">
        <div class="node-title">{{ formatNodeTitle(node) }}</div>
        <div class="node-chapter">{{ formatNodeChapter(node) }}</div>
      </div>
      
    </div>
    
    <!-- 非中心节点的内容通过绝对定位脱离文档流 -->
    <div v-if="type === 'circular'" :class="contentClasses">
      <div class="node-title">{{ formatNodeName(node) }}</div>
    </div>

    <!-- 手动定位的气泡框菜单 - 对圆周节点和中心节点都显示 -->
    <div 
      v-if="isMenuVisible" 
      class="manual-bubble-menu"
      :style="bubbleMenuStyle"
    >
      <div class="bubble-menu-container">
        <button 
          class="bubble-menu-button bubble-menu-button--learn"
          @click="handleLearn"
        >
          去学习
        </button>
        <button 
          class="bubble-menu-button bubble-menu-button--practice"
          @click="handlePractice"
        >
          去练习
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, defineEmits } from 'vue'

// 流程：导入图标资源
import centerNodeIcon from '/icons/centerNode.svg'
import learnedIcon from '/icons/learned.svg'
import lastLearnedIcon from '/icons/lastLearned.svg'
import notLearnedIcon from '/icons/notLearned.svg'

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
  radius?: number
  show?: boolean
  animationState?: 'idle' | 'expanding' | 'expanded' | 'collapsing'
  isMenuVisible?: boolean
  isExpanded?: boolean
  hasExpandedGraph?: boolean
  learningStatus?: 'notLearned' | 'learned' | 'lastLearned'
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
  radius: 180,
  show: false,
  animationState: 'idle',
  isMenuVisible: false,
  isExpanded: false,
  hasExpandedGraph: false,
  learningStatus: 'notLearned'
})

const emit = defineEmits<Emits>()

const nodeRef = ref<HTMLElement>()

/**
 * 获取节点在圆周上的角度（弧度制）
 * 根据节点数量使用固定角度分布或等间距分布
 * 
 * @param index 节点索引（从0开始）
 * @param total 节点总数
 * @returns 角度（弧度）
 */
const getNodeAngle = (index: number, total: number): number => {
  // 固定角度分布表（角度制，需转换为弧度）
  const fixedAngles: Record<number, number[]> = {
    1: [180],
    2: [0, 180],
    3: [270, 30, 150],
    4: [270, 0, 90, 180],
    5: [270, 342, 54, 126, 198]
  }
  
  // 如果节点数量在1-5之间，使用固定角度分布
  if (total >= 1 && total <= 5 && fixedAngles[total]) {
    const angleDegrees = fixedAngles[total][index] || 0
    // 将角度转换为弧度（角度 * π / 180）
    return (angleDegrees * Math.PI) / 180
  }
  
  // 超过5个节点，使用等间距分布
  return (2 * Math.PI * index) / total
}

// 获取节点背景图标
const nodeIcon = computed(() => {
  if (props.type === 'center') {
    return centerNodeIcon
  } else {
    // 圆周节点根据学习状态选择图标
    switch (props.learningStatus) {
      case 'learned':
        return learnedIcon
      case 'lastLearned':
        return lastLearnedIcon
      case 'notLearned':
      default:
        return notLearnedIcon
    }
  }
})

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

// 格式化中心节点标题（编号部分）
const formatNodeTitle = (node: Node) => {
  if (props.type === 'center' && node.name) {
    // 解析格式如 "5.2 数学探究活动：由编号样本估计总数及其模拟"
    const match = node.name.match(/^(\d+\.\d+)/)
    return match ? match[1] : node.name
  }
  return node.name
}

// 格式化中心节点章节名
const formatNodeChapter = (node: Node) => {
  if (props.type === 'center' && node.name) {
    // 解析格式如 "5.2 数学探究活动：由编号样本估计总数及其模拟"
    const match = node.name.match(/^\d+\.\d+\s+(.+)/)
    return match ? match[1] : ''
  }
  return ''
}

const nodeClasses = computed(() => {
  const classes = ['graph-node', `graph-node--${props.type}`]
  
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
    
    // 圆周节点在其他图谱展开时变小
    if (props.hasExpandedGraph && !props.isExpanded) {
      classes.push('graph-node--shrunk')
    }
  }
  
  return classes
})

const contentClasses = computed(() => {
  const classes = ['node-content']
  
  // 根据节点类型添加基础类
  if (props.type === 'center') {
    classes.push('node-content--center')
  } else {
    classes.push('node-content--circular')
  }
  
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
    
    // 圆周节点内容在其他图谱展开时变小
    if (props.hasExpandedGraph && !props.isExpanded) {
      classes.push('node-content--shrunk')
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
    // 使用固定角度分布或等间距分布
    const angle = getNodeAngle(props.index || 0, props.total || 1)
    const radius = props.radius || 180  // 使用传入的半径值，与背景圆保持一致
    
    // 计算节点在圆周上的位置，让节点圆心在圆周上
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    
    // 设置容器居中定位，确保圆形分布以容器中心为圆心
    style.position = 'absolute'
    style.left = '50%'
    style.top = '50%'
    style.marginLeft = '-50px'  // 节点宽度的一半（100px/2）
    style.marginTop = '-50px'   // 节点高度的一半（100px/2）
    // SVG方法：只进行位置变换，不旋转内容
    style.transform = `translate(${x}px, ${y}px)`
  }
  
  return style
})

// 计算气泡框菜单的定位样式
const bubbleMenuStyle = computed(() => {
  if (!props.isMenuVisible) {
    return {}
  }
  
  if (props.type === 'center') {
    // 中心节点的气泡框定位在节点下方
    return {
      position: 'absolute' as const,
      top: 'calc(100% + 20px)', // 节点下方 + 间距
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20 // 确保在其他元素之上
    }
  } else {
    // 圆周节点的气泡框定位在node-title文字下面
    // node-content--circular已经定位在节点下方，气泡框需要定位在内容下方
    return {
      position: 'absolute' as const,
      top: 'calc(100% + 8px + 3.5rem)', // 节点下方 + 间距 + node-title高度（字体增大后需要更多空间）+ 额外下移
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20 // 确保在其他元素之上
    }
  }
})

const handleMouseEnter = (event: Event) => {
  emit('mouseenter', event, true)
}

const handleMouseLeave = (event: Event) => {
  emit('mouseleave', event, false)
}

const handleClick = (event: Event) => {
  event.stopPropagation() // 阻止事件冒泡
  
  // 如果是中心节点，只有在知识图谱展开状态下才显示气泡框
  if (props.type === 'center') {
    if (props.isExpanded) {
      emit('toggle-menu', props.node.id)
    }
  } else {
    // 圆周节点正常显示气泡框
    emit('toggle-menu', props.node.id)
  }
  
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
  width: 180px;
  height: 180px;
  background: transparent;
  z-index: 10;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* 中心节点展开状态 - 变大 */
.graph-node--center.graph-node--expanded {
  width: 240px;
  height: 240px;
}

/* 中心节点在其他图谱展开时变小 */
.graph-node--center.graph-node--shrunk {
  width: 140px;
  height: 140px;
}

/* 圆周节点样式 - 小圆 */
.graph-node--circular {
  width: 100px;
  height: 100px;
  background: transparent;
  border: none;
  border-radius: 50%;
  z-index: 5;
  /* 初始状态隐藏 */
  opacity: 0;
  transform: scale(0);
  transform-origin: center center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}


.graph-node--circular:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

/* 节点图标样式 */
.node-icon {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 1;
}




/* 节点内容 */
.node-content {
  color: #374151;
  padding: 8px 4px;
  margin-top: 8px;
  max-width: 140px;
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
  font-size: 0.875rem; /* 14px × 1.75 = 24.5px */
  font-weight: normal;
  color: white;
  width: 150%;
  overflow: hidden;
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
  padding: 4px;
  margin-top: 0;
  text-align: center;
  z-index: 1;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
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
  font-size: 190%; /* 节点宽度的180% */
  margin-top: -8px; /* 第1步：向上占据一些空间 */
  margin-bottom: 4px; /* 第2步：增加与章节名的间距 */
  color: white;
  font-family: '优设标题黑', 'YouSheBiaoTiHei', sans-serif;
  font-weight: bold;
  text-align: center;
  line-height: 1.0;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  width: 100%;
  display: block;
  white-space: nowrap; /* 第3步：禁止文字换行 */
}

/* 中心节点标题展开状态 - 字体保持不变 */
.node-content--center.node-content--expanded .node-title {
  font-size: 190%; /* 第1步：保持与默认状态相同的字体大小 */
  margin-top: -8px; /* 第2步：向上占据一些空间 */
  margin-bottom: 4px; /* 第3步：增加与章节名的间距 */
  line-height: 1.0;
  white-space: nowrap; /* 第4步：禁止文字换行 */
}

/* 中心节点标题在其他图谱展开时字体保持不变 */
.node-content--center.node-content--shrunk .node-title {
  font-size: 190%; /* 第1步：保持与默认状态相同的字体大小 */
  margin-top: -8px; /* 第2步：向上占据一些空间 */
  margin-bottom: 4px; /* 第3步：增加与章节名的间距 */
  line-height: 1.0;
  white-space: nowrap; /* 第4步：禁止文字换行 */
}

.graph-node--center + .node-content .node-title {
  font-size: 12px;
  margin-bottom: 8px;
}

/* 非中心节点标题样式 */
.node-content--circular .node-title {
  font-size: 1.2rem; /* 16px × 1.75 = 28px */
  font-weight: normal;
  color: white;
  margin-bottom: 2px;
  line-height: 1.2;
  width: 100%;
  text-align: center;
  /* 多行文本截断：最多显示两行，超出部分用省略号 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 圆周节点标题在其他图谱展开时变小 */
.node-content--circular.node-content--shrunk .node-title {
  font-size: 0.875rem; /* 14px × 1.75 = 24.5px */
  line-height: 1.1;
}


/* 中心节点章节名样式 */
.node-content--center .node-chapter {
  font-size: 140%; /* 节点宽度的130% */
  color: white;
  font-family: 'PingFang SC', 'PingFangSC-Regular', sans-serif;
  font-weight: normal;
  text-align: center;
  line-height: 1.4; /* 第1步：增加行高，改善可读性 */
  opacity: 0.9;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  width: 100%;
  display: block;
  white-space: nowrap; /* 第2步：禁止文字换行 */
  overflow: hidden; /* 第3步：隐藏超出部分 */
  text-overflow: ellipsis; /* 第4步：超出部分显示省略号 */
  margin-bottom: 2px; /* 第5步：底部留一些间距 */
}

/* 中心节点章节名展开状态 - 字体保持不变 */
.node-content--center.node-content--expanded .node-chapter {
  font-size: 140%; /* 第1步：保持与默认状态相同的字体大小 */
  line-height: 1.4; /* 第2步：增加行高，改善可读性 */
  white-space: nowrap; /* 第3步：禁止文字换行 */
  overflow: hidden; /* 第4步：隐藏超出部分 */
  text-overflow: ellipsis; /* 第5步：超出部分显示省略号 */
  margin-bottom: 2px; /* 第6步：底部留一些间距 */
}

/* 中心节点章节名在其他图谱展开时字体保持不变 */
.node-content--center.node-content--shrunk .node-chapter {
  font-size: 140%; /* 第1步：保持与默认状态相同的字体大小 */
  line-height: 1.4; /* 第2步：增加行高，改善可读性 */
  white-space: nowrap; /* 第3步：禁止文字换行 */
  overflow: hidden; /* 第4步：隐藏超出部分 */
  text-overflow: ellipsis; /* 第5步：超出部分显示省略号 */
  margin-bottom: 2px; /* 第6步：底部留一些间距 */
}



/* 学习标签 */
.learning-tag {
  position: absolute;
  top: 3%;
  left: 100%;
  transform: translateX(-50%);
  background: #ff6767;
  color: white;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 14px 9px 9px 0;
  font-weight: 400;
  white-space: nowrap;
  width: 70px;
  height: 20px;
  line-height: 16px;
  z-index: 10;
  transition: all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  pointer-events: none; /* 禁用点击事件 */
}

/* 学习标签在节点缩小时变小 */
.graph-node--shrunk .learning-tag {
  font-size: 9px;
  padding: 1px 4px;
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

/* 手动定位的气泡框菜单 */
.manual-bubble-menu {
  position: absolute;
  z-index: 20;
  pointer-events: auto;
  /* 确保气泡框在中心节点下方正确显示 */
  width: max-content;
}

/* 气泡框容器 */
.bubble-menu-container {
  background: #4A3A6B; /* 深紫色背景 */
  border-radius: 20px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
}

/* 气泡框按钮基础样式 */
.bubble-menu-button {
  border: none;
  border-radius: 21px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'PingFang SC', 'PingFangSC-Regular', sans-serif;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
}

/* 学习按钮样式 - 紫色半透明 */
.bubble-menu-button--learn {
  background: rgba(129, 95, 255, 0.9); /* 学习按钮半透明背景 #815FFF */
  
  &:hover {
    background: rgba(107, 79, 255, 1); /* 悬停时稍深的紫色半透明 */
  }
}

/* 练习按钮样式 - 橙色半透明 */
.bubble-menu-button--practice {
  background: rgba(255, 151, 103, 0.9); /* 练习按钮半透明背景 #FF9767 */
  
  &:hover {
    background: rgba(255, 138, 77, 1); /* 悬停时稍深的橙色半透明 */
  }
}

</style>
