import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import centerNodeIcon from '/icons/centerNode.svg'
import learnedIcon from '/icons/learned.svg'
import lastLearnedIcon from '/icons/lastLearned.svg'
import notLearnedIcon from '/icons/notLearned.svg'
import indicatorIcon from '/icons/Indicator.svg'
import '@/components/knowledge-graph/KnowledgeGraph.css'

export interface KnowledgeNode {
  id: string
  name: string
  label?: string
  level?: number
  learningStatus?: 'notLearned' | 'learned' | 'lastLearned'
  children?: KnowledgeNode[]
}

export interface KnowledgeGraphProps {
  data?: KnowledgeNode
  onAction?: (type: 'learn' | 'practice', data: KnowledgeNode) => void
  onNodeClick?: (data: KnowledgeNode) => void
}

// 布局配置基础值
const baseConfig = {
  orbitRadiusX: 460,
  orbitRadiusY: 315,
  rotationSpeed: 0.08,
  moonRadiusBase: 40,
  moonRadiusFocusBase: 70,
  satelliteDistBase: 120,
  satelliteOrbitGrowthPerSat: 8,
  satelliteRadiusFocus: 31,
  indicatorRightMargin: 40,
  indicatorGap: 40,
  indicatorRadius: 6,
  indicatorActiveRadius: 12,
  orbitCenterXOffset: 0,
  orbitCenterYOffset: -69,
  focusAngle: 2.8
}

const SATELLITE_RADIUS = 18
const ZOOM_STEP_PER_SAT = 0.15

// 辅助函数：绘制多行文本并带省略号
function drawMultilineTextWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  textAlign: CanvasTextAlign = 'center',
  textBaseline: CanvasTextBaseline = 'middle'
) {
  if (!text) return

  const originalBaseline = ctx.textBaseline
  const originalTextAlign = ctx.textAlign

  ctx.textAlign = textAlign
  ctx.textBaseline = 'middle'

  const words = text.split('')
  const lines: string[] = []
  let currentLine = ''

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i]
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && i > 0) {
      lines.push(currentLine)
      currentLine = words[i]
    } else {
      currentLine = testLine
    }
  }
  lines.push(currentLine)

  if (lines.length > maxLines) {
    const lastLineIndex = maxLines - 1
    const fullRemaining = text.substring(lines.slice(0, lastLineIndex).join('').length)
    let testStr = fullRemaining
    while (ctx.measureText(testStr + '...').width > maxWidth && testStr.length > 0) {
      testStr = testStr.slice(0, -1)
    }
    lines[lastLineIndex] = testStr + '...'
    lines.length = maxLines
  }

  const totalHeight = lines.length * lineHeight
  let startY = y
  if (textBaseline === 'middle') {
    startY = y - totalHeight / 2 + lineHeight / 2
  } else if (textBaseline === 'top') {
    startY = y + lineHeight / 2
  } else if (textBaseline === 'bottom') {
    startY = y - totalHeight + lineHeight / 2
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight)
  })

  ctx.textBaseline = originalBaseline
  ctx.textAlign = originalTextAlign
}

// 预加载图片并缓存
const imageAssets: Record<string, HTMLImageElement> = {}
const imageCache = new Map<string, HTMLCanvasElement>()

function preloadImage(src: string): Promise<HTMLImageElement> {
  if (imageAssets[src]) return Promise.resolve(imageAssets[src])
  return new Promise((resolve) => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      imageAssets[src] = img
      resolve(img)
    }
  })
}

function getCachedImageCanvas(img: HTMLImageElement) {
  if (!img || !img.complete) return null
  if (imageCache.has(img.src)) return imageCache.get(img.src)

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(img, 0, 0, size, size)
    imageCache.set(img.src, canvas)
    return canvas
  }
  return null
}

class Satellite {
  data: KnowledgeNode
  angleOffset: number
  x: number = 0
  y: number = 0

  constructor(index: number, total: number, data: KnowledgeNode) {
    this.data = data
    this.angleOffset = (index / total) * Math.PI * 2 - Math.PI / 2
  }

