<template>
  <div class="node-wrapper" :class="wrapperClasses" :style="wrapperStyle">
    <!-- 学习标签 -->
    <div 
      v-if="learningStatus === 'lastLearned'" 
      class="learning-tag"
      :class="learningTagClasses"
      :style="learningTagStyle"
    >上次学到</div>
      
      <!-- 节点圆形 -->
    <div 
      :class="nodeClasses"
      :style="{
        ...(type === 'circular' ? nodeStyle : centerNodeStyle),
        ...nodeStyleVariables
      }"
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
      :class="{ 'manual-bubble-menu--top': menuPosition === 'top' }"
      :style="bubbleMenuStyle"
      :ref="(el) => { menuRef = el as HTMLElement }"
      @click.stop
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
import { computed, ref, defineProps, defineEmits, inject, nextTick, watch, onUnmounted, type Ref } from 'vue'
import type { KnowledgeGraphDebugParams } from '../debug/KnowledgeGraphDebugPanel.vue'

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
const menuRef = ref<HTMLElement>()

// 第1步：获取调试参数
const debugParams = inject<Ref<KnowledgeGraphDebugParams> | undefined>('knowledgeGraphDebugParams', undefined)

// 第2步：气泡框菜单定位方向（'top' 在上方，'bottom' 在下方）
const menuPosition = ref<'top' | 'bottom'>('bottom')

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

// 计算所有 CSS 变量值
const nodeStyleVariables = computed(() => {
  const params = debugParams?.value
  return {
    '--node-animation-duration': `${params?.nodeEnterExitDuration ?? 0.6}s`,
    '--node-base-transition-duration': `${params?.nodeBaseTransitionDuration ?? 0.3}s`,
    '--node-content-transition-duration': `${params?.nodeContentTransitionDuration ?? 0.3}s`,
    '--node-active-transition-duration': `${params?.nodeActiveTransitionDuration ?? 0.1}s`,
    '--learning-tag-transition-duration': `${params?.learningTagTransitionDuration ?? 0.3}s`,
    '--bubble-button-transition-duration': `${params?.bubbleButtonTransitionDuration ?? 0.2}s`
  }
})

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

// 第2步：计算中心节点的样式（包括大小）
const centerNodeStyle = computed(() => {
  if (props.type !== 'center') {
    return {}
  }
  
  // 第3步：根据节点状态获取对应的大小
  let size = debugParams?.value?.centerNodeSizeDefault ?? 180 // 默认大小
  
  if (props.isExpanded) {
    // 展开状态：使用放大后大小
    size = debugParams?.value?.centerNodeSizeExpanded ?? 240
  } else if (props.hasExpandedGraph && !props.isExpanded) {
    // 缩小状态：其他图谱展开时，中心节点变小
    size = debugParams?.value?.centerNodeSizeShrunk ?? 140
  }
  
  // 第4步：获取缩放速度（从 debugParams 中读取）
  const scaleSpeed = debugParams?.value?.centerNodeScaleSpeed ?? 0.5
  
  // 第5步：返回样式对象（包括大小和过渡时间）
  return {
    width: `${size}px`,
    height: `${size}px`,
    transition: `all ${scaleSpeed}s cubic-bezier(0.4, 0.0, 0.2, 1)`
  }
})

