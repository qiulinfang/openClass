import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import centerNodeIcon from '/icons/centerNode.svg'
import learnedIcon from '/icons/learned.svg'
import lastLearnedIcon from '/icons/lastLearned.svg'
import notLearnedIcon from '/icons/notLearned.svg'
import './GraphNode.css'

export interface Node {
  id: string
  name: string
  label?: string
  level?: number | null
}

export interface KnowledgeGraphDebugParams {
  nodeEnterExitDuration?: number
  nodeBaseTransitionDuration?: number
  nodeContentTransitionDuration?: number
  nodeActiveTransitionDuration?: number
  learningTagTransitionDuration?: number
  bubbleButtonTransitionDuration?: number
  circularNodeRadius?: number
  circularNodeFontSize?: number
  circularNodeContentFontSize?: number
  centerNodeSizeDefault?: number
  centerNodeSizeExpanded?: number
  centerNodeSizeShrunk?: number
  centerNodeScaleSpeed?: number
  nodeExpandDelayInterval?: number
  nodeCollapseDelayInterval?: number
  circularNodeOffsetX?: number
  circularNodeOffsetY?: number
  learningTagTop?: number | string
  learningTagLeft?: number | string
  learningTagTranslateX?: number
  circularNodeRadiusFactor?: number
}

interface GraphNodeProps {
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
  onClick?: (event: React.MouseEvent) => void
  onLearn?: (node: Node) => void
  onPractice?: (node: Node) => void
  onToggleMenu?: (nodeId: string) => void
  debugParams?: KnowledgeGraphDebugParams
}