  update(px: number, py: number, dist: number) {
    this.x = px + Math.cos(this.angleOffset) * dist
    this.y = py + Math.sin(this.angleOffset) * dist
  }

  draw(ctx: CanvasRenderingContext2D, scale: number, isFocused: boolean) {
    const baseRadius = isFocused ? baseConfig.satelliteRadiusFocus : SATELLITE_RADIUS
    const r = baseRadius * (0.8 + scale * 0.15)
    const status = this.data.learningStatus || 'notLearned'
    
    let imgKey = notLearnedIcon
    if (status === 'learned') imgKey = learnedIcon
    else if (status === 'lastLearned') imgKey = lastLearnedIcon

    const img = imageAssets[imgKey]
    const size = r * 2

    const cachedCanvas = getCachedImageCanvas(img)
    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas, this.x - size / 2, this.y - size / 2, size, size)
    } else {
      // 回退到原来的菱形绘制
      ctx.beginPath()
      ctx.moveTo(this.x, this.y - r)
      ctx.lineTo(this.x + r, this.y)
      ctx.lineTo(this.x, this.y + r)
      ctx.lineTo(this.x - r, this.y)
      ctx.closePath()
      ctx.fillStyle = '#a29bfe'
      ctx.fill()
    }

    if (scale > 1.0) {
      ctx.fillStyle = '#fff'
      const fontSize = 13
      ctx.font = `${fontSize}px "Microsoft YaHei"`
      const maxTextWidth = r * 3
      const lineHeight = fontSize * 1.2
      const maxLines = 2
      const textStartY = this.y + r + 5

      drawMultilineTextWithEllipsis(
        ctx,
        this.data.name,
        this.x,
        textStartY,
        maxTextWidth,
        lineHeight,
        maxLines,
        'center',
        'top'
      )
    }

    if (status === 'lastLearned') {
      const tagText = '上次学到'
      const tagFontSize = 14
      const tagWidth = 70
      const tagHeight = 20
      const tagRadius = 10

      ctx.save()
      ctx.font = `${tagFontSize}px "Microsoft YaHei"`
      const offsetX = r * 1.3
      const offsetY = -r
      const tagX = this.x + offsetX
      const tagY = this.y + offsetY

      const left = tagX - tagWidth / 2
      const top = tagY - tagHeight / 2
      const radius = tagRadius

      ctx.beginPath()
      ctx.roundRect(left, top, tagWidth, tagHeight, radius)
      ctx.fillStyle = '#ff6767'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 4
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tagText, tagX, tagY)
      ctx.restore()
    }
  }
}

class Moon {
  index: number
  data: KnowledgeNode
  angleOffset: number
  maxZoomFactor: number
  satelliteOrbitDist: number
  scale: number = 1
  targetScale: number = 1
  opacity: number = 1
  x: number = 0
  y: number = 0
  satellites: Satellite[] = []

  constructor(index: number, total: number, data: KnowledgeNode) {
    this.index = index
    this.data = data
    this.angleOffset = (index / total) * Math.PI * 2
    const satCount = data.children ? data.children.length : 0
    this.maxZoomFactor = Math.min(2.8, 1.5 + (satCount * ZOOM_STEP_PER_SAT))
    this.satelliteOrbitDist = baseConfig.satelliteDistBase + (satCount * baseConfig.satelliteOrbitGrowthPerSat)
    
    if (data.children) {
      data.children.forEach((child, i) => {
        this.satellites.push(new Satellite(i, data.children!.length, child))
      })
    }
  }

  update(globalAngle: number, focusedIndex: number, cx: number, cy: number) {
    const diff = this.targetScale - this.scale
    this.scale += Math.abs(diff) > 0.001 ? diff * 0.1 : 0
    if (Math.abs(diff) <= 0.001) this.scale = this.targetScale

    const targetOp = (this.index === focusedIndex) ? 1.0 : 0.5
    this.opacity += (targetOp - this.opacity) * 0.1

    const currentAngle = globalAngle + this.angleOffset
    this.x = cx + Math.cos(currentAngle) * baseConfig.orbitRadiusX
    this.y = cy + Math.sin(currentAngle) * baseConfig.orbitRadiusY

    if (this.scale > 1.1) {
      const progress = (this.scale - 1) / (this.maxZoomFactor - 1)
      const currentDist = this.satelliteOrbitDist * Math.max(0, progress)
      this.satellites.forEach(sat => sat.update(this.x, this.y, currentDist))
    }
  }