const nodeStyle = computed(() => {
  if (props.type === 'center') {
    return {}
  }
  
  // 为圆周节点添加动画延迟
  const style: Record<string, string | number> = {}
  if (props.type === 'circular' && props.index !== undefined) {
    if (props.animationState === 'expanding') {
      const delayInterval = debugParams?.value?.nodeExpandDelayInterval ?? 0.1
      style.animationDelay = `${props.index * delayInterval}s`
    } else if (props.animationState === 'collapsing') {
      const delayInterval = debugParams?.value?.nodeCollapseDelayInterval ?? 0.05
      style.animationDelay = `${props.index * delayInterval}s`
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
    // 使用调试参数中的偏移量，默认值为节点宽度/高度的一半（50px）
    const offsetX = debugParams?.value?.circularNodeOffsetX ?? 50
    const offsetY = debugParams?.value?.circularNodeOffsetY ?? 50
    style.marginLeft = `-${offsetX}px`
    style.marginTop = `-${offsetY}px`
    // SVG方法：只进行位置变换，不旋转内容
    style.transform = `translate(${x}px, ${y}px)`
  }
  
  return style
})

// wrapper 的类名
const wrapperClasses = computed(() => {
  return {
    'node-wrapper--center': props.type === 'center',
    'node-wrapper--circular': props.type === 'circular',
    'node-wrapper--menu-open': props.isMenuVisible
  }
})

// wrapper 的样式
const wrapperStyle = computed(() => {
  return nodeStyle.value
})

// 第3步：动态计算气泡框菜单位置
const calculateMenuPosition = async () => {
  if (!props.isMenuVisible || !nodeRef.value) {
    return
  }
  
  await nextTick()
  
  // 第1步：获取节点在视口中的位置
  const nodeRect = nodeRef.value.getBoundingClientRect()
  
  // 第2步：查找 viewport-clipper 容器元素
  const viewportClipper = nodeRef.value.closest('.viewport-clipper') as HTMLElement | null
  
  // 预估气泡框菜单高度（包括按钮和间距）
  const estimatedMenuHeight = 120 // 两个按钮 + 间距 + padding
  
  // 第4步：计算节点下方和上方的可用空间
  // 使用 viewport-clipper 容器的底部位置来计算下方空间
  const containerBottom = viewportClipper 
    ? viewportClipper.getBoundingClientRect().bottom 
    : window.innerHeight
  let spaceBelow = containerBottom - nodeRect.bottom
  
  // 使用 viewport-clipper 容器的顶部位置来计算上方空间
  const containerTop = viewportClipper 
    ? viewportClipper.getBoundingClientRect().top 
    : 0
  const spaceAbove = nodeRect.top - containerTop
  
  // 对于圆周节点，需要考虑内容区域的高度（内容在节点下方）
  if (props.type === 'circular') {
    // 圆周节点内容在节点下方，需要加上内容高度
    const contentOffset = 60 // node-title 高度约 3.5rem = 56px，加上间距约 60px
    spaceBelow -= contentOffset // 减去内容占用的空间
  }
  
  // 判断是否有足够空间在下方显示
  // 如果下方空间不足且上方空间更大，则显示在上方
  if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
    menuPosition.value = 'top'
  } else {
    menuPosition.value = 'bottom'
  }
}

// 监听菜单可见性变化，重新计算位置
watch(() => props.isMenuVisible, (newVal) => {
  if (newVal) {
    calculateMenuPosition()
  }
}, { immediate: true })

// 监听窗口大小变化，重新计算位置
let resizeHandler: (() => void) | null = null
if (typeof window !== 'undefined') {
  resizeHandler = () => {
    if (props.isMenuVisible) {
      calculateMenuPosition()
    }
  }
  window.addEventListener('resize', resizeHandler)
}

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (typeof window !== 'undefined' && resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
})

