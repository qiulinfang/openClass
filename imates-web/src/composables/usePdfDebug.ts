import { ref, reactive } from 'vue'

// 滚动调试状态
export const scrollDebugState = reactive({
  scrollTop: 0,
  scrollHeight: 0,
  clientHeight: 0,
  maxScrollTop: 0,
  scrollPercentage: 0,
  containerType: 'unknown' as 'pdf-pages-container' | 'overflow-scroll' | 'document' | 'unknown'
})

// 触摸调试状态
export const touchDebugState = reactive({
  isTwoFinger: false,
  isZooming: false,
  startY: 0,
  lastY: 0,
  currentY: 0,
  deltaY: 0,
  initialDistance: 0,
  currentDistance: 0,
  distanceChange: 0,
  startCenterX: 0,
  startCenterY: 0,
  currentCenterX: 0,
  currentCenterY: 0
})

// 惯性滚动调试状态
export const momentumDebugState = reactive({
  isActive: false,
  velocity: 0, // px/ms
  velocityPerFrame: 0, // px/frame
  friction: 0.95,
  minVelocity: 0.05,
  velocities: [] as number[],
  lastMoveTime: 0
})

// 更新滚动状态
export const updateScrollState = (container: HTMLElement | null) => {
  if (!container) {
    scrollDebugState.scrollTop = 0
    scrollDebugState.scrollHeight = 0
    scrollDebugState.clientHeight = 0
    scrollDebugState.maxScrollTop = 0
    scrollDebugState.scrollPercentage = 0
    scrollDebugState.containerType = 'unknown'
    return
  }

  scrollDebugState.scrollTop = container.scrollTop
  scrollDebugState.scrollHeight = container.scrollHeight
  scrollDebugState.clientHeight = container.clientHeight
  scrollDebugState.maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  
  if (scrollDebugState.maxScrollTop > 0) {
    scrollDebugState.scrollPercentage = (scrollDebugState.scrollTop / scrollDebugState.maxScrollTop) * 100
  } else {
    scrollDebugState.scrollPercentage = 0
  }

  // 判断容器类型
  if (container.classList.contains('pdf-pages-container')) {
    scrollDebugState.containerType = 'pdf-pages-container'
  } else {
    const overflowY = window.getComputedStyle(container).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      scrollDebugState.containerType = 'overflow-scroll'
    } else if (container === document.documentElement) {
      scrollDebugState.containerType = 'document'
    } else {
      scrollDebugState.containerType = 'unknown'
    }
  }
}

// 更新触摸状态
export const updateTouchState = (state: {
  isTwoFinger?: boolean
  isZooming?: boolean
  startY?: number
  lastY?: number
  currentY?: number
  deltaY?: number
  initialDistance?: number
  currentDistance?: number
  distanceChange?: number
  startCenterX?: number
  startCenterY?: number
  currentCenterX?: number
  currentCenterY?: number
}) => {
  if (state.isTwoFinger !== undefined) touchDebugState.isTwoFinger = state.isTwoFinger
  if (state.isZooming !== undefined) touchDebugState.isZooming = state.isZooming
  if (state.startY !== undefined) touchDebugState.startY = state.startY
  if (state.lastY !== undefined) touchDebugState.lastY = state.lastY
  if (state.currentY !== undefined) touchDebugState.currentY = state.currentY
  if (state.deltaY !== undefined) touchDebugState.deltaY = state.deltaY
  if (state.initialDistance !== undefined) touchDebugState.initialDistance = state.initialDistance
  if (state.currentDistance !== undefined) touchDebugState.currentDistance = state.currentDistance
  if (state.distanceChange !== undefined) touchDebugState.distanceChange = state.distanceChange
  if (state.startCenterX !== undefined) touchDebugState.startCenterX = state.startCenterX
  if (state.startCenterY !== undefined) touchDebugState.startCenterY = state.startCenterY
  if (state.currentCenterX !== undefined) touchDebugState.currentCenterX = state.currentCenterX
  if (state.currentCenterY !== undefined) touchDebugState.currentCenterY = state.currentCenterY
}

// 更新惯性滚动状态
export const updateMomentumState = (state: {
  isActive?: boolean
  velocity?: number
  velocityPerFrame?: number
  friction?: number
  minVelocity?: number
  velocities?: number[]
  lastMoveTime?: number
}) => {
  if (state.isActive !== undefined) momentumDebugState.isActive = state.isActive
  if (state.velocity !== undefined) momentumDebugState.velocity = state.velocity
  if (state.velocityPerFrame !== undefined) momentumDebugState.velocityPerFrame = state.velocityPerFrame
  if (state.friction !== undefined) momentumDebugState.friction = state.friction
  if (state.minVelocity !== undefined) momentumDebugState.minVelocity = state.minVelocity
  if (state.velocities !== undefined) momentumDebugState.velocities = [...state.velocities]
  if (state.lastMoveTime !== undefined) momentumDebugState.lastMoveTime = state.lastMoveTime
}

// 重置触摸状态
export const resetTouchState = () => {
  touchDebugState.isTwoFinger = false
  touchDebugState.isZooming = false
  touchDebugState.startY = 0
  touchDebugState.lastY = 0
  touchDebugState.currentY = 0
  touchDebugState.deltaY = 0
  touchDebugState.initialDistance = 0
  touchDebugState.currentDistance = 0
  touchDebugState.distanceChange = 0
  touchDebugState.startCenterX = 0
  touchDebugState.startCenterY = 0
  touchDebugState.currentCenterX = 0
  touchDebugState.currentCenterY = 0
}

