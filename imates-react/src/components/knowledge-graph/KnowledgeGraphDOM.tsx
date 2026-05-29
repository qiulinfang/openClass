import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import GraphNode, { Node, KnowledgeGraphDebugParams } from './GraphNode'
import './KnowledgeGraphDOM.css'

interface KnowledgeGraphDOMProps {
  chapterDetails: any
  graphIndex?: number
  rotation?: number
  isExpanded?: boolean
  hasExpandedGraph?: boolean
  rotationDirection?: 'clockwise' | 'counterclockwise' | null
  textbookRecordId?: string
  textbookId?: string
  subject?: string
  onExpand?: (graphId: string) => void
  onLearn?: (node: Node) => void
  onSaveState?: () => void
  debugParams?: KnowledgeGraphDebugParams
}

const KnowledgeGraphDOM: React.FC<KnowledgeGraphDOMProps> = ({
  chapterDetails,
  graphIndex,
  rotation = 0,
  isExpanded = false,
  hasExpandedGraph = false,
  rotationDirection = null,
  textbookRecordId,
  textbookId,
  subject,
  onExpand,
  onLearn,
  onSaveState,
  debugParams
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<HTMLDivElement>(null)
  const [animationState, setAnimationState] = useState<'idle' | 'expanding' | 'expanded' | 'collapsing'>('idle')
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  
  // 模拟 Vue 中的学习状态逻辑
  const [lastLearnedNodeId, setLastLearnedNodeId] = useState<string | null>(null)
  const [learnedNodeIds, setLearnedNodeIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // 从 localStorage 加载学习状态 (简化版)
    const loadStatus = () => {
      const lastLearned = localStorage.getItem('LAST_LEARNED_NODE_ID')
      setLastLearnedNodeId(lastLearned)
      
      const learned = localStorage.getItem('LEARNED_NODES')
      if (learned) {
        setLearnedNodeIds(new Set(JSON.parse(learned)))
      }
    }
    loadStatus()
    window.addEventListener('storage', loadStatus)
    return () => window.removeEventListener('storage', loadStatus)
  }, [])

  useEffect(() => {
    const animationDuration = (debugParams?.nodeEnterExitDuration ?? 0.8) * 1000
    
    if (isExpanded && animationState !== 'expanding' && animationState !== 'expanded') {
      setAnimationState('expanding')
      setActiveNodeId(null)
      setTimeout(() => setAnimationState('expanded'), animationDuration)
    } else if (!isExpanded && animationState === 'expanded') {
      setAnimationState('collapsing')
      setActiveNodeId(null)
      setTimeout(() => setAnimationState('idle'), animationDuration)
    }
  }, [isExpanded, debugParams])

  const getCircularNodes = useCallback((details: any) => {
    if (!details?.children) return []
    if (details.level === 1) {
      return isExpanded ? details.children.filter((child: any) => child.level === 2) : []
    }
    if (details.level === 0) {
      return details.children.filter((child: any) => child.level === 1)
    }
    return details.children
  }, [isExpanded])

  const circularNodes = useMemo(() => getCircularNodes(chapterDetails), [chapterDetails, getCircularNodes])

  const backgroundRadius = useMemo(() => {
    // 简化版的半径计算逻辑
    const nodeCount = circularNodes.length
    const baseRadius = 180
    if (nodeCount === 0) return baseRadius * 0.7
    if (nodeCount <= 2) return baseRadius * 0.8
    if (nodeCount <= 4) return baseRadius * 1.0
    return baseRadius
  }, [circularNodes])

  const circularNodeRadius = useMemo(() => {
    const factor = debugParams?.circularNodeRadiusFactor ?? 1.0
    return backgroundRadius * factor
  }, [backgroundRadius, debugParams])

  const backgroundTransitionDuration = useMemo(() => {
    const duration = 0.6
    return `${duration}s`
  }, [])

  const handleToggleMenu = (nodeId: string) => {
    setActiveNodeId(prev => prev === nodeId ? null : nodeId)
  }

  const handleLearn = (node: Node) => {
    setActiveNodeId(null)
    onSaveState?.()
    onLearn?.(node)
  }

  const handlePractice = (node: Node) => {
    setActiveNodeId(null)
    console.log('Practice node:', node)
    // 实际项目中这里会有复杂的 API 调用和路由跳转
  }

  return (
    <div className="knowledge-graph-container" ref={containerRef} onClick={() => setActiveNodeId(null)}>
      <div className="knowledge-graph" ref={graphRef}>
        <div 
          className={`containment-background ${isExpanded ? 'expanded' : ''}`}
          style={{ 
            transitionDuration: backgroundTransitionDuration,
            width: `${backgroundRadius * 2}px`,
            height: `${backgroundRadius * 2}px`
          }}
        />
        
        <GraphNode
          node={{ id: chapterDetails?.id, name: chapterDetails?.name, level: chapterDetails?.level }}
          type="center"
          isMenuVisible={activeNodeId === chapterDetails?.id}
          isExpanded={isExpanded}
          hasExpandedGraph={hasExpandedGraph}
          onClick={(e) => {
            e.stopPropagation()
            onExpand?.(chapterDetails?.id)
          }}
          onToggleMenu={handleToggleMenu}
          onLearn={handleLearn}
          onPractice={handlePractice}
          debugParams={debugParams}
        />
        
        {circularNodes.map((child: any, index: number) => (
          <GraphNode
            key={child.id}
            node={child}
            type="circular"
            index={index}
            total={circularNodes.length}
            radius={circularNodeRadius}
            show={isExpanded || hasExpandedGraph}
            animationState={animationState}
            isMenuVisible={activeNodeId === child.id}
            learningStatus={lastLearnedNodeId === child.id ? 'lastLearned' : (learnedNodeIds.has(child.id) ? 'learned' : 'notLearned')}
            onToggleMenu={handleToggleMenu}
            onLearn={handleLearn}
            onPractice={handlePractice}
            debugParams={debugParams}
          />
        ))}
      </div>
    </div>
  )
}

export default KnowledgeGraphDOM