// 计算气泡框菜单的定位样式
const bubbleMenuStyle = computed(() => {
  if (!props.isMenuVisible) {
    return {}
  }
  
  const baseStyle = {
    position: 'absolute' as const,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 20 as const
  }
  
  if (props.type === 'center') {
    // 中心节点的气泡框定位
    if (menuPosition.value === 'top') {
      // 显示在节点上方
      return {
        ...baseStyle,
        bottom: 'calc(100% + 20px)',
        top: 'auto'
      }
    } else {
      // 显示在节点下方
      return {
        ...baseStyle,
        top: 'calc(100% + 20px)',
        bottom: 'auto'
      }
    }
  } else {
    // 圆周节点的气泡框定位
    // node-content--circular已经定位在节点下方，气泡框需要定位在内容下方或节点上方
    if (menuPosition.value === 'top') {
      // 显示在节点上方（相对于.node-wrapper的顶部，即节点顶部）
      return {
        ...baseStyle,
        bottom: 'calc(100% + 20px)', // node-wrapper高度 + 间距，菜单显示在节点上方20px处
        top: 'auto'
      }
    } else {
      // 显示在内容下方（相对于.node-wrapper的底部，需要加上内容高度）
      return {
        ...baseStyle,
        top: 'calc(100% + 8px + 3.5rem)', // node-wrapper高度 + 间距 + 内容高度
        bottom: 'auto'
      }
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

// 学习标签类名计算
const learningTagClasses = computed(() => {
  const classes = []
  
  // 中心节点展开状态
  if (props.type === 'center' && props.isExpanded) {
    classes.push('learning-tag--expanded')
  }
  
  // 节点在其他图谱展开时变小
  if (props.hasExpandedGraph && !props.isExpanded) {
    classes.push('learning-tag--shrunk')
  }
  
  return classes
})

// 学习标签样式计算
const learningTagStyle = computed(() => {
  const style: Record<string, string> = {}
  
  // 使用配置的位置参数
  const top = debugParams?.value?.learningTagTop ?? 0
  const left = debugParams?.value?.learningTagLeft ?? 50
  const translateX = debugParams?.value?.learningTagTranslateX ?? 0
  
  // 处理 top 和 left，支持数字（px）和字符串
  style.top = typeof top === 'number' ? `${top}px` : String(top)
  style.left = typeof left === 'number' ? `${left}px` : String(left)
  style.transform = `translateX(${translateX}%)`
  
  return style
})




</script>

<style scoped>
.node-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* 确保容器有最小尺寸，避免因为负边距和 transform scale(0) 导致尺寸为 0 */
  min-width: 100px;
  min-height: 100px;
}

/* 中心节点的 node-wrapper 使用更高的 z-index，确保气泡框不被圆周节点覆盖 */
.node-wrapper--center {
  z-index: 15;
}

/* 圆周节点的 node-wrapper 使用较低的 z-index */
.node-wrapper--circular {
  z-index: 2;
}

/* 当节点的气泡框打开时，无论中心节点还是圆周节点，都提升到最上层 */
.node-wrapper--menu-open {
  z-index: 30 !important;
}

.graph-node {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--node-base-transition-duration, 0.3s) ease;
  position: relative;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* 中心节点样式 - 大圆 */
.graph-node--center {
  width: 180px;
  height: 180px;
  background: transparent;
  z-index: 10;
  transition: all var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1);
  position: relative;
  overflow: hidden;
  padding: 10px;
  margin: -10px;
}

.graph-node--center:active {
  transform: scale(0.97);
  transition: transform var(--node-active-transition-duration, 0.1s) ease;
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
  opacity: 0;
  transform: scale(0);
  transform-origin: center center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  padding: 12px;
  margin: -12px;
}

.graph-node--circular:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.graph-node--circular:active {
  transform: scale(0.95);
  transition: transform var(--node-active-transition-duration, 0.1s) ease;
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
  transition: opacity var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1), transform var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1);
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
  transition: all var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1);
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
  line-height: 1.2; /* 调整行高以适应换行 */
  transition: all var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1);
  width: 100%;
  display: block;
  word-wrap: break-word; /* 允许文字换行 */
  word-break: break-word; /* 确保长文本正确换行 */
}

/* 中心节点标题展开状态 - 字体放大 */
.node-content--center.node-content--expanded .node-title {
  font-size: 230%; /* 第1步：展开时字体放大到230% */
  margin-top: -8px; /* 第2步：向上占据一些空间 */
  margin-bottom: 4px; /* 第3步：增加与章节名的间距 */
  line-height: 1.3; /* 调整行高以适应放大后的字体和换行文本 */
  word-wrap: break-word; /* 允许文字换行 */
  word-break: break-word; /* 确保长文本正确换行 */
}

/* 中心节点标题在其他图谱展开时字体保持不变 */
.node-content--center.node-content--shrunk .node-title {
  font-size: 190%; /* 第1步：保持与默认状态相同的字体大小 */
  margin-top: -8px; /* 第2步：向上占据一些空间 */
  margin-bottom: 4px; /* 第3步：增加与章节名的间距 */
  line-height: 1.2; /* 调整行高以适应换行 */
  word-wrap: break-word; /* 允许文字换行 */
  word-break: break-word; /* 确保长文本正确换行 */
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
  transition: all var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1);
}

/* 圆周节点标题在其他图谱展开时变小 */
.node-content--circular.node-content--shrunk .node-title {
  font-size: 0.875rem; /* 14px × 1.75 = 24.5px */
  line-height: 1.1;
}


/* 中心节点章节名样式 */
.node-content--center .node-chapter {
  font-size: 150%; /* 节点宽度的130% */
  color: white;
  font-family: 'PingFang SC', 'PingFangSC-Regular', sans-serif;
  font-weight: normal;
  text-align: center;
  line-height: 1.4; /* 第1步：增加行高，改善可读性 */
  opacity: 0.9;
  transition: all var(--node-content-transition-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1);
  width: 100%;
  display: -webkit-box; /* 使用弹性盒子布局以支持多行截断 */
  -webkit-box-orient: vertical; /* 垂直方向排列 */
  -webkit-line-clamp: 2; /* 最多显示两行 */
  line-clamp: 2; /* 标准属性，最多显示两行 */
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出部分显示省略号 */
  word-wrap: break-word; /* 允许文字换行 */
  word-break: break-word; /* 确保长文本正确换行 */
  margin-bottom: 2px; /* 底部留一些间距 */
}