  draw(ctx: CanvasRenderingContext2D, focusedIndex: number) {
    ctx.globalAlpha = this.opacity
    if (this.scale > 1.2) this.drawFocused(ctx)
    else this.drawUnfocused(ctx)
    ctx.globalAlpha = 1.0
  }

  drawFocused(ctx: CanvasRenderingContext2D) {
    const r = baseConfig.moonRadiusFocusBase
    const progress = (this.scale - 1) / (this.maxZoomFactor - 1)
    const currentSatDist = this.satelliteOrbitDist * Math.max(0, progress)

    if (currentSatDist > r) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, currentSatDist, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const img = imageAssets[centerNodeIcon]
    const size = r * 2
    const cachedCanvas = getCachedImageCanvas(img)

    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas, this.x - size / 2, this.y - size / 2, size, size)
    } else {
      const grad = ctx.createLinearGradient(this.x, this.y - r, this.x, this.y + r)
      grad.addColorStop(0, '#a29bfe')
      grad.addColorStop(1, '#6c5ce7')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowColor = 'rgba(108, 92, 231, 0.6)'
      ctx.shadowBlur = 20
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    const titleSize = 21
    ctx.font = `bold ${titleSize}px "Microsoft YaHei"`
    
    drawMultilineTextWithEllipsis(
      ctx,
      this.data.label || this.data.name,
      this.x,
      this.y,
      r * 1.5,
      titleSize * 1.2,
      2,
      'center',
      'middle'
    )

    this.satellites.forEach(sat => sat.draw(ctx, this.scale, true))
  }

  drawUnfocused(ctx: CanvasRenderingContext2D) {
    const r = baseConfig.moonRadiusBase
    const img = imageAssets[centerNodeIcon]
    const size = r * 2

    if (this.satelliteOrbitDist > r) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.satelliteOrbitDist / 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const cachedCanvas = getCachedImageCanvas(img)
    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas, this.x - size / 2, this.y - size / 2, size, size)
    } else {
      ctx.fillStyle = 'rgba(108, 92, 231, 0.3)'
      ctx.strokeStyle = 'rgba(162, 155, 254, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    const label = this.data.label || this.data.name
    const num = label.split(' ')[0]
    ctx.fillStyle = '#fff'
    ctx.font = `bold 14px "Microsoft YaHei"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(num, this.x, this.y)
  }
}

export const KnowledgeGraph = forwardRef<any, KnowledgeGraphProps>((props, ref) => {
  const { data = { id: '', name: '', children: [] }, onAction, onNodeClick } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bubbleState, setBubbleState] = useState({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    activeType: null as 'moon' | 'satellite' | null,
    moonIndex: -1,
    satIndex: -1,
    data: null as KnowledgeNode | null
  })

  const [moons, setMoons] = useState<Moon[]>([])

  const stateRef = useRef({
    globalAngle: 0,
    targetGlobalAngle: 0,
    isAutoRotating: false,
    focusedIndex: 0,
    moons: [] as Moon[],
    isInteracting: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    interactionMode: null as 'SWITCH' | null,
    forceRotation: false,
    autoShowBubbleAfterRotation: false,
    width: 0,
    height: 0,
    cx: 0,
    cy: 0
  })

  const [indicatorDragging, setIndicatorDragging] = useState(false)
  const [indicatorCurrentIndex, setIndicatorCurrentIndex] = useState<number | null>(null)
  const indicatorContainerRef = useRef<HTMLDivElement>(null)

  const getMoonIndexFromIndicator = useCallback((displayIndex: number) => {
    const total = stateRef.current.moons.length
    if (total === 0) return -1
    return total - 1 - displayIndex
  }, [])

  const isIndicatorActive = useCallback((displayIndex: number) => {
    const moonIndex = getMoonIndexFromIndicator(displayIndex)
    return moonIndex === stateRef.current.focusedIndex
  }, [getMoonIndexFromIndicator])

  const getIndicatorOpacity = useCallback((displayIndex: number) => {
    const total = stateRef.current.moons.length
    if (total === 0) return 1
    const activeIndex = stateRef.current.focusedIndex
    const activeDisplayIndex = getMoonIndexFromIndicator(activeIndex)
    if (displayIndex === activeDisplayIndex) return 1
    const distance = Math.abs(displayIndex - activeDisplayIndex)
    const maxDistance = Math.max(activeDisplayIndex, total - 1 - activeDisplayIndex)
    if (maxDistance === 0) return 1
    return Math.max(0.2, 1 - (distance / maxDistance) * 0.8)
  }, [getMoonIndexFromIndicator])

  const getIndicatorSize = useCallback((displayIndex: number) => {
    const total = stateRef.current.moons.length
    if (total === 0) return 18
    const activeIndex = stateRef.current.focusedIndex
    const activeDisplayIndex = getMoonIndexFromIndicator(activeIndex)
    if (displayIndex === activeDisplayIndex) return 18
    const distance = Math.abs(displayIndex - activeDisplayIndex)
    const maxDistance = Math.max(activeDisplayIndex, total - 1 - activeDisplayIndex)
    if (maxDistance === 0) return 18
    const size = 7 + (10 * (1 - distance / maxDistance))
    return Math.max(14, Math.min(24, size))
  }, [getMoonIndexFromIndicator])

  const requestRef = useRef<number>()

  const hideBubble = useCallback(() => {
    setBubbleState(prev => ({ ...prev, visible: false }))
  }, [])

  const updateBubblePosition = useCallback(() => {
    const { activeType, moonIndex, satIndex, visible } = bubbleState
    if (!visible || moonIndex === -1) return

    const moon = stateRef.current.moons[moonIndex]
    if (!moon) return

    let targetX = 0, targetY = 0
    if (activeType === 'moon') {
      if (moonIndex !== stateRef.current.focusedIndex) {
        hideBubble()
        return
      }
      targetX = moon.x
      targetY = moon.y
    } else if (activeType === 'satellite') {
      if (moonIndex !== stateRef.current.focusedIndex) {
        hideBubble()
        return
      }
      const sat = moon.satellites[satIndex]
      if (!sat) return
      targetX = sat.x
      targetY = sat.y
    }

    setBubbleState(prev => ({
      ...prev,
      x: targetX,
      y: targetY - 20
    }))
  }, [bubbleState.visible, bubbleState.activeType, bubbleState.moonIndex, bubbleState.satIndex, hideBubble])

  const showBubble = useCallback((type: 'moon' | 'satellite', moonIndex: number, satIndex = -1) => {
    const moon = stateRef.current.moons[moonIndex]
    if (!moon) return

    let titleText = ""
    let nodeData: KnowledgeNode | null = null

    if (type === 'moon') {
      titleText = moon.data.label || moon.data.name
      nodeData = moon.data
    } else if (type === 'satellite') {
      const sat = moon.satellites[satIndex]
      titleText = sat.data.name
      nodeData = sat.data
    }

    setBubbleState({
      visible: true,
      x: 0,
      y: 0,
      title: titleText,
      activeType: type,
      moonIndex,
      satIndex,
      data: nodeData
    })

    if (onNodeClick && nodeData) {
      onNodeClick(nodeData)
    }
  }, [onNodeClick])

  const focusOnIndex = useCallback((index: number, instant = false) => {
    const state = stateRef.current
    if (index < 0 || index >= state.moons.length) return
    
    hideBubble()
    state.focusedIndex = index
    const targetMoon = state.moons[index]

    state.moons.forEach((m, i) => {
      m.targetScale = (i === index) ? m.maxZoomFactor : 1
    })

    state.globalAngle = state.globalAngle % (Math.PI * 2)
    state.targetGlobalAngle = baseConfig.focusAngle - targetMoon.angleOffset

    if (instant) {
      state.globalAngle = state.targetGlobalAngle
      state.moons.forEach(m => m.scale = m.targetScale)
    } else {
      state.isAutoRotating = true
      state.autoShowBubbleAfterRotation = true
    }
  }, [hideBubble])

  const handleIndicatorClick = useCallback((displayIndex: number) => {
    const moonIndex = getMoonIndexFromIndicator(displayIndex)
    if (moonIndex !== -1 && moonIndex !== stateRef.current.focusedIndex) {
      focusOnIndex(moonIndex)
    }
  }, [getMoonIndexFromIndicator, focusOnIndex])

  const getIndicatorIndexFromTouch = useCallback((touchY: number) => {
    if (!indicatorContainerRef.current) return null
    const indicatorDots = indicatorContainerRef.current.querySelectorAll('.indicator-dot')
    if (indicatorDots.length === 0) return null
    let minDistance = Infinity
    let nearestIndex = 0
    indicatorDots.forEach((dot, index) => {
      const dotRect = dot.getBoundingClientRect()
      const dotCenterY = dotRect.top + dotRect.height / 2
      const distance = Math.abs(touchY - dotCenterY)
      if (distance < minDistance) {
        minDistance = distance
        nearestIndex = index
      }
    })
    return nearestIndex
  }, [])

  const handleIndicatorTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    setIndicatorDragging(true)
    const touchY = e.touches[0].clientY
    const displayIndex = getIndicatorIndexFromTouch(touchY)
    if (displayIndex !== null) {
      setIndicatorCurrentIndex(displayIndex)
      const moonIndex = stateRef.current.moons.length - 1 - displayIndex
      if (moonIndex !== -1 && moonIndex !== stateRef.current.focusedIndex) {
        focusOnIndex(moonIndex)
      }
    }
  }, [getIndicatorIndexFromTouch, focusOnIndex])

  const handleIndicatorTouchMove = useCallback((e: React.TouchEvent) => {
    if (!indicatorDragging) return
    e.stopPropagation()
    const touchY = e.touches[0].clientY
    const displayIndex = getIndicatorIndexFromTouch(touchY)
    if (displayIndex !== null && indicatorCurrentIndex !== displayIndex) {
      setIndicatorCurrentIndex(displayIndex)
      const moonIndex = getMoonIndexFromIndicator(displayIndex)
      if (moonIndex !== -1 && moonIndex !== stateRef.current.focusedIndex) {
        focusOnIndex(moonIndex)
      }
    }
  }, [indicatorDragging, indicatorCurrentIndex, getIndicatorIndexFromTouch, getMoonIndexFromIndicator, focusOnIndex])

  const handleIndicatorTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    setIndicatorDragging(false)
    setIndicatorCurrentIndex(null)
  }, [])

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const event = 'touches' in e ? e.touches[0] : e
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const clientX = event.clientX - rect.left
    const clientY = event.clientY - rect.top
    const state = stateRef.current
    state.isInteracting = true
    state.startX = clientX
    state.startY = clientY
    state.lastX = clientX
    state.interactionMode = null
  }, [])

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const state = stateRef.current
    if (!state.isInteracting) return
    const event = 'touches' in e ? e.touches[0] : e
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const clientX = event.clientX - rect.left
    const clientY = event.clientY - rect.top
    const dx = clientX - state.startX
    const dy = clientY - state.startY
    if (!state.interactionMode) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (Math.abs(dy) > Math.abs(dx)) {
          state.interactionMode = 'SWITCH'
        }
      }
    }
  }, [])

  const switchFocus = useCallback((direction: 'next' | 'prev') => {
    const state = stateRef.current
    const len = state.moons.length
    
    if (len === 1) {
      state.forceRotation = true
      state.isAutoRotating = true
      // 旋转一整圈
      const rotationAmount = Math.PI * 2
      const baseAngle = state.isAutoRotating ? state.targetGlobalAngle : state.globalAngle
      state.targetGlobalAngle = baseAngle + (direction === 'next' ? rotationAmount : -rotationAmount)
      return
    }

    const newIndex = direction === 'next' 
      ? (state.focusedIndex + 1) % len 
      : (state.focusedIndex - 1 + len) % len
    focusOnIndex(newIndex)
  }, [focusOnIndex])

  const onEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const state = stateRef.current
    if (!state.isInteracting) return
    state.isInteracting = false
    const event = 'changedTouches' in e ? e.changedTouches[0] : e
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const clientX = event.clientX - rect.left
    const clientY = event.clientY - rect.top
    const dx = clientX - state.startX
    const dy = clientY - state.startY
    if (state.interactionMode === 'SWITCH') {
      if (Math.abs(dy) > 30) {
        switchFocus(dy > 0 ? 'prev' : 'next')
      }
    } else {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        handleCanvasClick(e as any)
      }
    }
    state.interactionMode = null
  }, [switchFocus])

  const focusOnNodeId = useCallback((nodeId: string, instant = false) => {
    const idx = stateRef.current.moons.findIndex(m => m.data && m.data.id === nodeId)
    if (idx !== -1) {
      focusOnIndex(idx, instant)
    }
  }, [focusOnIndex])

  useImperativeHandle(ref, () => ({
    focusOnNodeId,
    focusOnIndex
  }))

  const animateRef = useRef<() => void>()
  animateRef.current = () => {
    const state = stateRef.current
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Update
    if (state.isAutoRotating) {
      let diff = state.targetGlobalAngle - state.globalAngle
      if (!state.forceRotation) {
        while (diff <= -Math.PI) diff += Math.PI * 2
        while (diff > Math.PI) diff -= Math.PI * 2
      }
      if (Math.abs(diff) < 0.005) {
        state.globalAngle = state.targetGlobalAngle
        state.isAutoRotating = false
        state.forceRotation = false
        if (state.autoShowBubbleAfterRotation) {
          state.autoShowBubbleAfterRotation = false
          const focusedMoon = state.moons[state.focusedIndex]
          if (focusedMoon?.satellites.length > 0) {
            showBubble('satellite', state.focusedIndex, 0)
          } else {
            showBubble('moon', state.focusedIndex)
          }
        }
      } else {
        state.globalAngle += diff * baseConfig.rotationSpeed
      }
    }
    state.moons.forEach(m => m.update(state.globalAngle, state.focusedIndex, state.cx, state.cy))

    if (bubbleState.visible) {
      updateBubblePosition()
    }

    // Draw
    ctx.clearRect(0, 0, state.width, state.height)
    state.moons
      .slice(1)
      .sort((a, b) => a.scale - b.scale)
      .forEach(m => m.draw(ctx, state.focusedIndex))
    if (state.moons[0]) {
      state.moons[0].draw(ctx, state.focusedIndex)
    }

    requestRef.current = requestAnimationFrame(animateRef.current!)
  }

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        preloadImage(centerNodeIcon),
        preloadImage(learnedIcon),
        preloadImage(lastLearnedIcon),
        preloadImage(notLearnedIcon)
      ])

      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const resize = () => {
        const dpr = window.devicePixelRatio || 1
        const w = container.clientWidth
        const h = container.clientHeight
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        const ctx = canvas.getContext('2d')
        ctx?.scale(dpr, dpr)
        stateRef.current.width = w
        stateRef.current.height = h
        stateRef.current.cx = w + baseConfig.orbitCenterXOffset
        stateRef.current.cy = h / 2 + baseConfig.orbitCenterYOffset
      }

      window.addEventListener('resize', resize)
      resize()

      const sections = [...(data.children || [])].reverse()
      const root = { ...data, children: [] }
      const moons: Moon[] = []
      moons.push(new Moon(0, sections.length + 1, root))
      
      let initialFocusIndex = sections.length
      sections.forEach((section, idx) => {
        const moonIndex = idx + 1
        moons.push(new Moon(moonIndex, sections.length + 1, section))
        if (section.learningStatus === 'lastLearned') {
          initialFocusIndex = moonIndex
        }
      })

      stateRef.current.moons = moons
      setMoons(moons)
      focusOnIndex(initialFocusIndex, true)

      // 检查聚焦月球是否有卫星，如果有则弹出第一个卫星框，否则弹出月球框
      const focusedMoon = stateRef.current.moons[initialFocusIndex]
      if (focusedMoon && focusedMoon.satellites && focusedMoon.satellites.length > 0) {
        showBubble('satellite', initialFocusIndex, 0)
      } else {
        showBubble('moon', initialFocusIndex)
      }

      requestRef.current = requestAnimationFrame(animateRef.current!)

      return () => {
        window.removeEventListener('resize', resize)
        if (requestRef.current) cancelAnimationFrame(requestRef.current)
      }
    }

    init()
  }, [data, focusOnIndex, showBubble])

  useEffect(() => {
    updateBubblePosition()
  }, [bubbleState.visible, bubbleState.activeType, bubbleState.moonIndex, bubbleState.satIndex, updateBubblePosition])

  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const state = stateRef.current

    // 1. Satellite
    const currentMoon = state.moons[state.focusedIndex]
    let satelliteHit = false
    if (currentMoon && currentMoon.scale > 1.1) {
      for (let j = 0; j < currentMoon.satellites.length; j++) {
        const sat = currentMoon.satellites[j]
        const hitR = 30
        if ((x - sat.x)**2 + (y - sat.y)**2 < hitR**2) {
          showBubble('satellite', state.focusedIndex, j)
          satelliteHit = true
          break
        }
      }
    }
    if (satelliteHit) return

    // 2. Moon
    let minDist = Infinity
    let closestIndex = -1
    for (let i = 0; i < state.moons.length; i++) {
      const moon = state.moons[i]
      const r = (i === state.focusedIndex) ? baseConfig.moonRadiusFocusBase * (moon.scale / 1.5) : baseConfig.moonRadiusBase
      const hitR = r + 10
      const dist = Math.sqrt((x - moon.x)**2 + (y - moon.y)**2)
      if (dist < hitR && dist < minDist) {
        minDist = dist
        closestIndex = i
      }
    }

    if (closestIndex !== -1) {
      if (closestIndex === state.focusedIndex) {
        const focusedMoon = state.moons[closestIndex]
        if (focusedMoon.satellites.length > 0) {
          showBubble('satellite', closestIndex, 0)
        } else {
          showBubble('moon', closestIndex)
        }
      } else {
        focusOnIndex(closestIndex)
      }
    } else {
      hideBubble()
    }
  }

  return (
    <div className="knowledge-graph-container" ref={containerRef}>
      <div 
        className={`manual-bubble-menu ${bubbleState.visible ? 'manual-bubble-menu--visible' : ''}`}
        style={{ left: bubbleState.x, top: bubbleState.y }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="bubble-menu-container">
          <button 
            className="bubble-menu-button bubble-menu-button--learn"
            onClick={() => bubbleState.data && onAction?.('learn', bubbleState.data)}
          >
            探索模式
          </button>
          <button 
            className="bubble-menu-button bubble-menu-button--practice"
            onClick={() => bubbleState.data && onAction?.('practice', bubbleState.data)}
          >
            练习模式
          </button>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        className="space-canvas"
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      />

      <div 
        className="right-border-indicator"
        ref={indicatorContainerRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleIndicatorTouchStart}
        onTouchMove={handleIndicatorTouchMove}
        onTouchEnd={handleIndicatorTouchEnd}
      >
        {moons.map((_, index) => (
          <div 
            key={index}
            className={`indicator-dot ${isIndicatorActive(index) ? 'active' : ''}`}
            style={{
              opacity: getIndicatorOpacity(index),
              width: `${getIndicatorSize(index)}px`,
              height: `${getIndicatorSize(index)}px`
            }}
            onClick={() => handleIndicatorClick(index)}
          >
            {isIndicatorActive(index) && (
              <img 
                src={indicatorIcon} 
                alt="Indicator" 
                className="indicator-icon"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

export default KnowledgeGraph