const GraphNode: React.FC<GraphNodeProps> = ({
  node,
  type,
  index,
  total,
  radius = 180,
  show = false,
  animationState = 'idle',
  isMenuVisible = false,
  isExpanded = false,
  hasExpandedGraph = false,
  learningStatus = 'notLearned',
  onClick,
  onLearn,
  onPractice,
  onToggleMenu,
  debugParams
}) => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom')

  const getNodeAngle = useCallback((idx: number, tot: number): number => {
    const fixedAngles: Record<number, number[]> = {
      1: [180],
      2: [0, 180],
      3: [270, 30, 150],
      4: [270, 0, 90, 180],
      5: [270, 342, 54, 126, 198]
    }
    
    if (tot >= 1 && tot <= 5 && fixedAngles[tot]) {
      const angleDegrees = fixedAngles[tot][idx] || 0
      return (angleDegrees * Math.PI) / 180
    }
    
    return (2 * Math.PI * idx) / tot
  }, [])

  const nodeIcon = useMemo(() => {
    if (type === 'center') {
      return centerNodeIcon
    }
    switch (learningStatus) {
      case 'learned':
        return learnedIcon
      case 'lastLearned':
        return lastLearnedIcon
      default:
        return notLearnedIcon
    }
  }, [type, learningStatus])

  const formatNodeName = (n: Node) => n.name

  const formatNodeTitle = (n: Node) => {
    if (type === 'center' && n.name) {
      if (n.level === 1) return ''
      const match = n.name.match(/^(\d+\.\d+)/)
      return match ? match[1] : ''
    }
    return n.name
  }

  const formatNodeChapter = (n: Node) => {
    if (type === 'center' && n.name) {
      if (n.level === 1) return n.name
      const match = n.name.match(/^\d+\.\d+\s+(.+)/)
      return match ? match[1] : n.name
    }
    return ''
  }

  const nodeStyleVariables = useMemo(() => ({
    '--node-animation-duration': `${debugParams?.nodeEnterExitDuration ?? 0.6}s`,
    '--node-base-transition-duration': `${debugParams?.nodeBaseTransitionDuration ?? 0.3}s`,
    '--node-content-transition-duration': `${debugParams?.nodeContentTransitionDuration ?? 0.3}s`,
    '--node-active-transition-duration': `${debugParams?.nodeActiveTransitionDuration ?? 0.1}s`,
    '--learning-tag-transition-duration': `${debugParams?.learningTagTransitionDuration ?? 0.3}s`,
    '--bubble-button-transition-duration': `${debugParams?.bubbleButtonTransitionDuration ?? 0.2}s`,
    '--circular-node-radius': `${debugParams?.circularNodeRadius ?? 100}px`,
    '--circular-node-font-size': `${debugParams?.circularNodeFontSize ?? 1.2}rem`,
    '--circular-node-content-font-size': `${debugParams?.circularNodeContentFontSize ?? 0.875}rem`
  } as React.CSSProperties), [debugParams])

  const nodeClasses = useMemo(() => {
    const classes = ['graph-node', `graph-node--${type}`]
    if (type === 'center') {
      if (isExpanded) classes.push('graph-node--expanded')
      if (hasExpandedGraph && !isExpanded) classes.push('graph-node--shrunk')
    } else {
      if (animationState === 'expanding') classes.push('node-enter')
      else if (animationState === 'expanded') classes.push('node-enter')
      else if (animationState === 'collapsing') classes.push('node-exit')
      if (hasExpandedGraph && !isExpanded) classes.push('graph-node--shrunk')
    }
    return classes.join(' ')
  }, [type, isExpanded, hasExpandedGraph, animationState])

  const contentClasses = useMemo(() => {
    const classes = ['node-content', `node-content--${type}`]
    if (type === 'center') {
      if (isExpanded) classes.push('node-content--expanded')
      if (hasExpandedGraph && !isExpanded) classes.push('node-content--shrunk')
    } else {
      if (animationState === 'expanding') classes.push('content-enter')
      else if (animationState === 'expanded') classes.push('content-enter')
      else if (animationState === 'collapsing') classes.push('content-exit')
      if (hasExpandedGraph && !isExpanded) classes.push('node-content--shrunk')
    }
    return classes.join(' ')
  }, [type, isExpanded, hasExpandedGraph, animationState])

  const centerNodeStyle = useMemo(() => {
    if (type !== 'center') return {}
    let size = debugParams?.centerNodeSizeDefault ?? 180
    if (isExpanded) size = debugParams?.centerNodeSizeExpanded ?? 240
    else if (hasExpandedGraph && !isExpanded) size = debugParams?.centerNodeSizeShrunk ?? 140
    const scaleSpeed = debugParams?.centerNodeScaleSpeed ?? 0.5
    return {
      width: `${size}px`,
      height: `${size}px`,
      transition: `all ${scaleSpeed}s cubic-bezier(0.4, 0.0, 0.2, 1)`
    }
  }, [type, isExpanded, hasExpandedGraph, debugParams])

  const nodeStyle = useMemo(() => {
    if (type === 'center') return {}
    const style: React.CSSProperties = {}
    if (type === 'circular' && index !== undefined) {
      if (animationState === 'expanding') {
        const delayInterval = debugParams?.nodeExpandDelayInterval ?? 0.1
        style.animationDelay = `${index * delayInterval}s`
      } else if (animationState === 'collapsing') {
        const delayInterval = debugParams?.nodeCollapseDelayInterval ?? 0.05
        style.animationDelay = `${index * delayInterval}s`
      }
      
      const angle = getNodeAngle(index, total || 1)
      const r = radius
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      
      style.position = 'absolute'
      style.left = '50%'
      style.top = '50%'
      const nodeR = debugParams?.circularNodeRadius ?? 100
      const offsetX = debugParams?.circularNodeOffsetX ?? nodeR / 2
      const offsetY = debugParams?.circularNodeOffsetY ?? nodeR / 2
      style.marginLeft = `-${offsetX}px`
      style.marginTop = `-${offsetY}px`
      style.transform = `translate(${x}px, ${y}px)`
    }
    return style
  }, [type, index, total, radius, animationState, debugParams, getNodeAngle])

  const calculateMenuPosition = useCallback(() => {
    if (!isMenuVisible || !nodeRef.current) return
    
    const nodeRect = nodeRef.current.getBoundingClientRect()
    const viewportClipper = nodeRef.current.closest('.viewport-clipper') as HTMLElement | null
    const estimatedMenuHeight = 120
    const containerBottom = viewportClipper ? viewportClipper.getBoundingClientRect().bottom : window.innerHeight
    let spaceBelow = containerBottom - nodeRect.bottom
    const containerTop = viewportClipper ? viewportClipper.getBoundingClientRect().top : 0
    const spaceAbove = nodeRect.top - containerTop
    
    if (type === 'circular') {
      const contentOffset = 60
      spaceBelow -= contentOffset
    }
    
    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
      setMenuPosition('top')
    } else {
      setMenuPosition('bottom')
    }
  }, [isMenuVisible, type])

  useEffect(() => {
    if (isMenuVisible) {
      calculateMenuPosition()
    }
  }, [isMenuVisible, calculateMenuPosition])

  useEffect(() => {
    const resizeHandler = () => {
      if (isMenuVisible) calculateMenuPosition()
    }
    window.addEventListener('resize', resizeHandler)
    return () => window.removeEventListener('resize', resizeHandler)
  }, [isMenuVisible, calculateMenuPosition])

  const bubbleMenuStyle = useMemo(() => {
    if (!isMenuVisible) return {}
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20
    }
    
    if (type === 'center') {
      if (menuPosition === 'top') {
        return { ...baseStyle, bottom: 'calc(100% + 20px)', top: 'auto' }
      }
      return { ...baseStyle, top: 'calc(100% + 20px)', bottom: 'auto' }
    } else {
      if (menuPosition === 'top') {
        return { ...baseStyle, bottom: 'calc(100% + 20px)', top: 'auto' }
      }
      return { ...baseStyle, top: 'calc(100% + 8px + 3.5rem)', bottom: 'auto' }
    }
  }, [isMenuVisible, type, menuPosition])

  const handleClickInternal = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (type === 'center') {
      if (isExpanded) {
        onToggleMenu?.(node.id)
      }
    } else {
      onToggleMenu?.(node.id)
    }
    onClick?.(event)
  }

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const learningTagClasses = useMemo(() => {
    const classes = ['learning-tag']
    if (type === 'center' && isExpanded) classes.push('learning-tag--expanded')
    if (hasExpandedGraph && !isExpanded) classes.push('learning-tag--shrunk')
    return classes.join(' ')
  }, [type, isExpanded, hasExpandedGraph])

  const learningTagStyle = useMemo(() => {
    const top = debugParams?.learningTagTop ?? 0
    const left = debugParams?.learningTagLeft ?? 50
    const translateX = debugParams?.learningTagTranslateX ?? 0
    return {
      top: typeof top === 'number' ? `${top}px` : String(top),
      left: typeof left === 'number' ? `${left}px` : String(left),
      transform: `translateX(${translateX}%)`
    }
  }, [debugParams])

  return (
    <div 
      className={`node-wrapper node-wrapper--${type} ${isMenuVisible ? 'node-wrapper--menu-open' : ''}`}
      style={{ ...nodeStyle, ...nodeStyleVariables }}
    >
      {learningStatus === 'lastLearned' && (
        <div className={learningTagClasses} style={learningTagStyle}>
          上次学到
        </div>
      )}
      
      <div 
        className={nodeClasses}
        style={type === 'circular' ? {} : centerNodeStyle}
        onClick={handleClickInternal}
        onContextMenu={handleContextMenu}
        ref={nodeRef}
      >
        <div className="node-icon" style={{ backgroundImage: `url(${nodeIcon})` }}></div>
        {type === 'center' && (
          <div className={contentClasses}>
            <div className="node-title">{formatNodeTitle(node)}</div>
            <div className="node-chapter">{formatNodeChapter(node)}</div>
          </div>
        )}
      </div>
      
      {type === 'circular' && (
        <div className={contentClasses}>
          <div className="node-title">{formatNodeName(node)}</div>
        </div>
      )}

      {isMenuVisible && (
        <div 
          className={`manual-bubble-menu ${menuPosition === 'top' ? 'manual-bubble-menu--top' : ''}`}
          style={bubbleMenuStyle}
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bubble-menu-container">
            <button 
              className="bubble-menu-button bubble-menu-button--learn"
              onClick={() => onLearn?.(node)}
            >
              去学习
            </button>
            <button 
              className="bubble-menu-button bubble-menu-button--practice"
              onClick={() => onPractice?.(node)}
            >
              去练习
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GraphNode