/* 中心节点章节名展开状态 - 字号保持一致 */
.node-content--center.node-content--expanded .node-chapter {
  font-size: 150%; /* 第1步：保持与默认状态相同的字体大小 */
  line-height: 1.4; /* 第2步：增加行高，改善可读性 */
  display: -webkit-box; /* 第3步：使用弹性盒子布局以支持多行截断 */
  -webkit-box-orient: vertical; /* 第4步：垂直方向排列 */
  -webkit-line-clamp: 2; /* 第5步：最多显示两行 */
  line-clamp: 2; /* 第6步：标准属性，最多显示两行 */
  overflow: hidden; /* 第7步：隐藏超出部分 */
  text-overflow: ellipsis; /* 第8步：超出部分显示省略号 */
  word-wrap: break-word; /* 第9步：允许文字换行 */
  word-break: break-word; /* 第10步：确保长文本正确换行 */
  margin-bottom: 2px; /* 第11步：底部留一些间距 */
}

/* 中心节点章节名在其他图谱展开时字体保持不变 */
.node-content--center.node-content--shrunk .node-chapter {
  font-size: 140%; /* 第1步：保持与默认状态相同的字体大小 */
  line-height: 1.4; /* 第2步：增加行高，改善可读性 */
  display: -webkit-box; /* 第3步：使用弹性盒子布局以支持多行截断 */
  -webkit-box-orient: vertical; /* 第4步：垂直方向排列 */
  -webkit-line-clamp: 2; /* 第5步：最多显示两行 */
  line-clamp: 2; /* 第6步：标准属性，最多显示两行 */
  overflow: hidden; /* 第7步：隐藏超出部分 */
  text-overflow: ellipsis; /* 第8步：超出部分显示省略号 */
  word-wrap: break-word; /* 第9步：允许文字换行 */
  word-break: break-word; /* 第10步：确保长文本正确换行 */
  margin-bottom: 2px; /* 第11步：底部留一些间距 */
}



/* 学习标签 */
.learning-tag {
  position: absolute;
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
  /* 第1步：初始状态为透明，通过动画变为不透明 */
  opacity: 0;
  /* 第2步：添加透明度过渡效果，实现从透明到不透明的淡入动画 */
  transition: opacity var(--learning-tag-transition-duration, 0.8s) cubic-bezier(0.4, 0.0, 0.2, 1),
              all var(--learning-tag-transition-duration, 0.8s) cubic-bezier(0.4, 0.0, 0.2, 1);
  pointer-events: none; /* 禁用点击事件 */
  /* 第3步：使用动画实现淡入效果 */
  animation: learning-tag-fade-in var(--learning-tag-transition-duration, 0.8s) cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 学习标签在节点展开时变为完全透明 */
.learning-tag--expanded {
  opacity: 0;
  /* 第1步：展开状态时禁用淡入动画，直接变为透明 */
  animation: none;
}

/* 学习标签在节点缩小时变小 */
.learning-tag--shrunk {
  font-size: 9px;
  padding: 1px 4px;
  opacity: 0.8;
}

/* 学习标签淡入动画 */
@keyframes learning-tag-fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
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
  animation: node-enter var(--node-animation-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 节点退出动画类 */
.graph-node--circular.node-exit {
  animation: node-exit var(--node-animation-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 内容进入动画类 */
.node-content--circular.content-enter {
  animation: content-enter var(--node-animation-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
}

/* 内容退出动画类 */
.node-content--circular.content-exit {
  animation: content-exit var(--node-animation-duration, 0.6s) cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
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
  background: #4A3A6B;
  border-radius: 20px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
}

@media (max-width: 768px) {
  .bubble-menu-container {
    padding: 16px;
    gap: 12px;
    min-width: 140px;
  }
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
  transition: all var(--bubble-button-transition-duration, 0.2s) ease;
  font-family: 'PingFang SC', 'PingFangSC-Regular', sans-serif;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.bubble-menu-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.bubble-menu-button:active {
  transform: translateY(0) scale(0.97);
}

@media (max-width: 768px) {
  .bubble-menu-button {
    padding: 14px 24px;
    font-size: 16px;
    min-height: 48px;
  }
}

/* 学习按钮样式 - 紫色半透明 */
.bubble-menu-button--learn {
  background: rgba(129, 95, 255, 0.9);
}

.bubble-menu-button--learn:hover {
  background: rgba(107, 79, 255, 1);
}

/* 练习按钮样式 - 橙色半透明 */
.bubble-menu-button--practice {
  background: rgba(255, 151, 103, 0.9);
}

.bubble-menu-button--practice:hover {
  background: rgba(255, 138, 77, 1);
}

</style>
